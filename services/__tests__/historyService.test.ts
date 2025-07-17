import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryService, SaveHistoryItemRequest } from '../historyService';
import { ConvexReactClient } from 'convex/react';

// Mock ConvexReactClient
const mockConvex = {
  query: vi.fn(),
  mutation: vi.fn(),
} as unknown as ConvexReactClient;

describe('HistoryService', () => {
  let historyService: HistoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    historyService = new HistoryService(mockConvex);
  });

  describe('getHistory', () => {
    it('should fetch user history successfully', async () => {
      const mockHistory = [
        {
          _id: 'test-id-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          imageUrl: 'https://example.com/image.jpg',
          aspectRatio: '3:4',
          createdAt: Date.now(),
        },
      ];

      (mockConvex.query as any).mockResolvedValue(mockHistory);

      const result = await historyService.getHistory('user-1');

      expect(mockConvex.query).toHaveBeenCalledWith(
        expect.any(Object),
        { userId: 'user-1' }
      );
      expect(result).toEqual(mockHistory);
    });

    it('should handle fetch errors gracefully', async () => {
      (mockConvex.query as any).mockRejectedValue(new Error('Network error'));

      await expect(historyService.getHistory('user-1')).rejects.toThrow(
        'Failed to load history. Please check your connection and try again.'
      );
    });
  });

  describe('saveToHistory', () => {
    it('should save history item successfully', async () => {
      const mockId = 'new-history-id';
      const saveRequest: SaveHistoryItemRequest = {
        userId: 'user-1',
        prompt: 'Test prompt',
        imageUrl: 'https://example.com/image.jpg',
        aspectRatio: '3:4',
        title: 'Test Image',
      };

      (mockConvex.mutation as any).mockResolvedValue(mockId);

      const result = await historyService.saveToHistory(saveRequest);

      expect(mockConvex.mutation).toHaveBeenCalledWith(
        expect.any(Object),
        saveRequest
      );
      expect(result).toBe(mockId);
    });

    it('should handle save errors gracefully', async () => {
      const saveRequest: SaveHistoryItemRequest = {
        userId: 'user-1',
        prompt: 'Test prompt',
        imageUrl: 'https://example.com/image.jpg',
        aspectRatio: '3:4',
      };

      (mockConvex.mutation as any).mockRejectedValue(new Error('Save failed'));

      await expect(historyService.saveToHistory(saveRequest)).rejects.toThrow(
        'Failed to save to history. Please try again.'
      );
    });
  });

  describe('deleteFromHistory', () => {
    it('should delete history item successfully', async () => {
      (mockConvex.mutation as any).mockResolvedValue(undefined);

      await historyService.deleteFromHistory('test-id' as any);

      expect(mockConvex.mutation).toHaveBeenCalledWith(
        expect.any(Object),
        { id: 'test-id' }
      );
    });

    it('should handle delete errors gracefully', async () => {
      (mockConvex.mutation as any).mockRejectedValue(new Error('Delete failed'));

      await expect(historyService.deleteFromHistory('test-id' as any)).rejects.toThrow(
        'Failed to delete history item. Please try again.'
      );
    });
  });

  describe('isHistoryEmpty', () => {
    it('should return true for empty history', async () => {
      (mockConvex.query as any).mockResolvedValue([]);

      const result = await historyService.isHistoryEmpty('user-1');

      expect(result).toBe(true);
    });

    it('should return false for non-empty history', async () => {
      const mockHistory = [{ _id: 'test-id', userId: 'user-1' }];
      (mockConvex.query as any).mockResolvedValue(mockHistory);

      const result = await historyService.isHistoryEmpty('user-1');

      expect(result).toBe(false);
    });

    it('should return false on error to avoid wrong empty state', async () => {
      (mockConvex.query as any).mockRejectedValue(new Error('Network error'));

      const result = await historyService.isHistoryEmpty('user-1');

      expect(result).toBe(false);
    });
  });

  describe('getRecentHistory', () => {
    it('should return limited number of recent items', async () => {
      const mockHistory = Array.from({ length: 20 }, (_, i) => ({
        _id: `test-id-${i}`,
        userId: 'user-1',
        createdAt: Date.now() - i * 1000,
      }));

      (mockConvex.query as any).mockResolvedValue(mockHistory);

      const result = await historyService.getRecentHistory('user-1', 5);

      expect(result).toHaveLength(5);
      expect(result).toEqual(mockHistory.slice(0, 5));
    });
  });
});