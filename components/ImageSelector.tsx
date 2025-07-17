import React from 'react';
import { RefinedPromptItem } from '../App';
import { Button } from './Button';
import { CheckIcon } from './Icons';

interface ImageSelectorProps {
  images: RefinedPromptItem[];
  selectedImageIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  mode: 'single' | 'multiple';
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  images,
  selectedImageIds,
  onSelectionChange,
  onConfirm,
  onCancel,
  mode
}) => {
  const availableImages = images.filter(img => img.imageUrl);

  const handleImageClick = (imageId: string) => {
    if (mode === 'single') {
      onSelectionChange([imageId]);
    } else {
      const isSelected = selectedImageIds.includes(imageId);
      if (isSelected) {
        onSelectionChange(selectedImageIds.filter(id => id !== imageId));
      } else {
        onSelectionChange([...selectedImageIds, imageId]);
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedImageIds.length === availableImages.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(availableImages.map(img => img.id));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Select Images to Edit
          </h2>
          <p className="text-sm text-slate-500">
            {mode === 'single'
              ? 'Choose one image to edit'
              : `Choose images to edit (${selectedImageIds.length} selected)`
            }
          </p>
          {mode === 'multiple' && availableImages.length > 1 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSelectAll}
              className="mt-2"
            >
              {selectedImageIds.length === availableImages.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableImages.map((image) => {
              const isSelected = selectedImageIds.includes(image.id);
              return (
                <div
                  key={image.id}
                  className={`relative cursor-pointer rounded-lg border-2 transition-all duration-200 ${isSelected
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-slate-200 hover:border-slate-300'
                    }`}
                  onClick={() => handleImageClick(image.id)}
                >
                  <div className="aspect-square overflow-hidden rounded-t-lg">
                    <img
                      src={image.imageUrl}
                      alt={image.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-slate-800 text-sm truncate">
                      {image.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {image.prompt.substring(0, 100)}...
                    </p>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-sky-500 text-white rounded-full p-1">
                      <CheckIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end space-x-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={selectedImageIds.length === 0}
          >
            Edit {selectedImageIds.length > 0 ? `${selectedImageIds.length} ` : ''}Image{selectedImageIds.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageSelector;