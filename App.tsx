// @ts-nocheck

import React, { useState, useCallback, ChangeEvent, useEffect, DragEvent } from 'react';
import { generateFashionAnalysisAndInitialJsonPrompt, performQaAndGenerateStudioPrompts, generateSingleImage, generateInitialQaImage, generateImagePack, generateViralMarketingPrompts } from './services/geminiService';
import { generateImageViaReplicate } from './services/replicateService';
import { fileToBase64WithType } from './utils/fileUtils';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { Alert } from './components/Alert';
import { XCircleIcon, WandSparklesIcon, SparklesIcon, UploadIcon, ClipboardIcon, CheckIcon, PlaceholderIcon, ArrowDownTrayIcon, ClockIcon } from './components/Icons';
import { ShoppingBagIcon as GarmentIcon, PhotoIcon as BackgroundIcon, UserIcon as ModelIcon } from '@heroicons/react/24/outline';
import { SignedIn, SignedOut, UserButton, SignInButton, useUser } from '@clerk/clerk-react';
import HistoryView from './components/HistoryView';
import EditChatInterface from './components/EditChatInterface';
import ImageSelector from './components/ImageSelector';
import ErrorBoundary from './components/ErrorBoundary';
import { createHistoryService } from './services/historyService';
import { getProgressService, GenerationProgress } from './services/progressService';
import DownloadModal from './components/DownloadModal';
import FullScreenImageModal from './components/FullScreenImageModal';
import { PhotoshootToggle } from './components/PhotoshootToggle';
import { PhotoshootType, getPhotoshootLabels, getDefaultPhotoshootType, PromptData } from './types/photoshoot';
import convex from './lib/convex';

type AppMode = 'generation' | 'history';

// Keep FashionPromptData for backward compatibility during transition
export interface FashionPromptData {
  garmentAnalysis: string;
  qaChecklist: string;
  initialJsonPrompt: string;
}

export interface RefinedPromptItem {
  id: string;
  title: string;
  prompt: string;
  isCopied: boolean;
  error?: string;
  imageUrl?: string;
  isLoadingImage: boolean;
  aspectRatio: string;
}

const App: React.FC = () => {
  const [photoshootType, setPhotoshootType] = useState<PhotoshootType>(getDefaultPhotoshootType());
  const [appMode, setAppMode] = useState<AppMode>('generation');
  const { user } = useUser();

  // Initialize history service
  const historyService = createHistoryService(convex);

  // Helper function to save images to history
  const saveToHistory = async (imageUrl: string, prompt: string, title: string, aspectRatio: string = '3:4') => {
    if (!user) return;

    try {
      await historyService.saveToHistory({
        userId: user.id,
        prompt,
        imageUrl,
        title,
        aspectRatio,
        metadata: {
          model: 'flux-kontext-apps/multi-image-list',
          originalPrompt: prompt,
        },
      });
    } catch (error) {
      console.error('Failed to save to history:', error);
      // Don't show error to user as this is background operation
    }
  };

  const [fashionGarmentFiles, setFashionGarmentFiles] = useState<File[]>([]);
  const [fashionGarmentPreviewUrls, setFashionGarmentPreviewUrls] = useState<string[]>([]);
  const [fashionBackgroundRefFiles, setFashionBackgroundRefFiles] = useState<File[]>([]);
  const [fashionBackgroundRefPreviewUrls, setFashionBackgroundRefPreviewUrls] = useState<string[]>([]);
  const [fashionModelRefFiles, setFashionModelRefFiles] = useState<File[]>([]);
  const [fashionModelRefPreviewUrls, setFashionModelRefPreviewUrls] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fashionPromptData, setFashionPromptData] = useState<FashionPromptData | null>(null);
  const [fashionInitialJsonPromptCopied, setFashionInitialJsonPromptCopied] = useState<boolean>(false);

  const [generatedFashionImageFile, setGeneratedFashionImageFile] = useState<File | null>(null);
  const [generatedFashionImagePreviewUrl, setGeneratedFashionImagePreviewUrl] = useState<string | null>(null);
  const [refinedPrompts, setRefinedPrompts] = useState<RefinedPromptItem[]>([]);

  // Stores the very first generated front-view image so we can feed it back as a reference
  const [firstImageUrl, setFirstImageUrl] = useState<string | null>(null);

  const [isDevMode, setIsDevMode] = useState<boolean>(false);

  // Add new state for pack selection
  const [selectedPacks, setSelectedPacks] = useState<{
    studio: boolean;
    lifestyle: boolean;
    marketing: boolean;
  }>({
    studio: false,
    lifestyle: false,
    marketing: false
  });

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [showImageSelector, setShowImageSelector] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<'single' | 'multiple'>('multiple');
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);

  // Progress tracking state
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const progressService = getProgressService();

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadImageUrl, setDownloadImageUrl] = useState<string>('');
  const [downloadFilename, setDownloadFilename] = useState<string>('');
  const [downloadTitle, setDownloadTitle] = useState<string>('');

  // Full-screen modal state
  const [showFullScreenModal, setShowFullScreenModal] = useState(false);
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState(0);

  // Full-screen modal handlers
  const handleImageClick = (index: number) => {
    const validImages = refinedPrompts.filter(item => item.imageUrl);
    if (validImages.length === 0) return;

    const actualIndex = refinedPrompts.findIndex(item => item.imageUrl && refinedPrompts.indexOf(item) >= index);
    setFullScreenImageIndex(actualIndex >= 0 ? actualIndex : 0);
    setShowFullScreenModal(true);
  };

  const handleFullScreenImageChange = (newIndex: number) => {
    setFullScreenImageIndex(newIndex);
  };

  const handleFullScreenImageUpdate = (updatedImage: RefinedPromptItem) => {
    setRefinedPrompts(prev => prev.map(item =>
      item.id === updatedImage.id ? updatedImage : item
    ));
  };

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = progressService.onProgress((progress) => {
      setGenerationProgress(progress);
    });
    return unsubscribe;
  }, [progressService]);

  const MAX_FILE_SIZE_MB = 4;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const MAX_FILES_FASHION_PROMPT = 2;
  const MAX_FILES_FASHION_BACKGROUND_REF = 3;
  const MAX_FILES_FASHION_MODEL_REF = 3;

  const resetAllState = () => {
    setFashionGarmentFiles([]);
    setFashionGarmentPreviewUrls([]);
    setFashionBackgroundRefFiles([]);
    setFashionBackgroundRefPreviewUrls([]);
    setFashionModelRefFiles([]);
    setFashionModelRefPreviewUrls([]);
    setIsLoading(false);
    setError(null);
    setFashionPromptData(null);
    setFashionInitialJsonPromptCopied(false);
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setRefinedPrompts([]);
    setIsDevMode(false);
    setFirstImageUrl(null);
    setSelectedPacks({ studio: false, lifestyle: false, marketing: false });
    // Reset progress tracking
    progressService.resetProgress();
  };

  const handlePhotoshootTypeChange = (type: PhotoshootType) => {
    resetAllState();
    setPhotoshootType(type);

    // Provide visual feedback for mode change
    const labels = getPhotoshootLabels(type);
    // Could add a toast notification here in the future
    console.log(`Switched to ${labels.mainItemName} photoshoot mode`);
  }

  // Generate dynamic viral marketing prompts based on actual product analysis
  const generateMarketingPrompts = async (basePrompts: any[], analysisData: FashionPromptData) => {
    if (!analysisData || !analysisData.garmentAnalysis) {
      console.error('Invalid analysis data provided to generateMarketingPrompts');
      return [];
    }

    const productAnalysis = analysisData.garmentAnalysis; // This contains product analysis for product mode

    try {
      // Use AI to generate contextually relevant viral marketing prompts
      const marketingPrompts = await generateViralMarketingPrompts(productAnalysis, photoshootType);
      
      // Validate the result
      if (!marketingPrompts || !Array.isArray(marketingPrompts)) {
        throw new Error('Invalid marketing prompts returned from AI');
      }

      // Ensure each prompt has required fields
      const validatedPrompts = marketingPrompts.filter(prompt => 
        prompt && typeof prompt.title === 'string' && typeof prompt.prompt === 'string'
      );

      if (validatedPrompts.length === 0) {
        throw new Error('No valid marketing prompts generated');
      }

      return validatedPrompts;
    } catch (error) {
      console.error('Failed to generate dynamic marketing prompts, falling back to static ones:', error);

      // Fallback to static prompts if AI fails
      return [
        {
          title: "Marketing Viral Shot 1 - Dramatic Hero",
          prompt: `${productAnalysis} VIRAL MARKETING SHOT: Think like a real photographer - what angle would make this product look absolutely incredible? Create a dramatic hero shot that showcases the product's best features with cinematic lighting and bold composition. Make it Instagram-stopping.`
        },
        {
          title: "Marketing Viral Shot 2 - Lifestyle Magic",
          prompt: `${productAnalysis} VIRAL MARKETING SHOT: How would this product fit into someone's dream lifestyle? Create an aspirational scene that makes viewers think "I need this in my life". Show the product in its perfect natural habitat with energy and excitement.`
        },
        {
          title: "Marketing Viral Shot 3 - Minimalist Impact",
          prompt: `${productAnalysis} VIRAL MARKETING SHOT: Strip everything away except what matters. Create a clean, powerful composition that lets the product speak for itself. Think Apple-level minimalism with maximum visual impact.`
        },
        {
          title: "Marketing Viral Shot 4 - Creative Surprise",
          prompt: `${productAnalysis} VIRAL MARKETING SHOT: What's an angle or perspective no one has tried with this type of product? Create something unexpected that makes people stop and look twice. Break the rules in the best way possible.`
        }
      ];
    }
  }

  const clearSubsequentFashionStates = () => {
    setFashionPromptData(null);
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setRefinedPrompts([]);
    setFashionInitialJsonPromptCopied(false);
    setError(null);
    setFirstImageUrl(null);
  };

  const processFiles = useCallback(async (filesToProcess: FileList | File[], fileType: 'garment' | 'backgroundRef' | 'modelRef') => {
    if (!filesToProcess || filesToProcess.length === 0) return;

    let currentMaxFiles;
    let setFilesFunction: React.Dispatch<React.SetStateAction<File[]>>;

    switch (fileType) {
      case 'garment':
        currentMaxFiles = MAX_FILES_FASHION_PROMPT;
        setFilesFunction = setFashionGarmentFiles;
        break;
      case 'backgroundRef':
        currentMaxFiles = MAX_FILES_FASHION_BACKGROUND_REF;
        setFilesFunction = setFashionBackgroundRefFiles;
        break;
      case 'modelRef':
        currentMaxFiles = MAX_FILES_FASHION_MODEL_REF;
        setFilesFunction = setFashionModelRefFiles;
        break;
    }

    const newValidFiles: File[] = [];
    const rejectedFilesMessages: string[] = [];
    let currentBatchError: string | null = null;

    Array.from(filesToProcess).forEach(file => {
      if (newValidFiles.length >= currentMaxFiles) {
        rejectedFilesMessages.push(`${file.name} (limit of ${currentMaxFiles} file${currentMaxFiles > 1 ? 's' : ''} reached)`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejectedFilesMessages.push(`${file.name} (exceeds ${MAX_FILE_SIZE_MB}MB)`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        rejectedFilesMessages.push(`${file.name} (not an image)`);
        return;
      }
      newValidFiles.push(file);
    });

    setFilesFunction(newValidFiles.slice(0, currentMaxFiles));

    if (rejectedFilesMessages.length > 0) {
      currentBatchError = `Some files were not added: ${rejectedFilesMessages.join(', ')}.`;
    }
    setError(currentBatchError);

    if (fileType === 'garment') {
      clearSubsequentFashionStates();
    }
  }, []);

  useEffect(() => {
    const generatePreviews = (files: File[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      if (files.length > 0) {
        const filePromises = files.map(file =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsDataURL(file);
          })
        );
        Promise.all(filePromises).then(setter).catch(err => {
          setError(err.message || "Error creating previews.");
          setter([]);
        });
      } else {
        setter([]);
      }
    };

    generatePreviews(fashionGarmentFiles, setFashionGarmentPreviewUrls);
    generatePreviews(fashionBackgroundRefFiles, setFashionBackgroundRefPreviewUrls);
    generatePreviews(fashionModelRefFiles, setFashionModelRefPreviewUrls);
  }, [fashionGarmentFiles, fashionBackgroundRefFiles, fashionModelRefFiles]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, fileType: 'garment' | 'backgroundRef' | 'modelRef') => {
    if (event.target.files) {
      await processFiles(event.target.files, fileType);
    }
    if (event.target) {
      (event.target as HTMLInputElement).value = '';
    }
  };

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>, fileType: 'garment' | 'backgroundRef' | 'modelRef') => {
    event.preventDefault();
    event.stopPropagation();
    if (isLoading) return;

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      await processFiles(event.dataTransfer.files, fileType);
      event.dataTransfer.clearData();
    }
  }, [isLoading, processFiles]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const clearSelectedFilesForMode = (fileType: 'garment' | 'backgroundRef' | 'modelRef') => {
    if (fileType === 'garment') {
      setFashionGarmentFiles([]);
      clearSubsequentFashionStates();
    } else if (fileType === 'backgroundRef') {
      setFashionBackgroundRefFiles([]);
    } else if (fileType === 'modelRef') {
      setFashionModelRefFiles([]);
    }
    setError(null);
  };

  const handleGenerateFashionAnalysis = async () => {
    if (fashionGarmentFiles.length === 0) {
      const labels = getPhotoshootLabels(photoshootType);
      setError(labels.errorUploadMessage);
      return;
    }
    setIsLoading(true);
    setError(null);
    clearSubsequentFashionStates();

    try {
      const garmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const backgroundRefImageInputs = await Promise.all(fashionBackgroundRefFiles.map(fileToBase64WithType));
      const modelRefImageInputs = await Promise.all(fashionModelRefFiles.map(fileToBase64WithType));

      const results = await generateFashionAnalysisAndInitialJsonPrompt(garmentImageInputs, backgroundRefImageInputs.length > 0 ? backgroundRefImageInputs : undefined, modelRefImageInputs.length > 0 ? modelRefImageInputs : undefined, photoshootType);
      setFashionPromptData(results);
    } catch (err: any) {
      const labels = getPhotoshootLabels(photoshootType);
      setError(err.message || `Failed to generate ${labels.mainItemName} analysis.`);
      setFashionPromptData(null);
    }
    setIsLoading(false);
  };

  const handleGeneratedFashionImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`Generated image "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" is not a valid image type.`);
        return;
      }

      setGeneratedFashionImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setGeneratedFashionImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
      setRefinedPrompts([]);
      setError(null);
    }
  };

  const clearGeneratedFashionImage = () => {
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setRefinedPrompts([]);
    setError(null);
  };

  const handleQaAndRefinePrompts = async () => {
    if (!fashionPromptData || !generatedFashionImageFile || fashionGarmentFiles.length === 0) {
      const labels = getPhotoshootLabels(photoshootType);
      setError(`Missing data: ${labels.mainItemName.charAt(0).toUpperCase() + labels.mainItemName.slice(1)} image(s), generated QA image, or initial analysis is missing.`);
      return;
    }

    // Initialize progress tracking for streamlined mode
    const steps = progressService.getStepsForMode('simple', 'all', 8);
    progressService.startProgress(steps);
    progressService.updateStep('manual-qa', 'completed'); // QA image already uploaded

    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
      progressService.updateStep('prompt-refinement', 'active');
      const originalGarmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const generatedFashionImageInput = await fileToBase64WithType(generatedFashionImageFile);

      const results = await performQaAndGenerateStudioPrompts(originalGarmentImageInputs, generatedFashionImageInput, fashionPromptData, photoshootType);
      progressService.updateStep('prompt-refinement', 'completed');

      setRefinedPrompts(results.map(p => ({
        id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
        title: p.title,
        prompt: p.prompt,
        isCopied: false,
        isLoadingImage: false,
        aspectRatio: '3:4',
      })));

      progressService.updateStep('finalize', 'active');
      await new Promise(resolve => setTimeout(resolve, 500));
      progressService.completeProgress();

    } catch (err: any) {
      setError(err.message || "Failed to perform QA and generate prompts.");
      setRefinedPrompts([]);
      progressService.errorProgress('prompt-refinement', err.message || 'QA and prompt generation failed');
    }
    setIsLoading(false);
  };

  const handleImagePackGeneration = async (packType: 'studio' | 'lifestyle' | 'all') => {
    if (refinedPrompts.length === 0) return;
    setIsLoading(true);

    const promptsToGenerate = refinedPrompts.filter(p => p && p.title && (packType === 'all' || p.title.toLowerCase().includes(packType)));

    setRefinedPrompts(prev => prev.map(p => promptsToGenerate.find(ptg => ptg.id === p.id) ? { ...p, isLoadingImage: true, error: undefined, imageUrl: undefined } : p));

    try {
      const generatedImages = await generateImagePack(promptsToGenerate);

      setRefinedPrompts(prev => prev.map(p => {
        const foundImage = generatedImages.find(gi => gi.id === p.id);
        if (foundImage) {
          return { ...p, isLoadingImage: false, imageUrl: foundImage.imageUrl, error: foundImage.error };
        }
        return p;
      }));

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during image pack generation.");
      setRefinedPrompts(prev => prev.map(p => promptsToGenerate.find(ptg => ptg.id === p.id) ? { ...p, isLoadingImage: false, error: "Pack generation failed" } : p));
    }

    setIsLoading(false);
  };

  const handleSimpleModeGeneration = async (packType: 'studio' | 'lifestyle' | 'marketing' | 'all') => {
    if (fashionGarmentFiles.length === 0) {
      const labels = getPhotoshootLabels(photoshootType);
      setError(labels.errorUploadMessage);
      return;
    }

    // Initialize progress tracking
    const steps = progressService.getStepsForMode('simple', packType);
    progressService.startProgress(steps);

    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
      // Step 1: Analyze Garment
      progressService.updateStep('analyze', 'active');
      const garmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const backgroundRefImageInputs = await Promise.all(fashionBackgroundRefFiles.map(fileToBase64WithType));
      const modelRefImageInputs = await Promise.all(fashionModelRefFiles.map(fileToBase64WithType));

      const analysisData = await generateFashionAnalysisAndInitialJsonPrompt(garmentImageInputs, backgroundRefImageInputs.length > 0 ? backgroundRefImageInputs : undefined, modelRefImageInputs.length > 0 ? modelRefImageInputs : undefined, photoshootType);
      progressService.updateStep('analyze', 'completed');

      // Prepare data URLs once to reuse across calls
      const garmentDataUrls = garmentImageInputs.map(img => `data:${img.mimeType};base64,${img.base64}`);

      // Step 2: Perform QA with a REAL generated image that uses the garment references
      progressService.updateStep('qa-generation', 'active');
      const qaImageInput = await generateInitialQaImage(analysisData.initialJsonPrompt, garmentDataUrls);
      progressService.updateStep('qa-generation', 'completed');

      // Step 3: Create optimized prompts
      progressService.updateStep('prompt-refinement', 'active');
      let finalPrompts = await performQaAndGenerateStudioPrompts(garmentImageInputs, qaImageInput, analysisData, photoshootType);

      // Generate marketing prompts for product photoshoot type
      if (photoshootType === 'product' && (packType === 'marketing' || packType === 'all')) {
        try {
          const marketingPrompts = await generateMarketingPrompts(finalPrompts, analysisData);
          console.log('Generated marketing prompts:', marketingPrompts);
          
          if (marketingPrompts && Array.isArray(marketingPrompts) && marketingPrompts.length > 0) {
            if (packType === 'marketing') {
              finalPrompts = marketingPrompts;
            } else {
              finalPrompts = [...finalPrompts, ...marketingPrompts];
            }
          } else {
            console.warn('Marketing prompts generation returned empty or invalid result');
          }
        } catch (error) {
          console.error('Error generating marketing prompts:', error);
          setError('Failed to generate marketing prompts. Please try again.');
        }
      }

      progressService.updateStep('prompt-refinement', 'completed');

      const promptsToGenerate = finalPrompts
        .filter(p => p && p.title && (packType === 'all' || p.title.toLowerCase().includes(packType)))
        .map(p => ({
          id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
          title: p.title,
          prompt: p.prompt,
          isCopied: false,
          isLoadingImage: true,
          aspectRatio: '3:4',
        }));

      setRefinedPrompts(promptsToGenerate);

      // --- Step 4: Generate Images via Replicate multi-image workflow ---

      // garmentDataUrls were already prepared above

      // Identify the front-view prompt (fallback to first)
      const frontIndex = promptsToGenerate.findIndex(p => p.title.toLowerCase().includes('front'));
      const frontPromptId = frontIndex !== -1 ? promptsToGenerate[frontIndex].id : promptsToGenerate[0].id;
      const frontPromptItem = promptsToGenerate.find(p => p.id === frontPromptId)!;

      // Generate the seed/front image
      let seedImageUrl: string;

      // Update progress for front view generation
      if (packType === 'studio' || packType === 'all') {
        progressService.updateStep('studio-front', 'active');
      }

      try {
        seedImageUrl = await generateImageViaReplicate({
          prompt: frontPromptItem.prompt,
          aspect_ratio: frontPromptItem.aspectRatio,
          input_images: garmentDataUrls,
        });

        setFirstImageUrl(seedImageUrl);
        setRefinedPrompts(prev => prev.map(p => p.id === frontPromptId ? { ...p, isLoadingImage: false, imageUrl: seedImageUrl } : p));
        // Save to history
        await saveToHistory(seedImageUrl, frontPromptItem.prompt, frontPromptItem.title, frontPromptItem.aspectRatio);

        if (packType === 'studio' || packType === 'all') {
          progressService.updateStep('studio-front', 'completed');
        }
      } catch (err: any) {
        setRefinedPrompts(prev => prev.map(p => p.id === frontPromptId ? { ...p, isLoadingImage: false, error: err.message || 'Failed' } : p));
        if (packType === 'studio' || packType === 'all') {
          progressService.errorProgress('studio-front', err.message || 'Failed to generate front view');
        }
        throw err;
      }

      // Generate remaining images sequentially with delays to avoid rate limits
      const remaining: RefinedPromptItem[] = promptsToGenerate.filter(p => p.id !== frontPromptId);
      const remainingResults: { id: string; imageUrl?: string; error?: string }[] = [];

      // Update progress for additional studio images or lifestyle generation
      if (remaining.length > 0) {
        if (packType === 'studio' || packType === 'all') {
          const hasStudioRemaining = remaining.some(p => p.title.toLowerCase().includes('studio'));
          if (hasStudioRemaining) {
            progressService.updateStep('studio-additional', 'active');
          }
        }
        if (packType === 'lifestyle' || packType === 'all') {
          const hasLifestyleRemaining = remaining.some(p => p.title.toLowerCase().includes('lifestyle'));
          if (hasLifestyleRemaining) {
            progressService.updateStep('lifestyle-generation', 'active');
          }
        }
        if (packType === 'marketing' || packType === 'all') {
          const hasMarketingRemaining = remaining.some(p => p.title.toLowerCase().includes('marketing'));
          if (hasMarketingRemaining) {
            progressService.updateStep('marketing-generation', 'active');
          }
        }
      }

      for (let i = 0; i < remaining.length; i++) {
        const p = remaining[i];
        try {
          const replicateUrl = await generateImageViaReplicate({
            prompt: p.prompt,
            aspect_ratio: p.aspectRatio,
            input_images: [...garmentDataUrls, seedImageUrl],
          });
          // Save to history
          await saveToHistory(replicateUrl, p.prompt, p.title, p.aspectRatio);
          remainingResults.push({ id: p.id, imageUrl: replicateUrl });
        } catch (err: any) {
          remainingResults.push({ id: p.id, error: err.message || 'Failed' });
        }

        // Add a 1-second delay between image generation requests
        if (i < remaining.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Complete progress steps
      if (packType === 'studio' || packType === 'all') {
        const hasStudioRemaining = remaining.some(p => p.title.toLowerCase().includes('studio'));
        if (hasStudioRemaining) {
          progressService.updateStep('studio-additional', 'completed');
        }
      }
      if (packType === 'lifestyle' || packType === 'all') {
        const hasLifestyleRemaining = remaining.some(p => p.title.toLowerCase().includes('lifestyle'));
        if (hasLifestyleRemaining) {
          progressService.updateStep('lifestyle-generation', 'completed');
        }
      }
      if (packType === 'marketing' || packType === 'all') {
        const hasMarketingRemaining = remaining.some(p => p.title.toLowerCase().includes('marketing'));
        if (hasMarketingRemaining) {
          progressService.updateStep('marketing-generation', 'completed');
        }
      }

      setRefinedPrompts(prev => prev.map(p => {
        const res = remainingResults.find(r => r.id === p.id);
        if (!res) return p;
        return { ...p, isLoadingImage: false, imageUrl: (res as any).imageUrl, error: (res as any).error };
      }));

    } catch (err: any) {
      const labels = getPhotoshootLabels(photoshootType);
      setError(err.message || `Failed to generate ${labels.mainItemName} image pack.`);
      progressService.errorProgress(progressService.getCurrentProgress()?.currentStepId || 'unknown', err.message || 'Generation failed');
    } finally {
      // Finalize progress
      progressService.updateStep('finalize', 'active');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for finalization
      progressService.completeProgress();
      setIsLoading(false);
    }
  };

  const handleAutoQa = async () => {
    if (!fashionPromptData) {
      setError("Initial analysis data is missing.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
      // Prepare original garment inputs
      const originalGarmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const garmentDataUrls = originalGarmentImageInputs.map(img => `data:${img.mimeType};base64,${img.base64}`);

      // Generate a QA image using the garment references
      const qaImageInput = await generateInitialQaImage(fashionPromptData.initialJsonPrompt, garmentDataUrls);

      const results = await performQaAndGenerateStudioPrompts(originalGarmentImageInputs, qaImageInput, fashionPromptData, photoshootType);

      setRefinedPrompts(results.map(p => ({
        id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
        title: p.title,
        prompt: p.prompt,
        isCopied: false,
        isLoadingImage: false,
        aspectRatio: '3:4'
      })));
    } catch (err: any) {
      setError(err.message || "Failed to perform automated QA.");
      setRefinedPrompts([]);
    }
    setIsLoading(false);
  };

  const handleGenerateSingleImage = async (itemId?: string) => {
    // --- Case 1: Generate image for a specific refined prompt item ---
    if (itemId) {
      if (fashionGarmentFiles.length === 0) {
        const labels = getPhotoshootLabels(photoshootType);
        setError(`Please upload at least one ${labels.mainItemName} image before generating.`);
        return;
      }

      const promptItem = refinedPrompts.find(p => p.id === itemId);
      if (!promptItem) {
        setError("Prompt not found.");
        return;
      }

      // Mark this prompt as loading
      setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isLoadingImage: true, error: undefined } : p));

      try {
        // Prepare garment images
        const garmentInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
        const garmentDataUrls = garmentInputs.map(img => `data:${img.mimeType};base64,${img.base64}`);
        const imagesForModel = firstImageUrl ? [...garmentDataUrls, firstImageUrl] : garmentDataUrls;

        // Generate image via Replicate
        const imageUrl = await generateImageViaReplicate({
          prompt: promptItem.prompt,
          aspect_ratio: promptItem.aspectRatio,
          input_images: imagesForModel,
        });

        // Save seed if not set yet
        if (!firstImageUrl) setFirstImageUrl(imageUrl);

        // Update prompt item with generated image
        setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isLoadingImage: false, imageUrl } : p));
        // Save to history
        await saveToHistory(imageUrl, promptItem.prompt, promptItem.title, promptItem.aspectRatio);
      } catch (err: any) {
        setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isLoadingImage: false, error: err.message || 'Failed to generate image' } : p));
      }

      return; // Early exit so we don't run the original flow below
    }

    // --- Case 2: Original single-image generation flow (initial JSON prompt) ---
    if (!fashionPromptData || !generatedFashionImageFile || fashionGarmentFiles.length === 0) {
      const labels = getPhotoshootLabels(photoshootType);
      setError(`Missing data: ${labels.mainItemName.charAt(0).toUpperCase() + labels.mainItemName.slice(1)} image(s), generated QA image, or initial analysis is missing.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
      const garmentInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const garmentDataUrls = garmentInputs.map(img => `data:${img.mimeType};base64,${img.base64}`);
      const imagesForModel = firstImageUrl ? [...garmentDataUrls, firstImageUrl] : garmentDataUrls;

      const imageUrl = await generateImageViaReplicate({
        prompt: fashionPromptData.initialJsonPrompt,
        aspect_ratio: '3:4',
        input_images: imagesForModel,
      });

      if (!firstImageUrl) setFirstImageUrl(imageUrl);

      setRefinedPrompts(prev => [...prev, {
        id: `generated-${Date.now()}`,
        title: 'Generated Image',
        prompt: fashionPromptData.initialJsonPrompt,
        isCopied: false,
        isLoadingImage: false,
        aspectRatio: '3:4',
        imageUrl,
      }]);
      // Save to history
      await saveToHistory(imageUrl, fashionPromptData.initialJsonPrompt, 'Generated Image', '3:4');
    } catch (err: any) {
      setError(err.message || "Failed to generate image.");
    }

    setIsLoading(false);
  };

  const handleAspectRatioChange = (itemId: string, newAspectRatio: string) => {
    setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, aspectRatio: newAspectRatio } : p));
  };

  const handleCopyToClipboard = (textToCopy: string, onCopySuccess: () => void) => {
    navigator.clipboard.writeText(textToCopy).then(onCopySuccess).catch(err => {
      console.error("Failed to copy:", err);
      setError("Failed to copy text to clipboard.");
    });
  };

  const copyInitialJsonPrompt = () => {
    if (fashionPromptData?.initialJsonPrompt) {
      handleCopyToClipboard(fashionPromptData.initialJsonPrompt, () => {
        setFashionInitialJsonPromptCopied(true);
        setTimeout(() => setFashionInitialJsonPromptCopied(false), 2000);
      });
    }
  };

  const copyRefinedPrompt = (itemId: string) => {
    const promptItem = refinedPrompts.find(p => p.id === itemId);
    if (promptItem?.prompt) {
      handleCopyToClipboard(promptItem.prompt, () => {
        setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: true } : p));
        setTimeout(() => setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: false } : p)), 2000);
      });
    }
  };

  const handleDownloadImage = (imageUrl: string, filename: string, title?: string) => {
    setDownloadImageUrl(imageUrl);
    setDownloadFilename(filename);
    setDownloadTitle(title || 'Download Image');
    setShowDownloadModal(true);
  };

  const handleDownloadAllImages = async () => {
    const validImages = refinedPrompts.filter(item => item.imageUrl);

    // For bulk download, we'll use the basic download without upscale options
    for (const item of validImages) {
      if (item.imageUrl) {
        try {
          const response = await fetch(item.imageUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${item.title.toLowerCase().replace(/\s+/g, '-')}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to download ${item.title}:`, error);
        }
      }
    }
  };

  const handlePackSelection = (pack: 'studio' | 'lifestyle' | 'marketing') => {
    setSelectedPacks(prev => ({
      ...prev,
      [pack]: !prev[pack]
    }));
  };

  const handleGenerateSelectedPacks = async () => {
    if (!selectedPacks.studio && !selectedPacks.lifestyle && !selectedPacks.marketing) {
      setError('Please select at least one pack type');
      return;
    }

    const selectedCount = [selectedPacks.studio, selectedPacks.lifestyle, selectedPacks.marketing].filter(Boolean).length;

    if (selectedCount > 1) {
      await handleSimpleModeGeneration('all');
    } else if (selectedPacks.studio) {
      await handleSimpleModeGeneration('studio');
    } else if (selectedPacks.lifestyle) {
      await handleSimpleModeGeneration('lifestyle');
    } else if (selectedPacks.marketing) {
      await handleSimpleModeGeneration('marketing');
    }
  };

  // Edit mode handlers
  const handleEditModeToggle = () => {
    const hasImages = refinedPrompts.some(item => item.imageUrl);
    if (!hasImages) {
      setError('No images available to edit. Please generate some images first.');
      return;
    }
    setShowImageSelector(true);
  };

  const handleImageSelectionChange = (selectedIds: string[]) => {
    setSelectedImageIds(selectedIds);
  };

  const handleImageSelectionConfirm = () => {
    if (selectedImageIds.length === 0) return;

    setEditMode(selectedImageIds.length === 1 ? 'single' : 'multiple');
    setShowImageSelector(false);
    setIsEditMode(true);
  };

  const handleImageSelectionCancel = () => {
    setShowImageSelector(false);
    setSelectedImageIds([]);
  };

  const handleEditComplete = (editedImages: RefinedPromptItem[]) => {
    setRefinedPrompts(editedImages);
    setIsEditMode(false);
    setSelectedImageIds([]);
  };

  const renderFileUploadArea = (
    areaType: 'garment' | 'backgroundRef' | 'modelRef',
    files: File[],
    previewUrls: string[],
    maxFiles: number,
    title: string,
    IconComponent: React.FC<any>
  ) => {
    return (
      <div className="flex flex-col">
        <h3 className="font-semibold text-secondary mb-2 text-left text-base">{title}</h3>
        <div
          className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-lg p-4 text-center cursor-pointer transition-colors duration-200 bg-white hover:bg-slate-50/50 flex-grow flex flex-col justify-center items-center"
          onDrop={(e) => handleDrop(e, areaType)}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById(`fileInput-${areaType}`)?.click()}
        >
          <input type="file" id={`fileInput-${areaType}`} accept="image/*" multiple={areaType !== 'garment' || maxFiles > 1} onChange={(e) => handleFileChange(e, areaType)} className="hidden" />
          {previewUrls.length > 0 ? (
            <div className={`grid ${previewUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              {previewUrls.map((src, index) => (
                <img key={`${files[index]?.name}-${index}`} src={src} alt={`${areaType} preview ${index + 1}`} className="object-cover rounded-md shadow-sm border border-slate-200 h-24 w-24" />
              ))}
            </div>
          ) : (
            <IconComponent className="w-12 h-12 text-muted mx-auto mb-3" />
          )}
          <p className="text-slate-500 text-sm mt-2">
            {files.length > 0 ? `${files.length}/${maxFiles} selected` : `Drag & drop or click`}
          </p>
          <p className="text-xs text-slate-400 mt-1">Max {maxFiles} image(s), {MAX_FILE_SIZE_MB}MB each.</p>
          {files.length > 0 && (
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); clearSelectedFilesForMode(areaType); }} className="mt-3 text-xs !py-1 !px-2">
              <XCircleIcon className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderImageResultGrid = (items: RefinedPromptItem[]) => {
    const displayItems = items.length > 0 ? items : Array(4).fill(null).map((_, i): RefinedPromptItem => ({ id: `placeholder-${i}`, title: 'Awaiting Generation...', prompt: '', isCopied: false, isLoadingImage: false, aspectRatio: '3:4' }));

    return (
      <div className="space-y-4">
        {items.length > 0 && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleEditModeToggle}
                variant="secondary"
                size="sm"
                disabled={!items.some(item => item.imageUrl)}
              >
                <SparklesIcon className="w-4 h-4 mr-1" />
                Edit Images
              </Button>
            </div>
            <Button
              onClick={handleDownloadAllImages}
              variant="secondary"
              size="sm"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
              Download All Images
            </Button>
          </div>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
          {displayItems.map(item => (
            <div key={item.id} className="bg-white p-3 rounded-lg shadow-md border border-slate-100 flex flex-col justify-between">
              <h4 className="font-semibold text-slate-700 text-sm mb-2 truncate">{item.title}</h4>
              <div className="aspect-[3/4] bg-slate-100 rounded flex items-center justify-center mb-2 overflow-hidden border border-slate-200">
                {item.isLoadingImage && <Spinner className="w-8 h-8 text-sky-500" />}
                {item.imageUrl && !item.isLoadingImage && (
                  <img
                    src={item.imageUrl}
                    onLoad={(e) => e.currentTarget.classList.remove('blur-lg')}
                    alt={item.title}
                    className="w-full h-full object-cover rounded blur-lg transition-all duration-700 cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => handleImageClick(displayItems.indexOf(item))}
                  />
                )}
                {!item.imageUrl && !item.isLoadingImage && !item.error && <PlaceholderIcon className="w-12 h-12 text-slate-300" />}
                {item.error && !item.isLoadingImage && (
                  <div className="p-2 text-center">
                    <XCircleIcon className="w-8 h-8 text-red-400 mx-auto mb-1" />
                    <p className="text-xs text-red-600">{item.error}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {item.imageUrl && !item.isLoadingImage && (
                  <Button
                    onClick={() => handleDownloadImage(
                      item.imageUrl!,
                      `${item.title.toLowerCase().replace(/\s+/g, '-')}.png`,
                      `Download ${item.title}`
                    )}
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    aria-label={`Download ${item.title}`}
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                )}
                {photoshootType === 'garment' && (
                  <Button
                    onClick={() => copyRefinedPrompt(item.id)}
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={!item.prompt}
                    aria-label={`Copy prompt for ${item.title} to clipboard`}
                  >
                    {item.isCopied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardIcon className="w-4 h-4" />}
                    {item.isCopied ? 'Copied!' : 'Copy Prompt'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderUploaders = () => {
    const labels = getPhotoshootLabels(photoshootType);
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 space-y-6">
        <p className="text-center text-slate-600 -mt-2">Upload your {labels.mainItemName}, and optional background or model references.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderFileUploadArea('garment', fashionGarmentFiles, fashionGarmentPreviewUrls, MAX_FILES_FASHION_PROMPT, labels.uploadMainLabel, GarmentIcon)}
          {renderFileUploadArea('backgroundRef', fashionBackgroundRefFiles, fashionBackgroundRefPreviewUrls, MAX_FILES_FASHION_BACKGROUND_REF, "Background Ref (Optional)", BackgroundIcon)}
          {renderFileUploadArea('modelRef', fashionModelRefFiles, fashionModelRefPreviewUrls, MAX_FILES_FASHION_MODEL_REF, "Model Ref (Optional)", ModelIcon)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-4 md:p-8 selection:bg-sky-500 selection:text-white">
      {/* Navbar */}
      <nav className="w-full max-w-6xl mx-auto flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2">
          <img src="https://framerusercontent.com/images/Sn5VF1Si4Nr6jofjVzhOWDq5sGo.svg" alt="Logo" className="h-8 w-auto" />
        </a>
        <div className="flex items-center gap-4">
          <PhotoshootToggle
            photoshootType={photoshootType}
            onPhotoshootTypeChange={handlePhotoshootTypeChange}
            disabled={isLoading}
          />

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="secondary" size="sm" className="ml-2">Sign in</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAppMode(appMode === 'history' ? 'generation' : 'history')}
                className="flex items-center gap-2"
              >
                <ClockIcon className="w-4 h-4" />
                {appMode === 'history' ? 'Back to Generation' : 'View History'}
              </Button>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </nav>

      <div className="w-full max-w-6xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-secondary">Image Co-Pilot</h1>
          <p className="mt-1 text-lg text-slate-600">Your AI-powered tool for professional fashion image generation.</p>
        </header>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {renderUploaders()}

        {fashionGarmentFiles.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 space-y-4">
            <h3 className="text-lg font-semibold text-secondary text-center">Generate Image Pack</h3>
            <p className="text-center text-sm text-slate-500">One click to get a full set of professional images.</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPacks.studio}
                    onChange={() => handlePackSelection('studio')}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                  />
                  <span className="text-slate-700">Studio Pack (4 Images)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPacks.lifestyle}
                    onChange={() => handlePackSelection('lifestyle')}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                  />
                  <span className="text-slate-700">Lifestyle Pack (4 Images)</span>
                </label>
                {photoshootType === 'product' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPacks.marketing}
                      onChange={() => handlePackSelection('marketing')}
                      className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                    />
                    <span className="text-slate-700 font-semibold text-purple-600">Marketing Pack</span>
                  </label>
                )}
              </div>

              {/* Pack descriptions */}
              {(selectedPacks.studio || selectedPacks.lifestyle || selectedPacks.marketing) && (
                <div className="text-sm text-slate-600 space-y-1">
                  {selectedPacks.studio && (
                    <p><strong>Studio:</strong> {getPhotoshootLabels(photoshootType).studioDescription}</p>
                  )}
                  {selectedPacks.lifestyle && (
                    <p><strong>Lifestyle:</strong> {getPhotoshootLabels(photoshootType).lifestyleDescription}</p>
                  )}
                  {selectedPacks.marketing && photoshootType === 'product' && (
                    <p><strong className="text-purple-600">🚀 Marketing:</strong> <span className="text-purple-600 font-medium">Crazy viral-worthy shots with dramatic angles, creative compositions, and eye-catching scenarios designed to go viral on social media</span></p>
                  )}
                </div>
              )}

              <Button
                onClick={handleGenerateSelectedPacks}
                disabled={isLoading || (!selectedPacks.studio && !selectedPacks.lifestyle && !selectedPacks.marketing)}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    {generationProgress && (
                      <span className="ml-2">
                        {generationProgress.steps.find(s => s.status === 'active')?.label || 'Generating'}
                        {generationProgress.elapsedTime > 0 && (
                          <span className="text-sm opacity-75 ml-1">
                            (~{progressService.formatDuration(
                              Math.max(0, progressService.getEstimatedTime(
                                'simple',
                                (selectedPacks.studio && selectedPacks.lifestyle) ||
                                  (selectedPacks.studio && selectedPacks.marketing) ||
                                  (selectedPacks.lifestyle && selectedPacks.marketing) ||
                                  (selectedPacks.studio && selectedPacks.lifestyle && selectedPacks.marketing) ? 'all' :
                                  selectedPacks.studio ? 'studio' :
                                    selectedPacks.lifestyle ? 'lifestyle' : 'marketing'
                              ) - generationProgress.elapsedTime)
                            )} left)
                          </span>
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    Generate Selected Images
                    {(selectedPacks.studio || selectedPacks.lifestyle) && (
                      <span className="text-sm opacity-75 ml-2">
                        (~{progressService.formatDuration(
                          progressService.getEstimatedTime(
                            'simple',
                            (selectedPacks.studio && selectedPacks.lifestyle) ||
                              (selectedPacks.studio && selectedPacks.marketing) ||
                              (selectedPacks.lifestyle && selectedPacks.marketing) ||
                              (selectedPacks.studio && selectedPacks.lifestyle && selectedPacks.marketing) ? 'all' :
                              selectedPacks.studio ? 'studio' :
                                selectedPacks.lifestyle ? 'lifestyle' : 'marketing'
                          )
                        )})
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        )} {/* end Simple-mode pack */}



        {(refinedPrompts.length > 0 || isLoading) && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-secondary text-center">Generated {getPhotoshootLabels(photoshootType).mainItemName.charAt(0).toUpperCase() + getPhotoshootLabels(photoshootType).mainItemName.slice(1)} Images</h3>
            {renderImageResultGrid(refinedPrompts)}
          </div>
        )}

        {/* Advanced workflow removed - replaced with single streamlined workflow that adapts to photoshoot type */}
      </div>

      {/* History View */}
      {appMode === 'history' && user && (
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('History view error:', error, errorInfo);
            setError('Failed to load history. Please try refreshing the page.');
          }}
        >
          <HistoryView
            userId={user.id}
            onClose={() => setAppMode('generation')}
            onImageSelect={(item) => {
              console.log('Selected history item:', item);
              // Could potentially load the image for editing or viewing
            }}
          />
        </ErrorBoundary>
      )}

      {/* Image Selector */}
      {showImageSelector && (
        <ImageSelector
          images={refinedPrompts}
          selectedImageIds={selectedImageIds}
          onSelectionChange={handleImageSelectionChange}
          onConfirm={handleImageSelectionConfirm}
          onCancel={handleImageSelectionCancel}
          mode="multiple"
        />
      )}

      {/* Edit Chat Interface */}
      {isEditMode && (
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('Edit interface error:', error, errorInfo);
            setError('Failed to load edit interface. Please try again.');
            setIsEditMode(false);
          }}
        >
          <EditChatInterface
            currentImages={refinedPrompts}
            onEditComplete={handleEditComplete}
            onClose={() => setIsEditMode(false)}
            editMode={editMode}
            selectedImageIds={selectedImageIds}
          />
        </ErrorBoundary>
      )}

      {/* Download Modal */}
      {showDownloadModal && (
        <DownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          imageUrl={downloadImageUrl}
          filename={downloadFilename}
          title={downloadTitle}
        />
      )}

      {/* Full Screen Image Modal */}
      {showFullScreenModal && (
        <FullScreenImageModal
          isOpen={showFullScreenModal}
          onClose={() => setShowFullScreenModal(false)}
          images={refinedPrompts}
          currentIndex={fullScreenImageIndex}
          onImageChange={handleFullScreenImageChange}
          onImageUpdate={handleFullScreenImageUpdate}
        />
      )}

      <style>{`
        .pretty-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .pretty-scrollbar::-webkit-scrollbar-track { background: rgba(209, 213, 219, 0.5); border-radius: 3px; }
        .pretty-scrollbar::-webkit-scrollbar-thumb { background: #38bdf8; border-radius: 3px; }
        .pretty-scrollbar::-webkit-scrollbar-thumb:hover { background: #0ea5e9; }
        .pretty-scrollbar { scrollbar-width: thin; scrollbar-color: #38bdf8 rgba(209, 213, 219, 0.5); }
      `}</style>
    </div>
  );
};

export default App;
