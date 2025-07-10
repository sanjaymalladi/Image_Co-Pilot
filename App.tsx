// @ts-nocheck

import React, { useState, useCallback, ChangeEvent, useEffect, DragEvent } from 'react';
import { generateFashionAnalysisAndInitialJsonPrompt, performQaAndGenerateStudioPrompts, generateSingleImage, generateInitialQaImage, generateImagePack } from './services/geminiService';
import { generateImageViaReplicate } from './services/replicateService';
import { fileToBase64WithType } from './utils/fileUtils';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { Alert } from './components/Alert';
import { XCircleIcon, WandSparklesIcon, SparklesIcon, UploadIcon, ClipboardIcon, CheckIcon, PlaceholderIcon, ArrowDownTrayIcon } from './components/Icons';
import { ShoppingBagIcon as GarmentIcon, PhotoIcon as BackgroundIcon, UserIcon as ModelIcon } from '@heroicons/react/24/outline';

type WorkflowMode = 'simple' | 'advanced' | null;

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
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('simple');

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
  }>({
    studio: false,
    lifestyle: false
  });

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
    setSelectedPacks({ studio: false, lifestyle: false });
  };

  const handleModeChange = (mode: WorkflowMode) => {
    resetAllState();
    setWorkflowMode(mode);
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
      setError(`Please upload 1 or ${MAX_FILES_FASHION_PROMPT} garment image(s).`);
      return;
    }
    setIsLoading(true);
    setError(null);
    clearSubsequentFashionStates();

    try {
      const garmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const backgroundRefImageInputs = await Promise.all(fashionBackgroundRefFiles.map(fileToBase64WithType));
      const modelRefImageInputs = await Promise.all(fashionModelRefFiles.map(fileToBase64WithType));

      const results = await generateFashionAnalysisAndInitialJsonPrompt(garmentImageInputs, backgroundRefImageInputs.length > 0 ? backgroundRefImageInputs : undefined, modelRefImageInputs.length > 0 ? modelRefImageInputs : undefined);
      setFashionPromptData(results);
    } catch (err: any) {
      setError(err.message || "Failed to generate fashion analysis.");
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
      setError("Missing data: Garment image(s), generated QA image, or initial analysis is missing.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
      const originalGarmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const generatedFashionImageInput = await fileToBase64WithType(generatedFashionImageFile);

      const results = await performQaAndGenerateStudioPrompts(originalGarmentImageInputs, generatedFashionImageInput, fashionPromptData);
      
      setRefinedPrompts(results.map(p => ({
        id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
        title: p.title,
        prompt: p.prompt,
        isCopied: false,
        isLoadingImage: false,
        aspectRatio: '3:4',
      })));

    } catch (err: any) {
      setError(err.message || "Failed to perform QA and generate prompts.");
      setRefinedPrompts([]);
    }
    setIsLoading(false);
  };

  const handleImagePackGeneration = async (packType: 'studio' | 'lifestyle' | 'all') => {
    if (refinedPrompts.length === 0) return;
    setIsLoading(true);

    const promptsToGenerate = refinedPrompts.filter(p => packType === 'all' || p.title.toLowerCase().includes(packType));
    
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

    } catch(err: any) {
       setError(err.message || "An unexpected error occurred during image pack generation.");
       setRefinedPrompts(prev => prev.map(p => promptsToGenerate.find(ptg => ptg.id === p.id) ? { ...p, isLoadingImage: false, error: "Pack generation failed" } : p));
    }
    
    setIsLoading(false);
  };
  
  const handleSimpleModeGeneration = async (packType: 'studio' | 'lifestyle' | 'all') => {
    if (fashionGarmentFiles.length === 0) {
        setError(`Please upload 1 or ${MAX_FILES_FASHION_PROMPT} garment image(s).`);
        return;
    }
    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
        // Step 1: Analyze Garment (Hidden)
        const garmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
        const backgroundRefImageInputs = await Promise.all(fashionBackgroundRefFiles.map(fileToBase64WithType));
        const modelRefImageInputs = await Promise.all(fashionModelRefFiles.map(fileToBase64WithType));
        
        const analysisData = await generateFashionAnalysisAndInitialJsonPrompt(garmentImageInputs, backgroundRefImageInputs.length > 0 ? backgroundRefImageInputs : undefined, modelRefImageInputs.length > 0 ? modelRefImageInputs : undefined);

        // Step 2: Generate a REAL seed image via Replicate, then run QA
        const qaSeedImageInput = await generateInitialQaImage(analysisData.initialJsonPrompt);

        const finalPrompts = await performQaAndGenerateStudioPrompts(
          garmentImageInputs,
          qaSeedImageInput,
          analysisData
        );
        
        const promptsToGenerate = finalPrompts
            .filter(p => packType === 'all' || p.title.toLowerCase().includes(packType))
            .map(p => ({
                id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
                title: p.title,
                prompt: p.prompt,
                isCopied: false,
                isLoadingImage: true,
                aspectRatio: '3:4',
            }));
        
        setRefinedPrompts(promptsToGenerate);

        // --- Step 3: Generate Images via Replicate multi-image workflow ---

        // Convert garment images to data URLs for Replicate input
        const garmentDataUrls = garmentImageInputs.map(img => `data:${img.mimeType};base64,${img.base64}`);

        // Identify the front-view prompt (fallback to first)
        const frontIndex = promptsToGenerate.findIndex(p => p.title.toLowerCase().includes('front'));
        const frontPromptId = frontIndex !== -1 ? promptsToGenerate[frontIndex].id : promptsToGenerate[0].id;
        const frontPromptItem = promptsToGenerate.find(p => p.id === frontPromptId)!;

        // Generate the seed/front image
        let seedImageUrl: string;
        try {
          seedImageUrl = await generateImageViaReplicate({
            prompt: frontPromptItem.prompt,
            aspect_ratio: frontPromptItem.aspectRatio,
            input_images: garmentDataUrls,
          });
          setFirstImageUrl(seedImageUrl);
          setRefinedPrompts(prev => prev.map(p => p.id === frontPromptId ? { ...p, isLoadingImage: false, imageUrl: seedImageUrl } : p));
        } catch (err: any) {
          setRefinedPrompts(prev => prev.map(p => p.id === frontPromptId ? { ...p, isLoadingImage: false, error: err.message || 'Failed' } : p));
          throw err;
        }

        // Generate remaining images in parallel using garment + seed references
        const remaining: RefinedPromptItem[] = promptsToGenerate.filter(p => p.id !== frontPromptId);
        const remainingPromises: Promise<{id: string; imageUrl?: string; error?: string}>[] = remaining.map(async (p: RefinedPromptItem) => {
          try {
            const imgUrl = await generateImageViaReplicate({
              prompt: p.prompt,
              aspect_ratio: p.aspectRatio,
              input_images: [...garmentDataUrls, seedImageUrl],
            });
            return { id: p.id, imageUrl: imgUrl } as const;
          } catch (err: any) {
            return { id: p.id, error: err.message || 'Failed' } as const;
          }
        });

        const remainingResults: {id: string; imageUrl?: string; error?: string}[] = await Promise.all(remainingPromises);

        setRefinedPrompts(prev => prev.map(p => {
          const res = remainingResults.find(r => r.id === p.id);
          if (!res) return p;
          return { ...p, isLoadingImage: false, imageUrl: (res as any).imageUrl, error: (res as any).error };
        }));

    } catch (err: any) {
        setError(err.message || "Failed to generate fashion image pack.");
    }
    
    setIsLoading(false);
  };

  // Add new handler for generating initial image
  const handleGenerateInitialImage = async () => {
    if (!fashionPromptData || fashionGarmentFiles.length === 0) {
      setError("Missing data: Garment image(s) or initial analysis is missing.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // Convert garment images to data URLs
      const garmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const backgroundRefImageInputs = await Promise.all(fashionBackgroundRefFiles.map(fileToBase64WithType));
      const modelRefImageInputs = await Promise.all(fashionModelRefFiles.map(fileToBase64WithType));

      const imagesForModel = [
        ...garmentImageInputs,
        ...(backgroundRefImageInputs.length > 0 ? backgroundRefImageInputs : []),
        ...(modelRefImageInputs.length > 0 ? modelRefImageInputs : [])
      ];

      const imageUrl = await generateImageViaReplicate({
        prompt: fashionPromptData.initialJsonPrompt,
        aspect_ratio: '3:4',
        input_images: imagesForModel,
      });

      // Create a File object from the generated image URL
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'generated-image.png', { type: 'image/png' });
      
      // Set the generated image file and preview URL
      setGeneratedFashionImageFile(file);
      setGeneratedFashionImagePreviewUrl(imageUrl);
      
      if (!firstImageUrl) setFirstImageUrl(imageUrl);
    } catch (err: any) {
      setError(err.message || "Failed to generate image");
    }
    setIsLoading(false);
  };

  // Update the handleAutoQa function to work with the generated image
  const handleAutoQa = async () => {
    if (!fashionPromptData || !generatedFashionImageFile || fashionGarmentFiles.length === 0) {
      setError("Missing data: Garment image(s), generated QA image, or initial analysis is missing.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
      const garmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
      const backgroundRefImageInputs = await Promise.all(fashionBackgroundRefFiles.map(fileToBase64WithType));
      const modelRefImageInputs = await Promise.all(fashionModelRefFiles.map(fileToBase64WithType));
      const generatedImageInput = await fileToBase64WithType(generatedFashionImageFile);

      const results = await performQaAndGenerateStudioPrompts(
        garmentImageInputs,
        generatedImageInput,
        fashionPromptData.initialJsonPrompt,
        backgroundRefImageInputs.length > 0 ? backgroundRefImageInputs : undefined,
        modelRefImageInputs.length > 0 ? modelRefImageInputs : undefined
      );

      setRefinedPrompts(results.map(item => ({
        ...item,
        isLoadingImage: false,
        isCopied: false
      })));
    } catch (err: any) {
      setError(err.message || "Failed to perform QA and generate prompts");
      setRefinedPrompts([]);
    }
    setIsLoading(false);
  };

  const handleGenerateSingleImage = async () => {
    if (!fashionPromptData || !generatedFashionImageFile || fashionGarmentFiles.length === 0) {
      setError("Missing data: Garment image(s), generated QA image, or initial analysis is missing.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
        // Convert garment images to data URLs
        const garmentInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
        const garmentDataUrls = garmentInputs.map(img => `data:${img.mimeType};base64,${img.base64}`);

        const imagesForModel = firstImageUrl ? [...garmentDataUrls, firstImageUrl] : garmentDataUrls;

        const imageUrl = await generateImageViaReplicate({
          prompt: fashionPromptData.initialJsonPrompt, // Use the initial prompt as the prompt for the single image
          aspect_ratio: '3:4', // Default aspect ratio for single image
          input_images: imagesForModel,
        });

        if (!firstImageUrl) setFirstImageUrl(imageUrl);

        // Add the generated image to refinedPrompts for display
        setRefinedPrompts(prev => [...prev, {
          id: `generated-${Date.now()}`,
          title: 'Generated Image',
          prompt: fashionPromptData.initialJsonPrompt,
          isCopied: false,
          isLoadingImage: false,
          aspectRatio: '3:4',
          imageUrl: imageUrl
        }]);

    } catch (err: any) {
        setRefinedPrompts(prev => prev.map(p => p.id === 'generated-${Date.now()}' ? { ...p, isLoadingImage: false, error: err.message || 'Failed' } : p));
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

  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to download image');
    }
  };

  const handleDownloadAllImages = async () => {
    const validImages = refinedPrompts.filter(item => item.imageUrl);
    for (const item of validImages) {
      if (item.imageUrl) {
        await handleDownloadImage(item.imageUrl, `${item.title.toLowerCase().replace(/\s+/g, '-')}.png`);
      }
    }
  };

  const handlePackSelection = (pack: 'studio' | 'lifestyle') => {
    setSelectedPacks(prev => ({
      ...prev,
      [pack]: !prev[pack]
    }));
  };

  const handleGenerateSelectedPacks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (selectedPacks.studio) {
        await handleImagePackGeneration('studio');
      }
      if (selectedPacks.lifestyle) {
        await handleImagePackGeneration('lifestyle');
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate selected packs");
    }
    setIsLoading(false);
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
    if (!items || items.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {items.map((item) => (
          <div key={item.id} className="bg-primary p-4 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-secondary">{item.title}</h3>
            
            {item.imageUrl && (
              <div className="relative group">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-auto rounded-lg mb-2"
                />
                <Button
                  onClick={() => handleDownloadImage(item.imageUrl!, `${item.title.toLowerCase().replace(/\s+/g, '-')}.png`)}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  variant="primary"
                  size="sm"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                </Button>
              </div>
            )}

            {item.isLoadingImage && (
              <div className="flex items-center justify-center p-8">
                <Spinner />
              </div>
            )}

            {item.error && (
              <div className="text-red-500 text-sm mb-2">{item.error}</div>
            )}

            <div className="flex items-center justify-between mt-2">
              <Button
                onClick={() => copyRefinedPrompt(item.id)}
                variant="secondary"
                size="sm"
                className="flex-1 mr-2"
              >
                {item.isCopied ? (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="w-4 h-4" />
                    Copy Prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderUploaders = () => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 space-y-6">
      <p className="text-center text-slate-600 -mt-2">Upload your garment, and optional background or model references.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderFileUploadArea('garment', fashionGarmentFiles, fashionGarmentPreviewUrls, MAX_FILES_FASHION_PROMPT, "Garment Image(s)", GarmentIcon)}
        {renderFileUploadArea('backgroundRef', fashionBackgroundRefFiles, fashionBackgroundRefPreviewUrls, MAX_FILES_FASHION_BACKGROUND_REF, "Background Ref (Optional)", BackgroundIcon)}
        {renderFileUploadArea('modelRef', fashionModelRefFiles, fashionModelRefPreviewUrls, MAX_FILES_FASHION_MODEL_REF, "Model Ref (Optional)", ModelIcon)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-4 md:p-8 selection:bg-sky-500 selection:text-white">
      {/* Navbar */}
      <nav className="w-full max-w-6xl mx-auto flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2">
          <img src="https://framerusercontent.com/images/Sn5VF1Si4Nr6jofjVzhOWDq5sGo.svg" alt="Logo" className="h-8 w-auto" />
        </a>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${workflowMode === 'simple' ? 'text-secondary' : 'text-muted'}`}>Simple</span>
          <button
            onClick={() => handleModeChange(workflowMode === 'advanced' ? 'simple' : 'advanced')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${workflowMode === 'advanced' ? 'bg-secondary' : 'bg-muted'}`}
            aria-label="Toggle workflow mode"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${workflowMode === 'advanced' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm font-medium ${workflowMode === 'advanced' ? 'text-secondary' : 'text-muted'}`}>Advanced</span>
        </div>
      </nav>

      <div className="w-full max-w-6xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-secondary">Image Co-Pilot</h1>
          <p className="mt-1 text-lg text-slate-600">Your AI-powered tool for professional fashion image generation.</p>
        </header>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {/* Uploader is rendered within each workflow mode section to avoid duplication */}

        {workflowMode === 'simple' && (
          <div className="space-y-4">
            {renderUploaders()}
            
            <div className="flex flex-col space-y-4 mt-4 items-center">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedPacks.studio}
                    onChange={() => handlePackSelection('studio')}
                    className="form-checkbox h-5 w-5 text-secondary"
                  />
                  <span>Studio Pack</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedPacks.lifestyle}
                    onChange={() => handlePackSelection('lifestyle')}
                    className="form-checkbox h-5 w-5 text-secondary"
                  />
                  <span>Lifestyle Pack</span>
                </label>
              </div>
              
              <Button
                onClick={handleGenerateSelectedPacks}
                disabled={isLoading || (!selectedPacks.studio && !selectedPacks.lifestyle)}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    Generating...
                  </>
                ) : (
                  <>
                    <WandSparklesIcon className="w-5 h-5" />
                    Generate Selected Images
                  </>
                )}
              </Button>
              
              {refinedPrompts.length > 0 && (
                <Button
                  onClick={handleDownloadAllImages}
                  variant="secondary"
                  className="w-full"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Download All Images
                </Button>
              )}
            </div>
            
            {error && <Alert variant="error" message={error} />}
            {renderImageResultGrid(refinedPrompts)}
          </div>
        )}

        {workflowMode === 'advanced' && (
          <div className="space-y-4">
            {renderUploaders()}
            
            <div className="flex flex-col space-y-4">
              <Button
                onClick={handleGenerateInitialImage}
                disabled={isLoading || fashionGarmentFiles.length === 0}
              >
                <WandSparklesIcon className="w-5 h-5" />
                Generate Image
              </Button>

              {generatedFashionImagePreviewUrl && (
                <Button
                  onClick={handleAutoQa}
                  disabled={isLoading}
                >
                  <SparklesIcon className="w-5 h-5" />
                  Send to QA
                </Button>
              )}
              
              {refinedPrompts.length > 0 && (
                <Button
                  onClick={handleDownloadAllImages}
                  variant="secondary"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Download All Images
                </Button>
              )}
            </div>
            
            {error && <Alert variant="error" message={error} />}
            {renderImageResultGrid(refinedPrompts)}
          </div>
        )}
      </div>

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
