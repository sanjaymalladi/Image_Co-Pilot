import React, { useState } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { Modal } from './Modal';
import { ArrowDownTrayIcon, XCircleIcon, PhotoIcon, SparklesIcon } from './Icons';
import { getUpscaleService, UpscaleRequest } from '../services/upscaleService';

interface DownloadOption {
  id: string;
  label: string;
  description: string;
  scale?: 2 | 4;
  estimatedTime?: number;
  estimatedSize?: string;
}

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  filename: string;
  title?: string;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  filename,
  title = 'Download Image'
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('original');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
  const upscaleService = getUpscaleService();

  const downloadOptions: DownloadOption[] = [
    {
      id: 'original',
      label: 'Original Quality',
      description: 'Download the image as-is',
      estimatedSize: '~2-5MB'
    },
    {
      id: 'upscale-2x',
      label: '2x Upscaled (HD)',
      description: 'Double the resolution for sharper details',
      scale: 2,
      estimatedTime: upscaleService.getEstimatedProcessingTime(2),
      estimatedSize: '~8-20MB'
    },
    {
      id: 'upscale-4x',
      label: '4x Upscaled (Ultra HD)',
      description: 'Quadruple the resolution for maximum quality',
      scale: 4,
      estimatedTime: upscaleService.getEstimatedProcessingTime(4),
      estimatedSize: '~32-80MB'
    }
  ];

  const handleDownload = async () => {
    const option = downloadOptions.find(opt => opt.id === selectedOption);
    if (!option) return;

    setIsProcessing(true);
    
    try {
      let finalImageUrl = imageUrl;
      let finalFilename = filename;

      // If upscaling is requested
      if (option.scale) {
        setProcessingStatus(`Upscaling image to ${option.scale}x resolution...`);
        
        const upscaleRequest: UpscaleRequest = {
          imageUrl,
          scale: option.scale,
          outputFormat: 'png'
        };

        const validation = upscaleService.validateUpscaleRequest(upscaleRequest);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const result = await upscaleService.upscaleImage(upscaleRequest);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to upscale image');
        }

        finalImageUrl = result.imageUrl!;
        finalFilename = filename.replace(/\.(jpg|jpeg|png)$/i, `_${option.scale}x.$1`);
      }

      setProcessingStatus('Downloading...');
      
      // Download the image
      const response = await fetch(finalImageUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch image for download');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (error: any) {
      console.error('Download error:', error);
      setProcessingStatus(`Error: ${error.message}`);
      setTimeout(() => {
        setProcessingStatus('');
        setIsProcessing(false);
      }, 3000);
    } finally {
      if (!processingStatus.startsWith('Error:')) {
        setIsProcessing(false);
        setProcessingStatus('');
      }
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* Preview */}
        <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden max-w-xs mx-auto">
          <img 
            src={imageUrl} 
            alt="Preview"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Download Options */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-700">Choose download quality:</h3>
          
          {downloadOptions.map((option) => (
            <label
              key={option.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedOption === option.id
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="downloadOption"
                value={option.id}
                checked={selectedOption === option.id}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="mt-1 w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-800">{option.label}</h4>
                  {option.scale && (
                    <SparklesIcon className="w-4 h-4 text-sky-500" />
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1">{option.description}</p>
                <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                  <span>Size: {option.estimatedSize}</span>
                  {option.estimatedTime && (
                    <span>Time: ~{formatTime(option.estimatedTime)}</span>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="flex items-center justify-center space-x-2 p-3 bg-sky-50 rounded-lg">
            <Spinner className="w-4 h-4 text-sky-500" />
            <span className="text-sm text-sky-700">
              {processingStatus || 'Processing...'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={isProcessing}>
            {isProcessing ? (
              <Spinner className="w-4 h-4 mr-2" />
            ) : (
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            )}
            {isProcessing ? 'Processing...' : 'Download'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadModal;