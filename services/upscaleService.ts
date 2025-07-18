export interface UpscaleRequest {
  imageUrl: string;
  scale: 2 | 4; // 2x or 4x upscaling
  outputFormat?: 'jpg' | 'png';
}

export interface UpscaleResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export class UpscaleService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Upscale an image using Real-ESRGAN or similar upscaling model
   */
  async upscaleImage(request: UpscaleRequest): Promise<UpscaleResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/upscale-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: request.imageUrl,
          scale: request.scale,
          output_format: request.outputFormat || 'png',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.url || typeof data.url !== 'string') {
        throw new Error('Invalid response from upscale endpoint: missing or invalid URL');
      }

      return {
        success: true,
        imageUrl: data.url,
      };
    } catch (error: any) {
      console.error('Upscale image error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upscale image',
      };
    }
  }

  /**
   * Validate upscale request parameters
   */
  validateUpscaleRequest(request: UpscaleRequest): { valid: boolean; error?: string } {
    if (!request.imageUrl || request.imageUrl.trim().length === 0) {
      return { valid: false, error: 'Image URL is required' };
    }

    if (!request.imageUrl.startsWith('http') && !request.imageUrl.startsWith('data:')) {
      return { valid: false, error: 'Image URL must be a valid URL or data URL' };
    }

    if (![2, 4].includes(request.scale)) {
      return { valid: false, error: 'Scale must be 2x or 4x' };
    }

    if (request.outputFormat && !['jpg', 'png'].includes(request.outputFormat)) {
      return { valid: false, error: 'Output format must be jpg or png' };
    }

    return { valid: true };
  }

  /**
   * Get estimated file size increase for upscaling
   */
  getEstimatedSizeIncrease(scale: 2 | 4): number {
    // Rough estimates based on pixel count increase
    return scale === 2 ? 4 : 16; // 2x = 4x pixels, 4x = 16x pixels
  }

  /**
   * Get estimated processing time for upscaling
   */
  getEstimatedProcessingTime(scale: 2 | 4): number {
    // Estimated time in seconds
    return scale === 2 ? 15 : 45; // 2x takes ~15s, 4x takes ~45s
  }
}

// Create singleton instance
let upscaleServiceInstance: UpscaleService | null = null;

export const createUpscaleService = (baseUrl?: string): UpscaleService => {
  if (!upscaleServiceInstance) {
    upscaleServiceInstance = new UpscaleService(baseUrl);
  }
  return upscaleServiceInstance;
};

export const getUpscaleService = (): UpscaleService => {
  if (!upscaleServiceInstance) {
    upscaleServiceInstance = new UpscaleService();
  }
  return upscaleServiceInstance;
};