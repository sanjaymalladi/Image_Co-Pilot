import { ProgressStep } from '../components/ProgressIndicator';

export interface GenerationProgress {
  steps: ProgressStep[];
  currentStepId?: string;
  startTime: number;
  elapsedTime: number;
  isComplete: boolean;
}

export type GenerationMode = 'simple' | 'advanced';
export type PackType = 'studio' | 'lifestyle' | 'all';

export class ProgressService {
  private progressCallbacks: ((progress: GenerationProgress) => void)[] = [];
  private currentProgress: GenerationProgress | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: GenerationProgress) => void): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get estimated steps for different generation modes
   */
  getStepsForMode(mode: GenerationMode, packType: PackType, imageCount: number = 4): ProgressStep[] {
    const baseSteps: ProgressStep[] = [];

    if (mode === 'simple') {
      baseSteps.push({
        id: 'analyze',
        label: 'Analyzing garment details',
        estimatedDuration: 8,
        status: 'pending'
      });

      baseSteps.push({
        id: 'qa-generation',
        label: 'Generating QA reference image',
        estimatedDuration: 12,
        status: 'pending'
      });

      baseSteps.push({
        id: 'prompt-refinement',
        label: 'Creating optimized prompts',
        estimatedDuration: 6,
        status: 'pending'
      });

      // Add image generation steps based on pack type
      if (packType === 'studio' || packType === 'all') {
        baseSteps.push({
          id: 'studio-front',
          label: 'Generating front view',
          estimatedDuration: 15,
          status: 'pending'
        });

        if (packType === 'all') {
          baseSteps.push({
            id: 'studio-additional',
            label: 'Generating studio angles (back, side, detail)',
            estimatedDuration: 45, // 3 images × 15s each
            status: 'pending'
          });
        }
      }

      if (packType === 'lifestyle' || packType === 'all') {
        const lifestyleLabel = packType === 'all' ? 'Generating lifestyle scenes' : 'Generating lifestyle images';
        const lifestyleDuration = packType === 'all' ? 60 : 60; // 4 images × 15s each
        
        baseSteps.push({
          id: 'lifestyle-generation',
          label: lifestyleLabel,
          estimatedDuration: lifestyleDuration,
          status: 'pending'
        });
      }

    } else if (mode === 'advanced') {
      baseSteps.push({
        id: 'analyze',
        label: 'Analyzing garment details',
        estimatedDuration: 8,
        status: 'pending'
      });

      baseSteps.push({
        id: 'manual-qa',
        label: 'Waiting for QA image upload',
        estimatedDuration: 0, // User-controlled
        status: 'pending'
      });

      baseSteps.push({
        id: 'prompt-refinement',
        label: 'Performing QA and refining prompts',
        estimatedDuration: 10,
        status: 'pending'
      });

      baseSteps.push({
        id: 'image-generation',
        label: `Generating ${imageCount} images`,
        estimatedDuration: imageCount * 15,
        status: 'pending'
      });
    }

    baseSteps.push({
      id: 'finalize',
      label: 'Finalizing and saving results',
      estimatedDuration: 3,
      status: 'pending'
    });

    return baseSteps;
  }

  /**
   * Start progress tracking
   */
  startProgress(steps: ProgressStep[]): void {
    this.currentProgress = {
      steps: [...steps],
      startTime: Date.now(),
      elapsedTime: 0,
      isComplete: false
    };

    // Start the first step
    if (steps.length > 0) {
      this.currentProgress.steps[0].status = 'active';
      this.currentProgress.currentStepId = steps[0].id;
    }

    // Start timer
    this.intervalId = setInterval(() => {
      if (this.currentProgress) {
        this.currentProgress.elapsedTime = (Date.now() - this.currentProgress.startTime) / 1000;
        this.notifyProgress();
      }
    }, 1000);

    this.notifyProgress();
  }

  /**
   * Update step status
   */
  updateStep(stepId: string, status: 'active' | 'completed' | 'error', error?: string): void {
    if (!this.currentProgress) return;

    const stepIndex = this.currentProgress.steps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) return;

    this.currentProgress.steps[stepIndex].status = status;
    if (error) {
      this.currentProgress.steps[stepIndex].error = error;
    }

    if (status === 'completed') {
      // Start next step if available
      const nextStepIndex = stepIndex + 1;
      if (nextStepIndex < this.currentProgress.steps.length) {
        this.currentProgress.steps[nextStepIndex].status = 'active';
        this.currentProgress.currentStepId = this.currentProgress.steps[nextStepIndex].id;
      } else {
        // All steps completed
        this.currentProgress.isComplete = true;
        this.currentProgress.currentStepId = undefined;
      }
    } else if (status === 'active') {
      this.currentProgress.currentStepId = stepId;
    }

    this.notifyProgress();
  }

  /**
   * Complete all progress tracking
   */
  completeProgress(): void {
    if (!this.currentProgress) return;

    // Mark all remaining steps as completed
    this.currentProgress.steps.forEach(step => {
      if (step.status === 'pending' || step.status === 'active') {
        step.status = 'completed';
      }
    });

    this.currentProgress.isComplete = true;
    this.currentProgress.currentStepId = undefined;

    this.notifyProgress();
    this.stopProgress();
  }

  /**
   * Stop progress tracking with error
   */
  errorProgress(stepId: string, error: string): void {
    if (!this.currentProgress) return;

    this.updateStep(stepId, 'error', error);
    this.stopProgress();
  }

  /**
   * Stop progress tracking
   */
  stopProgress(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get current progress
   */
  getCurrentProgress(): GenerationProgress | null {
    return this.currentProgress;
  }

  /**
   * Reset progress
   */
  resetProgress(): void {
    this.stopProgress();
    this.currentProgress = null;
    this.notifyProgress();
  }

  /**
   * Notify all subscribers of progress updates
   */
  private notifyProgress(): void {
    if (this.currentProgress) {
      this.progressCallbacks.forEach(callback => callback(this.currentProgress!));
    }
  }

  /**
   * Get estimated total time for a generation mode
   */
  getEstimatedTime(mode: GenerationMode, packType: PackType, imageCount: number = 4): number {
    const steps = this.getStepsForMode(mode, packType, imageCount);
    return steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
  }

  /**
   * Format time duration for display
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.ceil(seconds % 60);
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

// Create singleton instance
let progressServiceInstance: ProgressService | null = null;

export const getProgressService = (): ProgressService => {
  if (!progressServiceInstance) {
    progressServiceInstance = new ProgressService();
  }
  return progressServiceInstance;
};

export const createProgressService = (): ProgressService => {
  return new ProgressService();
};