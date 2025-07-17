export interface EditRequest {
  prompt: string;
  inputImage: string; // URL or data URL
  outputFormat?: 'jpg' | 'png';
  numInferenceSteps?: number;
}

export interface EditResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export interface BulkEditResult {
  results: EditResult[];
  successCount: number;
  failureCount: number;
}

export interface EditProgress {
  total: number;
  completed: number;
  current?: string; // Current item being processed
}

export class EditService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Edit a single image using Flux-Kontext model
   */
  async editImage(request: EditRequest): Promise<EditResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/edit-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          input_image: request.inputImage,
          output_format: request.outputFormat || 'png',
          num_inference_steps: request.numInferenceSteps || 30,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.url || typeof data.url !== 'string') {
        throw new Error('Invalid response from edit endpoint: missing or invalid URL');
      }

      return {
        success: true,
        imageUrl: data.url,
      };
    } catch (error: any) {
      console.error('Edit image error:', error);
      return {
        success: false,
        error: error.message || 'Failed to edit image',
      };
    }
  }

  /**
   * Edit multiple images with the same prompt
   */
  async editMultipleImages(
    requests: EditRequest[],
    onProgress?: (progress: EditProgress) => void
  ): Promise<BulkEditResult> {
    const results: EditResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      
      // Report progress
      if (onProgress) {
        onProgress({
          total: requests.length,
          completed: i,
          current: `Editing image ${i + 1} of ${requests.length}`,
        });
      }

      try {
        const result = await this.editImage(request);
        results.push(result);
        
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Failed to edit image',
        });
        failureCount++;
      }

      // Add a 1-second delay between requests to avoid overwhelming the API
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final progress update
    if (onProgress) {
      onProgress({
        total: requests.length,
        completed: requests.length,
        current: 'Completed',
      });
    }

    return {
      results,
      successCount,
      failureCount,
    };
  }

  /**
   * Edit multiple images in parallel (faster but may hit rate limits)
   */
  async editMultipleImagesParallel(
    requests: EditRequest[],
    maxConcurrency: number = 3
  ): Promise<BulkEditResult> {
    const results: EditResult[] = new Array(requests.length);
    let successCount = 0;
    let failureCount = 0;

    // Process requests in batches to respect rate limits
    const batches: EditRequest[][] = [];
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      batches.push(requests.slice(i, i + maxConcurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (request, batchIndex) => {
        const globalIndex = batches.indexOf(batch) * maxConcurrency + batchIndex;
        try {
          const result = await this.editImage(request);
          results[globalIndex] = result;
          
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error: any) {
          results[globalIndex] = {
            success: false,
            error: error.message || 'Failed to edit image',
          };
          failureCount++;
        }
      });

      await Promise.all(batchPromises);
      
      // Add delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      results,
      successCount,
      failureCount,
    };
  }

  /**
   * Validate edit request parameters
   */
  validateEditRequest(request: EditRequest): { valid: boolean; error?: string } {
    if (!request.prompt || request.prompt.trim().length === 0) {
      return { valid: false, error: 'Edit prompt is required' };
    }

    if (!request.inputImage || request.inputImage.trim().length === 0) {
      return { valid: false, error: 'Input image is required' };
    }

    if (!request.inputImage.startsWith('http') && !request.inputImage.startsWith('data:')) {
      return { valid: false, error: 'Input image must be a valid URL or data URL' };
    }

    if (request.prompt.length > 1000) {
      return { valid: false, error: 'Edit prompt is too long (max 1000 characters)' };
    }

    if (request.outputFormat && !['jpg', 'png'].includes(request.outputFormat)) {
      return { valid: false, error: 'Output format must be jpg or png' };
    }

    if (request.numInferenceSteps && (request.numInferenceSteps < 1 || request.numInferenceSteps > 100)) {
      return { valid: false, error: 'Number of inference steps must be between 1 and 100' };
    }

    return { valid: true };
  }

  /**
   * Get suggested edit prompts for common modifications
   */
  getSuggestedPrompts(): string[] {
    return [
      'Change the background to a solid white',
      'Make the lighting brighter and more professional',
      'Change the color to blue',
      'Add more contrast and saturation',
      'Remove the background completely',
      'Make it look more vintage',
      'Add dramatic shadows',
      'Change to black and white',
      'Make the image sharper and more detailed',
      'Add a soft blur effect to the background',
    ];
  }

  /**
   * Generate edit prompt suggestions based on image context
   */
  generateContextualPrompts(imageContext?: string): string[] {
    const basePrompts = this.getSuggestedPrompts();
    
    if (!imageContext) {
      return basePrompts;
    }

    const contextualPrompts: string[] = [];
    
    if (imageContext.toLowerCase().includes('fashion') || imageContext.toLowerCase().includes('clothing')) {
      contextualPrompts.push(
        'Change the garment color to red',
        'Make the fabric look more luxurious',
        'Add subtle wrinkles for realism',
        'Change the style to more casual',
        'Make the fit more tailored'
      );
    }

    if (imageContext.toLowerCase().includes('portrait') || imageContext.toLowerCase().includes('person')) {
      contextualPrompts.push(
        'Improve skin tone and texture',
        'Add professional studio lighting',
        'Change the facial expression to smiling',
        'Adjust the pose to be more confident'
      );
    }

    return [...contextualPrompts, ...basePrompts].slice(0, 10);
  }
}

// Create a singleton instance
let editServiceInstance: EditService | null = null;

export const createEditService = (baseUrl?: string): EditService => {
  if (!editServiceInstance) {
    editServiceInstance = new EditService(baseUrl);
  }
  return editServiceInstance;
};

export const getEditService = (): EditService => {
  if (!editServiceInstance) {
    editServiceInstance = new EditService();
  }
  return editServiceInstance;
};