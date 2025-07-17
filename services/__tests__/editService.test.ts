import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditService, EditRequest, EditResult, BulkEditResult } from '../editService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EditService', () => {
  let editService: EditService;

  beforeEach(() => {
    vi.clearAllMocks();
    editService = new EditService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('editImage', () => {
    const validRequest: EditRequest = {
      prompt: 'Change the color to blue',
      inputImage: 'https://example.com/image.jpg',
      outputFormat: 'png',
      numInferenceSteps: 30,
    };

    it('should successfully edit an image', async () => {
      const mockResponse = { url: 'https://example.com/edited-image.jpg' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await editService.editImage(validRequest);

      expect(mockFetch).toHaveBeenCalledWith('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: validRequest.prompt,
          input_image: validRequest.inputImage,
          output_format: validRequest.outputFormat,
          num_inference_steps: validRequest.numInferenceSteps,
        }),
      });

      expect(result).toEqual({
        success: true,
        imageUrl: mockResponse.url,
      });
    });

    it('should handle API errors gracefully', async () => {
      const errorResponse = { error: 'API Error', details: 'Something went wrong' };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve(errorResponse),
      });

      const result = await editService.editImage(validRequest);

      expect(result).toEqual({
        success: false,
        error: 'Something went wrong',
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await editService.editImage(validRequest);

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      const result = await editService.editImage(validRequest);

      expect(result).toEqual({
        success: false,
        error: 'Invalid response from edit endpoint: missing or invalid URL',
      });
    });

    it('should use default parameters when not provided', async () => {
      const minimalRequest: EditRequest = {
        prompt: 'Change the color to blue',
        inputImage: 'https://example.com/image.jpg',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/edited.jpg' }),
      });

      await editService.editImage(minimalRequest);

      expect(mockFetch).toHaveBeenCalledWith('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: minimalRequest.prompt,
          input_image: minimalRequest.inputImage,
          output_format: 'png',
          num_inference_steps: 30,
        }),
      });
    });
  });

  describe('editMultipleImages', () => {
    const requests: EditRequest[] = [
      { prompt: 'Change to red', inputImage: 'https://example.com/image1.jpg' },
      { prompt: 'Change to blue', inputImage: 'https://example.com/image2.jpg' },
      { prompt: 'Change to green', inputImage: 'https://example.com/image3.jpg' },
    ];

    it('should edit multiple images sequentially', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://example.com/edited1.jpg' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://example.com/edited2.jpg' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://example.com/edited3.jpg' }),
        });

      const result = await editService.editMultipleImages(requests);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].imageUrl).toBe('https://example.com/edited1.jpg');
    });

    it('should handle mixed success and failure results', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://example.com/edited1.jpg' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://example.com/edited3.jpg' }),
        });

      const result = await editService.editMultipleImages(requests);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(result.results[1].success).toBe(false);
    });

    it('should call progress callback during processing', async () => {
      const progressCallback = vi.fn();
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/edited.jpg' }),
      });

      await editService.editMultipleImages(requests, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(4); // 3 during + 1 final
      expect(progressCallback).toHaveBeenCalledWith({
        total: 3,
        completed: 0,
        current: 'Editing image 1 of 3',
      });
      expect(progressCallback).toHaveBeenLastCalledWith({
        total: 3,
        completed: 3,
        current: 'Completed',
      });
    });
  });

  describe('editMultipleImagesParallel', () => {
    const requests: EditRequest[] = [
      { prompt: 'Change to red', inputImage: 'https://example.com/image1.jpg' },
      { prompt: 'Change to blue', inputImage: 'https://example.com/image2.jpg' },
    ];

    it('should edit multiple images in parallel', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/edited.jpg' }),
      });

      const result = await editService.editMultipleImagesParallel(requests, 2);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateEditRequest', () => {
    it('should validate a correct request', () => {
      const validRequest: EditRequest = {
        prompt: 'Change the color to blue',
        inputImage: 'https://example.com/image.jpg',
      };

      const result = editService.validateEditRequest(validRequest);
      expect(result.valid).toBe(true);
    });

    it('should reject request without prompt', () => {
      const invalidRequest: EditRequest = {
        prompt: '',
        inputImage: 'https://example.com/image.jpg',
      };

      const result = editService.validateEditRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Edit prompt is required');
    });

    it('should reject request without input image', () => {
      const invalidRequest: EditRequest = {
        prompt: 'Change color',
        inputImage: '',
      };

      const result = editService.validateEditRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input image is required');
    });

    it('should reject invalid image URL', () => {
      const invalidRequest: EditRequest = {
        prompt: 'Change color',
        inputImage: 'invalid-url',
      };

      const result = editService.validateEditRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input image must be a valid URL or data URL');
    });

    it('should reject prompt that is too long', () => {
      const invalidRequest: EditRequest = {
        prompt: 'a'.repeat(1001),
        inputImage: 'https://example.com/image.jpg',
      };

      const result = editService.validateEditRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Edit prompt is too long (max 1000 characters)');
    });

    it('should reject invalid output format', () => {
      const invalidRequest: EditRequest = {
        prompt: 'Change color',
        inputImage: 'https://example.com/image.jpg',
        outputFormat: 'gif' as any,
      };

      const result = editService.validateEditRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Output format must be jpg or png');
    });

    it('should reject invalid inference steps', () => {
      const invalidRequest: EditRequest = {
        prompt: 'Change color',
        inputImage: 'https://example.com/image.jpg',
        numInferenceSteps: 150,
      };

      const result = editService.validateEditRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Number of inference steps must be between 1 and 100');
    });
  });

  describe('getSuggestedPrompts', () => {
    it('should return an array of suggested prompts', () => {
      const prompts = editService.getSuggestedPrompts();
      
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts).toContain('Change the background to a solid white');
    });
  });

  describe('generateContextualPrompts', () => {
    it('should return base prompts when no context provided', () => {
      const prompts = editService.generateContextualPrompts();
      const basePrompts = editService.getSuggestedPrompts();
      
      expect(prompts).toEqual(basePrompts);
    });

    it('should include fashion-specific prompts for fashion context', () => {
      const prompts = editService.generateContextualPrompts('fashion clothing garment');
      
      expect(prompts).toContain('Change the garment color to red');
      expect(prompts).toContain('Make the fabric look more luxurious');
    });

    it('should include portrait-specific prompts for portrait context', () => {
      const prompts = editService.generateContextualPrompts('portrait person face');
      
      expect(prompts).toContain('Improve skin tone and texture');
      expect(prompts).toContain('Add professional studio lighting');
    });

    it('should limit results to 10 prompts', () => {
      const prompts = editService.generateContextualPrompts('fashion portrait');
      
      expect(prompts.length).toBeLessThanOrEqual(10);
    });
  });
});