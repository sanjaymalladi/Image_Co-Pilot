// Photoshoot type definitions and utilities

export type PhotoshootType = 'garment' | 'product';

export interface PhotoshootLabels {
  uploadMainLabel: string;
  uploadMainDescription: string;
  analysisTitle: string;
  mainItemName: string; // "garment" or "product"
  studioDescription: string;
  lifestyleDescription: string;
  marketingDescription: string;
  generateButtonText: string;
  analysisButtonText: string;
  qaButtonText: string;
  errorUploadMessage: string;
}

export interface PhotoshootConfig {
  type: PhotoshootType;
  labels: PhotoshootLabels;
  promptTemplates: {
    analysisTemplate: string;
    studioTemplate: string;
    lifestyleTemplate: string;
  };
}

// Updated interface to replace FashionPromptData
export interface PromptData {
  itemAnalysis: string; // renamed from garmentAnalysis
  qaChecklist: string;
  initialJsonPrompt: string;
  photoshootType: PhotoshootType; // new field
}

/**
 * Get contextually appropriate labels based on photoshoot type
 */
export const getPhotoshootLabels = (type: PhotoshootType): PhotoshootLabels => {
  if (type === 'garment') {
    return {
      uploadMainLabel: 'Upload Garment Images',
      uploadMainDescription: 'Upload 1-2 images of the garment you want to photograph',
      analysisTitle: 'Garment Analysis',
      mainItemName: 'garment',
      studioDescription: 'Professional studio shots with clean backgrounds',
      lifestyleDescription: 'Lifestyle shots showing the garment in real-world contexts',
      marketingDescription: 'Creative marketing shots for fashion campaigns',
      generateButtonText: 'Generate Garment Analysis',
      analysisButtonText: 'Analyze Garment',
      qaButtonText: 'Generate QA & Refine Prompts',
      errorUploadMessage: 'Please upload 1 or 2 garment image(s).'
    };
  } else {
    return {
      uploadMainLabel: 'Upload Product Images',
      uploadMainDescription: 'Upload 1-2 images of the product you want to photograph',
      analysisTitle: 'Product Analysis',
      mainItemName: 'product',
      studioDescription: 'Professional studio shots highlighting product features',
      lifestyleDescription: 'Lifestyle shots showing the product in use scenarios',
      marketingDescription: 'Viral-worthy marketing shots with dramatic angles and creative compositions',
      generateButtonText: 'Generate Product Analysis',
      analysisButtonText: 'Analyze Product',
      qaButtonText: 'Generate QA & Refine Prompts',
      errorUploadMessage: 'Please upload 1 or 2 product image(s).'
    };
  }
};

/**
 * Get photoshoot configuration including labels and templates
 */
export const getPhotoshootConfig = (type: PhotoshootType): PhotoshootConfig => {
  const labels = getPhotoshootLabels(type);
  
  return {
    type,
    labels,
    promptTemplates: {
      analysisTemplate: type === 'garment' 
        ? 'fashion_garment_analysis'
        : 'product_analysis',
      studioTemplate: type === 'garment'
        ? 'fashion_studio_template'
        : 'product_studio_template',
      lifestyleTemplate: type === 'garment'
        ? 'fashion_lifestyle_template'
        : 'product_lifestyle_template'
    }
  };
};

/**
 * Validate photoshoot type
 */
export const isValidPhotoshootType = (type: string): type is PhotoshootType => {
  return type === 'garment' || type === 'product';
};

/**
 * Get default photoshoot type
 */
export const getDefaultPhotoshootType = (): PhotoshootType => 'garment';