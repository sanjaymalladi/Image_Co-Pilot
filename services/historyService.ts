import { ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { createImageStorageService, ImageStorageService } from "./imageStorageService";

export interface HistoryItem {
  _id: Id<"history">;
  userId: string;
  prompt: string;
  imageUrl: string;
  title?: string;
  aspectRatio: string;
  metadata?: {
    model: string;
    originalPrompt?: string;
    refinedPrompt?: string;
    editHistory?: Array<{
      editPrompt: string;
      resultUrl: string;
      timestamp: number;
    }>;
  };
  createdAt: number;
}

export interface SaveHistoryItemRequest {
  userId: string;
  prompt: string;
  imageUrl: string;
  title?: string;
  aspectRatio: string;
  metadata?: {
    model: string;
    originalPrompt?: string;
    refinedPrompt?: string;
    editHistory?: Array<{
      editPrompt: string;
      resultUrl: string;
      timestamp: number;
    }>;
  };
}

export class HistoryService {
  private imageStorageService: ImageStorageService;

  constructor(private convex: ConvexReactClient) {
    this.imageStorageService = createImageStorageService(convex);
  }

  /**
   * Get all history items for a user, ordered by creation date (newest first)
   */
  async getHistory(userId: string): Promise<HistoryItem[]> {
    try {
      const history = await this.convex.query(api.history.getUserHistory, { userId });
      return history;
    } catch (error) {
      console.error('Failed to fetch history:', error);
      throw new Error('Failed to load history. Please check your connection and try again.');
    }
  }

  /**
   * Get a specific history item by ID
   */
  async getHistoryItem(id: Id<"history">): Promise<HistoryItem | null> {
    try {
      const item = await this.convex.query(api.history.getHistoryItem, { id });
      return item;
    } catch (error) {
      console.error('Failed to fetch history item:', error);
      throw new Error('Failed to load history item.');
    }
  }

  /**
   * Save a new history item
   * Automatically stores temporary images permanently in Convex
   */
  async saveToHistory(item: SaveHistoryItemRequest): Promise<Id<"history">> {
    try {
      let finalImageUrl = item.imageUrl;
      
      // Check if the image URL is temporary (from Replicate) and store it permanently
      if (this.imageStorageService.isTemporaryUrl(item.imageUrl)) {
        console.log('Storing temporary image permanently:', item.imageUrl);
        try {
          finalImageUrl = await this.imageStorageService.storeImageFromUrl(
            item.imageUrl,
            `${item.title || 'image'}_${Date.now()}.png`
          );
          console.log('Image stored permanently:', finalImageUrl);
        } catch (storageError) {
          console.warn('Failed to store image permanently, using original URL:', storageError);
          // Continue with original URL if storage fails
        }
      }

      // Save to history with the permanent URL
      const historyId = await this.convex.mutation(api.history.saveHistoryItem, {
        ...item,
        imageUrl: finalImageUrl,
      });
      
      return historyId;
    } catch (error) {
      console.error('Failed to save to history:', error);
      throw new Error('Failed to save to history. Please try again.');
    }
  }

  /**
   * Delete a history item
   */
  async deleteFromHistory(id: Id<"history">): Promise<void> {
    try {
      await this.convex.mutation(api.history.deleteHistoryItem, { id });
    } catch (error) {
      console.error('Failed to delete history item:', error);
      throw new Error('Failed to delete history item. Please try again.');
    }
  }

  /**
   * Update a history item with edit history
   * Automatically stores temporary edit result images permanently
   */
  async updateHistoryWithEdit(
    id: Id<"history">, 
    editHistory: Array<{
      editPrompt: string;
      resultUrl: string;
      timestamp: number;
    }>
  ): Promise<void> {
    try {
      // Process edit history to store temporary URLs permanently
      const processedEditHistory = await Promise.all(
        editHistory.map(async (edit) => {
          let finalResultUrl = edit.resultUrl;
          
          // Check if the result URL is temporary and store it permanently
          if (this.imageStorageService.isTemporaryUrl(edit.resultUrl)) {
            console.log('Storing temporary edit result permanently:', edit.resultUrl);
            try {
              finalResultUrl = await this.imageStorageService.storeImageFromUrl(
                edit.resultUrl,
                `edit_${edit.timestamp}.png`
              );
              console.log('Edit result stored permanently:', finalResultUrl);
            } catch (storageError) {
              console.warn('Failed to store edit result permanently, using original URL:', storageError);
              // Continue with original URL if storage fails
            }
          }
          
          return {
            ...edit,
            resultUrl: finalResultUrl,
          };
        })
      );

      await this.convex.mutation(api.history.updateHistoryItem, { 
        id, 
        editHistory: processedEditHistory 
      });
    } catch (error) {
      console.error('Failed to update history item:', error);
      throw new Error('Failed to update history item. Please try again.');
    }
  }

  /**
   * Check if history is empty for a user
   */
  async isHistoryEmpty(userId: string): Promise<boolean> {
    try {
      const history = await this.getHistory(userId);
      return history.length === 0;
    } catch (error) {
      // If we can't fetch history, assume it's not empty to avoid showing wrong state
      console.error('Failed to check if history is empty:', error);
      return false;
    }
  }

  /**
   * Get recent history items (last N items)
   */
  async getRecentHistory(userId: string, limit: number = 10): Promise<HistoryItem[]> {
    try {
      const history = await this.getHistory(userId);
      return history.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch recent history:', error);
      throw new Error('Failed to load recent history.');
    }
  }
}

// Create a singleton instance
let historyServiceInstance: HistoryService | null = null;

export const createHistoryService = (convex: ConvexReactClient): HistoryService => {
  if (!historyServiceInstance) {
    historyServiceInstance = new HistoryService(convex);
  }
  return historyServiceInstance;
};

export const getHistoryService = (): HistoryService => {
  if (!historyServiceInstance) {
    throw new Error('HistoryService not initialized. Call createHistoryService first.');
  }
  return historyServiceInstance;
};