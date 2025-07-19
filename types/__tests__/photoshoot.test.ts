import { 
  getPhotoshootLabels, 
  getPhotoshootConfig, 
  isValidPhotoshootType, 
  getDefaultPhotoshootType,
  PhotoshootType 
} from '../photoshoot';

describe('Photoshoot Utilities', () => {
  describe('getPhotoshootLabels', () => {
    it('should return garment-specific labels for garment type', () => {
      const labels = getPhotoshootLabels('garment');
      
      expect(labels.uploadMainLabel).toBe('Upload Garment Images');
      expect(labels.uploadMainDescription).toBe('Upload 1-2 images of the garment you want to photograph');
      expect(labels.analysisTitle).toBe('Garment Analysis');
      expect(labels.mainItemName).toBe('garment');
      expect(labels.studioDescription).toBe('Professional studio shots with clean backgrounds');
      expect(labels.lifestyleDescription).toBe('Lifestyle shots showing the garment in real-world contexts');
      expect(labels.generateButtonText).toBe('Generate Garment Analysis');
      expect(labels.analysisButtonText).toBe('Analyze Garment');
      expect(labels.qaButtonText).toBe('Generate QA & Refine Prompts');
      expect(labels.errorUploadMessage).toBe('Please upload 1 or 2 garment image(s).');
    });

    it('should return product-specific labels for product type', () => {
      const labels = getPhotoshootLabels('product');
      
      expect(labels.uploadMainLabel).toBe('Upload Product Images');
      expect(labels.uploadMainDescription).toBe('Upload 1-2 images of the product you want to photograph');
      expect(labels.analysisTitle).toBe('Product Analysis');
      expect(labels.mainItemName).toBe('product');
      expect(labels.studioDescription).toBe('Professional studio shots highlighting product features');
      expect(labels.lifestyleDescription).toBe('Lifestyle shots showing the product in use scenarios');
      expect(labels.generateButtonText).toBe('Generate Product Analysis');
      expect(labels.analysisButtonText).toBe('Analyze Product');
      expect(labels.qaButtonText).toBe('Generate QA & Refine Prompts');
      expect(labels.errorUploadMessage).toBe('Please upload 1 or 2 product image(s).');
    });
  });

  describe('getPhotoshootConfig', () => {
    it('should return complete config for garment type', () => {
      const config = getPhotoshootConfig('garment');
      
      expect(config.type).toBe('garment');
      expect(config.labels.mainItemName).toBe('garment');
      expect(config.promptTemplates.analysisTemplate).toBe('fashion_garment_analysis');
      expect(config.promptTemplates.studioTemplate).toBe('fashion_studio_template');
      expect(config.promptTemplates.lifestyleTemplate).toBe('fashion_lifestyle_template');
    });

    it('should return complete config for product type', () => {
      const config = getPhotoshootConfig('product');
      
      expect(config.type).toBe('product');
      expect(config.labels.mainItemName).toBe('product');
      expect(config.promptTemplates.analysisTemplate).toBe('product_analysis');
      expect(config.promptTemplates.studioTemplate).toBe('product_studio_template');
      expect(config.promptTemplates.lifestyleTemplate).toBe('product_lifestyle_template');
    });
  });

  describe('isValidPhotoshootType', () => {
    it('should return true for valid photoshoot types', () => {
      expect(isValidPhotoshootType('garment')).toBe(true);
      expect(isValidPhotoshootType('product')).toBe(true);
    });

    it('should return false for invalid photoshoot types', () => {
      expect(isValidPhotoshootType('invalid')).toBe(false);
      expect(isValidPhotoshootType('simple')).toBe(false);
      expect(isValidPhotoshootType('advanced')).toBe(false);
      expect(isValidPhotoshootType('')).toBe(false);
    });
  });

  describe('getDefaultPhotoshootType', () => {
    it('should return garment as default type', () => {
      expect(getDefaultPhotoshootType()).toBe('garment');
    });
  });
});