import { ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";

export class ImageStorageService {
  constructor(private convex: ConvexReactClient) {}

  /**
   * Download an image from a URL and store it in Convex
   * Returns the Convex file storage URL
   */
  async storeImageFromUrl(imageUrl: string, filename?: string): Promise<string> {
    try {
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Generate filename if not provided
      const finalFilename = filename || `image_${Date.now()}.${this.getFileExtensionFromBlob(blob)}`;
      
      // Convert blob to File
      const file = new File([blob], finalFilename, { type: blob.type });
      
      // Get upload URL from Convex
      const uploadUrl = await this.convex.mutation(api.files.generateUploadUrl);
      
      // Upload the file
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: file,
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
      }
      
      const { storageId } = await uploadResponse.json();
      
      // Get the public URL
      const publicUrl = await this.convex.query(api.files.getUrl, { storageId });
      
      return publicUrl;
    } catch (error) {
      console.error('Failed to store image:', error);
      throw new Error('Failed to store image permanently. Please try again.');
    }
  }

  /**
   * Get file extension from blob type
   */
  private getFileExtensionFromBlob(blob: Blob): string {
    const mimeType = blob.type;
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      default:
        return 'png'; // Default fallback
    }
  }

  /**
   * Check if a URL is a temporary Replicate URL
   */
  isTemporaryUrl(url: string): boolean {
    return url.includes('replicate.delivery') || url.includes('pbxt.replicate.delivery');
  }
}

// Create a singleton instance
let imageStorageServiceInstance: ImageStorageService | null = null;

export const createImageStorageService = (convex: ConvexReactClient): ImageStorageService => {
  if (!imageStorageServiceInstance) {
    imageStorageServiceInstance = new ImageStorageService(convex);
  }
  return imageStorageServiceInstance;
};

export const getImageStorageService = (): ImageStorageService => {
  if (!imageStorageServiceInstance) {
    throw new Error('ImageStorageService not initialized. Call createImageStorageService first.');
  }
  return imageStorageServiceInstance;
};