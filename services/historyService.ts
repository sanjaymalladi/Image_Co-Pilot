import { ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

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
  constructor(private convex: ConvexReactClient) {}

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
   */
  async saveToHistory(item: SaveHistoryItemRequest): Promise<Id<"history">> {
    try {
      const historyId = await this.convex.mutation(api.history.saveHistoryItem, item);
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
      await this.convex.mutation(api.history.updateHistoryItem, { 
        id, 
        editHistory 
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