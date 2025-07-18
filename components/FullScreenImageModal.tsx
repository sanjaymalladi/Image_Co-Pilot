import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { 
  XCircleIcon, 
  ArrowDownTrayIcon, 
  SparklesIcon, 
  PaperAirplaneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsPointingOutIcon,
  LightBulbIcon
} from './Icons';
import { RefinedPromptItem } from '../App';
import { getEditService } from '../services/editService';
import DownloadModal from './DownloadModal';

interface FullScreenImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: RefinedPromptItem[];
  currentIndex: number;
  onImageChange: (index: number) => void;
  onImageUpdate: (updatedImage: RefinedPromptItem) => void;
}

export const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({
  isOpen,
  onClose,
  images,
  currentIndex,
  onImageChange,
  onImageUpdate
}) => {
  console.log('🎬 FullScreenImageModal rendered with:', {
    isOpen,
    imagesCount: images.length,
    currentIndex,
    currentImage: images[currentIndex]
  });
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editService = getEditService();

  const currentImage = images[currentIndex];
  const hasValidImage = currentImage?.imageUrl && !currentImage.isLoadingImage && !currentImage.error;

  // Reset zoom and pan when image changes
  useEffect(() => {
    setZoom(1);
    setPanPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onImageChange(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        onImageChange(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onImageChange]);

  const handleEdit = async () => {
    if (!editPrompt.trim() || !hasValidImage) return;

    setIsEditing(true);
    try {
      const result = await editService.editImage({
        prompt: editPrompt.trim(),
        inputImage: currentImage.imageUrl!,
        outputFormat: 'png',
        numInferenceSteps: 30,
      });

      if (result.success && result.imageUrl) {
        const updatedImage: RefinedPromptItem = {
          ...currentImage,
          imageUrl: result.imageUrl,
        };
        onImageUpdate(updatedImage);
        setEditPrompt('');
      } else {
        throw new Error(result.error || 'Failed to edit image');
      }
    } catch (error: any) {
      console.error('Edit error:', error);
      // You might want to show an error toast here
    } finally {
      setIsEditing(false);
    }
  };

  const handleDownload = () => {
    if (!hasValidImage) return;
    setShowDownloadModal(true);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getSuggestions = () => {
    return editService.generateContextualPrompts(currentImage?.title || '');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setEditPrompt(suggestion);
    setShowSuggestions(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[60] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black bg-opacity-50 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <h2 className="text-white font-semibold text-lg">
            {currentImage?.title || 'Image View'}
          </h2>
          <span className="text-white text-sm opacity-75">
            {currentIndex + 1} of {images.length}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Navigation */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onImageChange(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="bg-black bg-opacity-50 text-white border-white border-opacity-30"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onImageChange(currentIndex + 1)}
            disabled={currentIndex === images.length - 1}
            className="bg-black bg-opacity-50 text-white border-white border-opacity-30"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Button>

          {/* Zoom controls */}
          {hasValidImage && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="bg-black bg-opacity-50 text-white border-white border-opacity-30"
              >
                <MagnifyingGlassMinusIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetZoom}
                className="bg-black bg-opacity-50 text-white border-white border-opacity-30"
              >
                <ArrowsPointingOutIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 5}
                className="bg-black bg-opacity-50 text-white border-white border-opacity-30"
              >
                <MagnifyingGlassPlusIcon className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Download */}
          {hasValidImage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="bg-black bg-opacity-50 text-white border-white border-opacity-30"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
            </Button>
          )}

          {/* Close */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="bg-black bg-opacity-50 text-white border-white border-opacity-30"
          >
            <XCircleIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Image area */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {currentImage?.isLoadingImage && (
            <div className="flex flex-col items-center space-y-4">
              <Spinner className="w-12 h-12 text-white" />
              <p className="text-white text-lg">Generating image...</p>
            </div>
          )}

          {currentImage?.error && (
            <div className="flex flex-col items-center space-y-4 text-center">
              <XCircleIcon className="w-16 h-16 text-red-400" />
              <div>
                <p className="text-white text-lg mb-2">Failed to generate image</p>
                <p className="text-red-400 text-sm">{currentImage.error}</p>
              </div>
            </div>
          )}

          {hasValidImage && (
            <img
              ref={imageRef}
              src={currentImage.imageUrl}
              alt={currentImage.title}
              className="max-w-none transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) translate(${panPosition.x / zoom}px, ${panPosition.y / zoom}px)`,
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
              draggable={false}
            />
          )}

          {!hasValidImage && !currentImage?.isLoadingImage && !currentImage?.error && (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <SparklesIcon className="w-8 h-8 text-white opacity-50" />
              </div>
              <p className="text-white text-lg">No image available</p>
            </div>
          )}
        </div>

        {/* Edit panel */}
        <div className="w-80 bg-black bg-opacity-50 backdrop-blur-sm border-l border-white border-opacity-20 flex flex-col">
          <div className="p-4 border-b border-white border-opacity-20">
            <h3 className="text-white font-semibold mb-2 flex items-center">
              <SparklesIcon className="w-5 h-5 mr-2" />
              Quick Edit
            </h3>
            <p className="text-white text-sm opacity-75">
              Describe changes you want to make to this image
            </p>
          </div>

          <div className="flex-1 p-4 space-y-4">
            {/* Current image info */}
            <div className="bg-white bg-opacity-10 rounded-lg p-3">
              <h4 className="text-white font-medium text-sm mb-2">Current Image</h4>
              <p className="text-white text-xs opacity-75 line-clamp-3">
                {currentImage?.prompt || 'No prompt available'}
              </p>
            </div>

            {/* Edit input */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Edit Prompt</label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="e.g., Change the background to white, add sunglasses, make it more colorful..."
                className="w-full h-24 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-30 rounded-lg text-white placeholder-white placeholder-opacity-50 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={isEditing}
              />
            </div>

            {/* Suggestions */}
            {showSuggestions && (
              <div className="space-y-2">
                <h5 className="text-white text-sm font-medium">Suggestions:</h5>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {getSuggestions().slice(0, 6).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left text-xs p-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded border border-white border-opacity-20 text-white transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  variant="secondary"
                  size="sm"
                  className="flex-1 bg-white bg-opacity-10 text-white border-white border-opacity-30"
                  disabled={isEditing}
                >
                  <LightBulbIcon className="w-4 h-4 mr-1" />
                  Ideas
                </Button>
                <Button
                  onClick={handleEdit}
                  disabled={!editPrompt.trim() || isEditing || !hasValidImage}
                  className="flex-1"
                >
                  {isEditing ? (
                    <Spinner className="w-4 h-4 mr-1" />
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4 mr-1" />
                  )}
                  {isEditing ? 'Editing...' : 'Apply Edit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Download Modal */}
      {showDownloadModal && hasValidImage && (
        <DownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          imageUrl={currentImage.imageUrl!}
          filename={`${currentImage.title.toLowerCase().replace(/\s+/g, '-')}.png`}
          title={`Download ${currentImage.title}`}
        />
      )}
    </div>
  );
};

export default FullScreenImageModal;