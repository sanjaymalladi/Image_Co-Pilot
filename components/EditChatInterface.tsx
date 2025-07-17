import React, { useState, useRef, useEffect } from 'react';
import { RefinedPromptItem } from '../App';
import { EditService, EditRequest, EditProgress, getEditService } from '../services/editService';
import { HistoryService, getHistoryService } from '../services/historyService';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { XCircleIcon, PaperAirplaneIcon, PhotoIcon, SparklesIcon, LightBulbIcon } from './Icons';
import { useUser } from '@clerk/clerk-react';

export interface EditMessage {
  id: string;
  type: 'user' | 'system' | 'result';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  isLoading?: boolean;
  error?: string;
}

interface EditChatInterfaceProps {
  currentImages: RefinedPromptItem[];
  onEditComplete: (editedImages: RefinedPromptItem[]) => void;
  onClose: () => void;
  editMode: 'single' | 'all';
  selectedImageId?: string;
}

const EditChatInterface: React.FC<EditChatInterfaceProps> = ({
  currentImages,
  onEditComplete,
  onClose,
  editMode,
  selectedImageId,
}) => {
  const [messages, setMessages] = useState<EditMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<EditProgress | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editService = getEditService();
  const historyService = getHistoryService();
  const { user } = useUser();

  // Get images to edit based on mode
  const imagesToEdit = editMode === 'single' && selectedImageId 
    ? currentImages.filter(img => img.id === selectedImageId)
    : currentImages.filter(img => img.imageUrl);

  useEffect(() => {
    // Add welcome message
    const welcomeMessage: EditMessage = {
      id: 'welcome',
      type: 'system',
      content: editMode === 'single' 
        ? `Ready to edit your selected image! Describe what changes you'd like to make.`
        : `Ready to edit ${imagesToEdit.length} images! Your edit will be applied to all selected images.`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [editMode, imagesToEdit.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Helper function to save edited images to history
  const saveEditedImageToHistory = async (imageUrl: string, editPrompt: string, originalImage: RefinedPromptItem) => {
    if (!user) return;
    
    try {
      await historyService.saveToHistory({
        userId: user.id,
        prompt: editPrompt,
        imageUrl,
        title: `${originalImage.title} (Edited)`,
        aspectRatio: originalImage.aspectRatio,
        metadata: {
          model: 'black-forest-labs/flux-kontext-dev',
          originalPrompt: originalImage.prompt,
          refinedPrompt: editPrompt,
          editHistory: [{
            editPrompt,
            resultUrl: imageUrl,
            timestamp: Date.now(),
          }],
        },
      });
    } catch (error) {
      console.error('Failed to save edited image to history:', error);
      // Don't show error to user as this is background operation
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: EditMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Create edit requests
      const editRequests: EditRequest[] = imagesToEdit.map(img => ({
        prompt: userMessage.content,
        inputImage: img.imageUrl!,
        outputFormat: 'png' as const,
        numInferenceSteps: 30,
      }));

      // Validate requests
      const validationErrors = editRequests.map(req => editService.validateEditRequest(req))
        .filter(result => !result.valid);

      if (validationErrors.length > 0) {
        const errorMessage: EditMessage = {
          id: `error-${Date.now()}`,
          type: 'system',
          content: `Error: ${validationErrors[0].error}`,
          timestamp: new Date(),
          error: validationErrors[0].error,
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsProcessing(false);
        return;
      }

      // Add processing message
      const processingMessage: EditMessage = {
        id: `processing-${Date.now()}`,
        type: 'system',
        content: editMode === 'single' 
          ? 'Processing your edit...' 
          : `Processing edits for ${editRequests.length} images...`,
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages(prev => [...prev, processingMessage]);

      // Process edits
      const bulkResult = await editService.editMultipleImages(
        editRequests,
        (progressUpdate) => setProgress(progressUpdate)
      );

      // Remove processing message
      setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id));

      // Create updated images array
      const updatedImages = [...currentImages];
      let successCount = 0;

      bulkResult.results.forEach(async (result, index) => {
        const originalImage = imagesToEdit[index];
        const imageIndex = currentImages.findIndex(img => img.id === originalImage.id);
        
        if (result.success && result.imageUrl && imageIndex !== -1) {
          updatedImages[imageIndex] = {
            ...originalImage,
            imageUrl: result.imageUrl,
          };
          successCount++;

          // Save edited image to history
          await saveEditedImageToHistory(result.imageUrl, userMessage.content, originalImage);

          // Add result message with image
          const resultMessage: EditMessage = {
            id: `result-${originalImage.id}-${Date.now()}`,
            type: 'result',
            content: editMode === 'single' 
              ? 'Here\'s your edited image:' 
              : `Edited image ${index + 1}:`,
            timestamp: new Date(),
            imageUrl: result.imageUrl,
          };
          setMessages(prev => [...prev, resultMessage]);
        }
      });

      // Add summary message
      const summaryMessage: EditMessage = {
        id: `summary-${Date.now()}`,
        type: 'system',
        content: bulkResult.failureCount > 0
          ? `Completed! ${successCount} images edited successfully, ${bulkResult.failureCount} failed.`
          : `Great! Successfully edited ${successCount} image${successCount > 1 ? 's' : ''}.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, summaryMessage]);

      // Update parent component
      onEditComplete(updatedImages);

    } catch (error: any) {
      const errorMessage: EditMessage = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: `Sorry, something went wrong: ${error.message}`,
        timestamp: new Date(),
        error: error.message,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const getSuggestions = () => {
    const context = imagesToEdit.map(img => img.title).join(' ');
    return editService.generateContextualPrompts(context);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <SparklesIcon className="w-6 h-6 text-sky-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Edit {editMode === 'single' ? 'Image' : `${imagesToEdit.length} Images`}
              </h2>
              <p className="text-sm text-slate-500">
                Describe the changes you want to make
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            <XCircleIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-sky-500 text-white'
                    : message.type === 'system'
                    ? message.error
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-slate-100 text-slate-700'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                
                {message.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={message.imageUrl}
                      alt="Edited result"
                      className="rounded-lg max-w-full h-auto border border-slate-200"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}
                
                {message.isLoading && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Spinner className="w-4 h-4" />
                    {progress && (
                      <span className="text-xs">
                        {progress.current} ({progress.completed}/{progress.total})
                      </span>
                    )}
                  </div>
                )}
                
                <p className="text-xs opacity-70 mt-1">
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="border-t bg-slate-50 p-4">
            <div className="flex items-center space-x-2 mb-3">
              <LightBulbIcon className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-slate-700">Suggestions:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {getSuggestions().slice(0, 6).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left text-sm p-2 rounded bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe the changes you want to make..."
                disabled={isProcessing}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSuggestions(!showSuggestions)}
              disabled={isProcessing}
              className="px-3"
            >
              <LightBulbIcon className="w-4 h-4" />
            </Button>
            <Button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="px-4"
            >
              {isProcessing ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <PaperAirplaneIcon className="w-4 h-4" />
              )}
            </Button>
          </form>
          
          {progress && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{progress.current}</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditChatInterface;