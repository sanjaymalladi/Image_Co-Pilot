import React from 'react';
import { Spinner } from './Spinner';
import { ClockIcon, CheckIcon } from './Icons';

export interface ProgressStep {
  id: string;
  label: string;
  estimatedDuration: number; // in seconds
  status: 'pending' | 'active' | 'completed' | 'error';
  error?: string;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStepId?: string;
  elapsedTime: number; // in seconds
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStepId,
  elapsedTime,
  className = '',
}) => {
  const totalEstimatedTime = steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
  const completedSteps = steps.filter(step => step.status === 'completed');
  const completedTime = completedSteps.reduce((sum, step) => sum + step.estimatedDuration, 0);
  
  const currentStep = steps.find(step => step.id === currentStepId);
  const currentStepIndex = currentStep ? steps.indexOf(currentStep) : -1;
  
  // Calculate progress percentage
  let progressPercentage = 0;
  if (completedSteps.length > 0) {
    progressPercentage = (completedTime / totalEstimatedTime) * 100;
  }
  
  // Add partial progress for current step based on elapsed time
  if (currentStep && currentStepIndex >= 0) {
    const stepStartTime = completedTime;
    const stepElapsedTime = Math.max(0, elapsedTime - stepStartTime);
    const stepProgress = Math.min(stepElapsedTime / currentStep.estimatedDuration, 1);
    progressPercentage += (stepProgress * currentStep.estimatedDuration / totalEstimatedTime) * 100;
  }
  
  progressPercentage = Math.min(progressPercentage, 100);
  
  // Calculate remaining time
  const remainingTime = Math.max(0, totalEstimatedTime - elapsedTime);
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.ceil(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-4 ${className}`}>
      {/* Header with time info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Spinner className="w-5 h-5 text-sky-500" />
          <span className="font-medium text-slate-700">Generating Images</span>
        </div>
        <div className="flex items-center space-x-4 text-sm text-slate-600">
          <div className="flex items-center space-x-1">
            <ClockIcon className="w-4 h-4" />
            <span>~{formatTime(remainingTime)} left</span>
          </div>
          <div className="text-slate-500">
            {formatTime(elapsedTime)} / {formatTime(totalEstimatedTime)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-sky-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{Math.round(progressPercentage)}% complete</span>
          <span>{completedSteps.length} of {steps.length} steps</span>
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${
              step.status === 'active' 
                ? 'bg-sky-50 border border-sky-200' 
                : step.status === 'completed'
                ? 'bg-green-50'
                : step.status === 'error'
                ? 'bg-red-50'
                : 'bg-slate-50'
            }`}
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              {step.status === 'completed' ? (
                <CheckIcon className="w-4 h-4 text-green-600" />
              ) : step.status === 'active' ? (
                <Spinner className="w-4 h-4 text-sky-500" />
              ) : step.status === 'error' ? (
                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-white text-xs">!</span>
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full bg-slate-300" />
              )}
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  step.status === 'completed' 
                    ? 'text-green-700' 
                    : step.status === 'active'
                    ? 'text-sky-700'
                    : step.status === 'error'
                    ? 'text-red-700'
                    : 'text-slate-600'
                }`}>
                  {step.label}
                </span>
                <span className="text-xs text-slate-500">
                  ~{formatTime(step.estimatedDuration)}
                </span>
              </div>
              {step.status === 'error' && step.error && (
                <p className="text-xs text-red-600 mt-1">{step.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressIndicator;