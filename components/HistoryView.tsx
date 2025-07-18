import React, { useState, useEffect } from 'react';
import { HistoryItem, getHistoryService } from '../services/historyService';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { XCircleIcon, ClockIcon, PhotoIcon, TrashIcon, EyeIcon, ArrowDownTrayIcon, SparklesIcon } from './Icons';
import { Modal } from './Modal';
import DownloadModal from './DownloadModal';

interface HistoryViewProps {
  userId: string;
  onClose: () => void;
  onImageSelect?: (item: HistoryItem) => void;
}

interface HistoryItemDetailProps {
  item: HistoryItem;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const HistoryItemDetail: React.FC<HistoryItemDetailProps> = ({ item, onClose, onDelete }) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this item from your history?')) {
      onDelete(item._id);
      onClose();
    }
  };

  const handleDownload = () => {
    setShowDownloadModal(true);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={item.title || 'History Item'}>
      <div className="space-y-4">
        {/* Image */}
        <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
          <img 
            src={item.imageUrl} 
            alt={item.title || 'Generated image'}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBzdHJva2U9IiM5Q0E3QjciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
            }}
          />
        </div>

        {/* Metadata */}
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Prompt</h3>
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
              {item.prompt}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Created:</span>
              <p className="text-slate-600">{formatDate(item.createdAt)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Aspect Ratio:</span>
              <p className="text-slate-600">{item.aspectRatio}</p>
            </div>
          </div>

          {/* Generation Details */}
          <div className="bg-slate-50 p-3 rounded-md">
            <h4 className="font-medium text-slate-700 mb-2 flex items-center">
              <SparklesIcon className="w-4 h-4 mr-1" />
              Generation Details
            </h4>
            <div className="space-y-2 text-sm">
              {item.metadata?.model && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Model:</span>
                  <span className="font-medium text-slate-800">{item.metadata.model}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Type:</span>
                <span className="font-medium text-slate-800">
                  {item.metadata?.editHistory && item.metadata.editHistory.length > 0 ? 'Edited Image' : 'Generated Image'}
                </span>
              </div>
              {item.title && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Style:</span>
                  <span className="font-medium text-slate-800">
                    {item.title.includes('Studio') ? 'Studio' : 
                     item.title.includes('Lifestyle') ? 'Lifestyle' : 
                     item.title.includes('Front') ? 'Front View' :
                     item.title.includes('Back') ? 'Back View' :
                     item.title.includes('Side') ? 'Side View' :
                     item.title.includes('Detail') ? 'Close-up Detail' : 'Custom'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Additional Details */}
          {item.metadata && (item.metadata.originalPrompt || (item.metadata.editHistory && item.metadata.editHistory.length > 0)) && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Additional Details</h4>
              <div className="text-sm space-y-3">
                {item.metadata.originalPrompt && (
                  <div>
                    <span className="font-medium">Original Prompt:</span>
                    <p className="text-slate-600 bg-slate-50 p-2 rounded mt-1 text-xs">
                      {item.metadata.originalPrompt}
                    </p>
                  </div>
                )}
                {item.metadata.editHistory && item.metadata.editHistory.length > 0 && (
                  <div>
                    <span className="font-medium">Edit History:</span>
                    <div className="mt-1 space-y-2">
                      {item.metadata.editHistory.map((edit, index) => (
                        <div key={index} className="bg-slate-50 p-2 rounded text-xs">
                          <p className="font-medium">Edit {index + 1}: {edit.editPrompt}</p>
                          <p className="text-slate-500">{formatDate(edit.timestamp)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleDownload}>
              <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
          <Button variant="destructive" onClick={handleDelete}>
            <TrashIcon className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Download Modal */}
      {showDownloadModal && (
        <DownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          imageUrl={item.imageUrl}
          filename={`${(item.title || 'image').toLowerCase().replace(/\s+/g, '-')}.png`}
          title={`Download ${item.title || 'Image'}`}
        />
      )}
    </Modal>
  );
};

const HistoryView: React.FC<HistoryViewProps> = ({ userId, onClose, onImageSelect }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleItemClick = (item: HistoryItem) => {
    setSelectedItem(item);
    onImageSelect?.(item);
  };

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
              {historyItems.map((item) => (
                <div
                  key={item._id}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => handleItemClick(item)}
                >
                  {/* Image */}
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title || 'Generated image'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
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
                    <h3 className="font-medium text-slate-800 text-sm mb-1 truncate">
                      {item.title || 'Generated Image'}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                      {item.prompt}
                    </p>
                    
                    {/* Enhanced metadata display */}
                    <div className="space-y-1 mb-2">
                      {item.metadata?.model && (
                        <div className="flex items-center text-xs text-slate-400">
                          <span className="font-medium mr-1">Model:</span>
                          <span className="truncate">{item.metadata.model.split('/').pop()}</span>
                        </div>
                      )}
                      {item.metadata?.editHistory && item.metadata.editHistory.length > 0 && (
                        <div className="flex items-center text-xs text-amber-600">
                          <span className="font-medium mr-1">Edited:</span>
                          <span>{item.metadata.editHistory.length} time{item.metadata.editHistory.length > 1 ? 's' : ''}</span>
                        </div>
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

      {/* Detail Modal */}
      {selectedItem && (
        <HistoryItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default HistoryView;