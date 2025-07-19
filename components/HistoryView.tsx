import React, { useState, useEffect } from 'react';
import { HistoryItem, getHistoryService } from '../services/historyService';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { XCircleIcon, ClockIcon, PhotoIcon, TrashIcon, EyeIcon, ArrowDownTrayIcon } from './Icons';
import DownloadModal from './DownloadModal';
import FullScreenImageModal from './FullScreenImageModal';
import { RefinedPromptItem } from '../App';

interface HistoryViewProps {
  userId: string;
  onClose: () => void;
}





const HistoryView: React.FC<HistoryViewProps> = ({ userId, onClose }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Full-screen modal state
  const [showFullScreenModal, setShowFullScreenModal] = useState(false);
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState(0);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<HistoryItem | null>(null);

  const historyService = getHistoryService();

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const history = await historyService.getHistory(userId);
      setHistoryItems(history);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [userId]);


  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await historyService.deleteFromHistory(id as any);
      setHistoryItems(prev => prev.filter(item => item._id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  // Convert HistoryItem to RefinedPromptItem for full-screen modal
  const convertToRefinedPromptItem = (item: HistoryItem): RefinedPromptItem => ({
    id: item._id,
    title: item.title || 'Generated Image',
    prompt: item.prompt,
    isCopied: false,
    isLoadingImage: false,
    aspectRatio: item.aspectRatio,
    imageUrl: item.imageUrl,
  });

  // Full-screen modal handlers
  const handleImageFullScreen = (index: number, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log('🖼️ CLICK DETECTED! Opening full-screen for image at index:', index);
    console.log('📊 Total history items:', historyItems.length);
    console.log('📋 History item at index:', historyItems[index]);
    
    setFullScreenImageIndex(index);
    setShowFullScreenModal(true);
  };

  const handleFullScreenImageChange = (newIndex: number) => {
    setFullScreenImageIndex(newIndex);
  };

  const handleFullScreenImageUpdate = (updatedImage: RefinedPromptItem) => {
    // Update the history item with the new image URL
    setHistoryItems(prev => prev.map(item =>
      item._id === updatedImage.id ? { ...item, imageUrl: updatedImage.imageUrl! } : item
    ));
  };

  // Download handlers
  const handleDownload = (item: HistoryItem) => {
    setDownloadItem(item);
    setShowDownloadModal(true);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center space-x-3">
            <Spinner className="w-6 h-6 text-sky-500" />
            <span className="text-slate-600">Loading your history...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-6 h-6 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-800">Your History</h2>
            <span className="text-sm text-slate-500">({historyItems.length} items)</span>
          </div>
          <Button variant="secondary" onClick={onClose}>
            <XCircleIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <XCircleIcon className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{error}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadHistory}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}

          {historyItems.length === 0 && !error ? (
            <div className="text-center py-12">
              <PhotoIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No history yet</h3>
              <p className="text-slate-500 mb-4">
                Your generated images will appear here once you start creating.
              </p>
              <Button onClick={onClose}>
                Start Creating
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {historyItems.map((item, index) => (
                <div
                  key={item._id}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                >
                  {/* Image */}
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title || 'Generated image'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                      onClick={(e) => handleImageFullScreen(index, e)}
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBzdHJva2U9IiM5Q0E3QjciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                      <EyeIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                    {deletingId === item._id && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <Spinner className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-slate-800 text-sm truncate flex-1">
                        {item.title || 'Generated Image'}
                      </h3>
                      <div className="flex items-center space-x-1 ml-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item);
                          }}
                          className="p-1"
                        >
                          <ArrowDownTrayIcon className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this image?')) {
                              handleDelete(item._id);
                            }
                          }}
                          className="p-1"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Input details */}
                    <div className="text-xs text-slate-500 mb-2">
                      <p className="line-clamp-2 mb-1">{item.prompt}</p>
                      {item.metadata?.editHistory && item.metadata.editHistory.length > 0 && (
                        <span className="inline-block bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">
                          Edited {item.metadata.editHistory.length}x
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>{item.aspectRatio}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      {/* Full Screen Image Modal */}
      {showFullScreenModal && (
        <FullScreenImageModal
          isOpen={showFullScreenModal}
          onClose={() => setShowFullScreenModal(false)}
          images={historyItems.map(convertToRefinedPromptItem)}
          currentIndex={fullScreenImageIndex}
          onImageChange={handleFullScreenImageChange}
          onImageUpdate={handleFullScreenImageUpdate}
        />
      )}

      {/* Download Modal */}
      {showDownloadModal && downloadItem && (
        <DownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          imageUrl={downloadItem.imageUrl}
          filename={`${(downloadItem.title || 'image').toLowerCase().replace(/\s+/g, '-')}.png`}
          title={`Download ${downloadItem.title || 'Image'}`}
        />
      )}
    </div>
  );
};

export default HistoryView;