// @ts-nocheck

import { 
  generateFashionAnalysisAndInitialJsonPrompt,
  performQaAndGenerateStudioPrompts 
} from '../geminiService';
import { PhotoshootType } from '../../types/photoshoot';

// Mock the Google GenAI
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn()
    }
  }))
}));

// Mock the replicate service
jest.mock('../replicateService', () => ({
  generateImageViaReplicate: jest.fn()
}));

describe('Gemini Service - Photoshoot Type Awareness', () => {
  const mockGarmentImages = [
    { base64: 'mock-base64-1', mimeType: 'image/jpeg' },
    { base64: 'mock-base64-2', mimeType: 'image/jpeg' }
  ];

  const mockProductImages = [
    { base64: 'mock-base64-product', mimeType: 'image/jpeg' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API response
    const { GoogleGenAI } = require('@google/genai');
    const mockGenerateContent = jest.fn().mockResolvedValue({
      text: JSON.stringify({
        garmentAnalysis: 'Mock garment analysis',
        productAnalysis: 'Mock product analysis',
        qaChecklist: 'Mock QA checklist',
        initialJsonPrompt: 'Mock initial prompt'
      })
    });
    
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent
      }
    }));
  });

  describe('generateFashionAnalysisAndInitialJsonPrompt', () => {
    it('should generate garment-specific prompts for garment photoshoot type', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      await generateFashionAnalysisAndInitialJsonPrompt(
        mockGarmentImages,
        undefined,
        undefined,
        'garment'
      );

      const callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      
      // Check that the system instruction contains garment-specific language
      expect(callArgs.config.systemInstruction).toContain('fashion image prompting');
      expect(callArgs.config.systemInstruction).toContain('garment');
      expect(callArgs.config.systemInstruction).toContain('Garment type');
      expect(callArgs.config.systemInstruction).toContain('fabric type');
      expect(callArgs.config.systemInstruction).toContain('neckline');
      
      // Check that the parts contain garment-specific labels
      const textParts = callArgs.contents.parts.filter(part => part.text);
      expect(textParts.some(part => part.text.includes('Input Garment Image'))).toBe(true);
      expect(textParts.some(part => part.text.includes('garment analysis'))).toBe(true);
    });

    it('should generate product-specific prompts for product photoshoot type', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      await generateFashionAnalysisAndInitialJsonPrompt(
        mockProductImages,
        undefined,
        undefined,
        'product'
      );

      const callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      
      // Check that the system instruction contains product-specific language
      expect(callArgs.config.systemInstruction).toContain('product image prompting');
      expect(callArgs.config.systemInstruction).toContain('product');
      expect(callArgs.config.systemInstruction).toContain('Product type and category');
      expect(callArgs.config.systemInstruction).toContain('materials and construction');
      expect(callArgs.config.systemInstruction).toContain('functionality');
      
      // Check that the parts contain product-specific labels
      const textParts = callArgs.contents.parts.filter(part => part.text);
      expect(textParts.some(part => part.text.includes('Input Product Image'))).toBe(true);
      expect(textParts.some(part => part.text.includes('product analysis'))).toBe(true);
    });

    it('should handle validation errors with appropriate item names', async () => {
      // Test with empty images array for garment
      await expect(
        generateFashionAnalysisAndInitialJsonPrompt([], undefined, undefined, 'garment')
      ).rejects.toThrow('Please provide 1 or 2 garment images.');

      // Test with empty images array for product
      await expect(
        generateFashionAnalysisAndInitialJsonPrompt([], undefined, undefined, 'product')
      ).rejects.toThrow('Please provide 1 or 2 product images.');
    });

    it('should default to garment type when no photoshoot type is provided', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      await generateFashionAnalysisAndInitialJsonPrompt(mockGarmentImages);

      const callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      
      // Should default to garment-specific prompts
      expect(callArgs.config.systemInstruction).toContain('fashion image prompting');
      expect(callArgs.config.systemInstruction).toContain('garment');
    });

    it('should handle two-image scenarios with appropriate item names', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      // Test with garment type
      await generateFashionAnalysisAndInitialJsonPrompt(
        mockGarmentImages,
        undefined,
        undefined,
        'garment'
      );

      let callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      expect(callArgs.config.systemInstruction).toContain('two garment images');
      expect(callArgs.config.systemInstruction).toContain('same garment');
      expect(callArgs.config.systemInstruction).toContain('two distinct garments');

      // Clear mocks and test with product type
      jest.clearAllMocks();
      
      await generateFashionAnalysisAndInitialJsonPrompt(
        mockProductImages.concat(mockProductImages),
        undefined,
        undefined,
        'product'
      );

      callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      expect(callArgs.config.systemInstruction).toContain('two product images');
      expect(callArgs.config.systemInstruction).toContain('same product');
      expect(callArgs.config.systemInstruction).toContain('two distinct products');
    });
  });

  describe('performQaAndGenerateStudioPrompts', () => {
    const mockAnalysisData = {
      garmentAnalysis: 'Mock analysis',
      qaChecklist: 'Mock checklist',
      initialJsonPrompt: 'Mock prompt'
    };

    const mockGeneratedImage = {
      base64: 'mock-generated-base64',
      mimeType: 'image/jpeg'
    };

    it('should generate garment-specific QA prompts for garment photoshoot type', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      // Mock QA response
      mockInstance.models.generateContent.mockResolvedValue({
        text: JSON.stringify([
          { title: 'Studio Front View', prompt: 'Mock studio prompt' },
          { title: 'Studio Back View', prompt: 'Mock back prompt' }
        ])
      });

      await performQaAndGenerateStudioPrompts(
        mockGarmentImages,
        mockGeneratedImage,
        mockAnalysisData,
        'garment'
      );

      const callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      
      // Check that the system instruction contains garment-specific QA language
      expect(callArgs.config.systemInstruction).toContain('fashion QA expert');
      expect(callArgs.config.systemInstruction).toContain('garment image(s)');
      expect(callArgs.config.systemInstruction).toContain('garment analysis');
      expect(callArgs.config.systemInstruction).toContain('fabric weave differences');
      expect(callArgs.config.systemInstruction).toContain('neckline shape');
      expect(callArgs.config.systemInstruction).toContain('sleeve style');
    });

    it('should generate product-specific QA prompts for product photoshoot type', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      // Mock QA response
      mockInstance.models.generateContent.mockResolvedValue({
        text: JSON.stringify([
          { title: 'Studio Product View', prompt: 'Mock product studio prompt' },
          { title: 'Studio Detail View', prompt: 'Mock detail prompt' }
        ])
      });

      await performQaAndGenerateStudioPrompts(
        mockProductImages,
        mockGeneratedImage,
        mockAnalysisData,
        'product'
      );

      const callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      
      // Check that the system instruction contains product-specific QA language
      expect(callArgs.config.systemInstruction).toContain('product QA expert');
      expect(callArgs.config.systemInstruction).toContain('product image(s)');
      expect(callArgs.config.systemInstruction).toContain('product analysis');
      expect(callArgs.config.systemInstruction).toContain('material finish differences');
      expect(callArgs.config.systemInstruction).toContain('feature inaccuracies');
      expect(callArgs.config.systemInstruction).toContain('functionality representation');
    });

    it('should default to garment type when no photoshoot type is provided', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      // Mock QA response
      mockInstance.models.generateContent.mockResolvedValue({
        text: JSON.stringify([
          { title: 'Studio Front View', prompt: 'Mock studio prompt' }
        ])
      });

      await performQaAndGenerateStudioPrompts(
        mockGarmentImages,
        mockGeneratedImage,
        mockAnalysisData
      );

      const callArgs = mockInstance.models.generateContent.mock.calls[0][0];
      
      // Should default to garment-specific QA prompts
      expect(callArgs.config.systemInstruction).toContain('fashion QA expert');
      expect(callArgs.config.systemInstruction).toContain('garment');
    });
  });

  describe('Error Handling', () => {
    it('should provide photoshoot-type-specific error messages', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      // Mock API error
      mockInstance.models.generateContent.mockRejectedValue(new Error('API Error'));

      // Test garment error message
      await expect(
        generateFashionAnalysisAndInitialJsonPrompt(mockGarmentImages, undefined, undefined, 'garment')
      ).rejects.toThrow('Failed to generate garment analysis from Gemini API');

      // Test product error message
      await expect(
        generateFashionAnalysisAndInitialJsonPrompt(mockProductImages, undefined, undefined, 'product')
      ).rejects.toThrow('Failed to generate product analysis from Gemini API');
    });

    it('should handle JSON parsing errors with appropriate item names', async () => {
      const { GoogleGenAI } = require('@google/genai');
      const mockInstance = new GoogleGenAI();
      
      // Mock invalid JSON response
      mockInstance.models.generateContent.mockResolvedValue({
        text: 'invalid json'
      });

      // Test garment JSON error
      await expect(
        generateFashionAnalysisAndInitialJsonPrompt(mockGarmentImages, undefined, undefined, 'garment')
      ).rejects.toThrow('Failed to parse garment analysis');

      // Test product JSON error
      await expect(
        generateFashionAnalysisAndInitialJsonPrompt(mockProductImages, undefined, undefined, 'product')
      ).rejects.toThrow('Failed to parse product analysis');
    });
  });
});