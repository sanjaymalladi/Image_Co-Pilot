// @ts-nocheck

import React, { useState, useCallback, ChangeEvent, useEffect, DragEvent } from 'react';
import { generateFashionAnalysisAndInitialJsonPrompt, performQaAndGenerateStudioPrompts, generateSingleImage, generateInitialQaImage, generateImagePack } from './services/geminiService';
import { generateImageViaReplicate } from './services/replicateService';
import { fileToBase64WithType } from './utils/fileUtils';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { Alert } from './components/Alert';
import { XCircleIcon, WandSparklesIcon, SparklesIcon, UploadIcon, ClipboardIcon, CheckIcon, PlaceholderIcon } from './components/Icons';
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

        // Step 2: Perform QA with original garment image as the QA image
        const mockQaImageInput = garmentImageInputs[0];
        const finalPrompts = await performQaAndGenerateStudioPrompts(garmentImageInputs, mockQaImageInput, analysisData);
        
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

  const handleAutoQa = async () => {
    if (!fashionPromptData) {
        setError("Initial analysis data is missing.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setRefinedPrompts([]);

    try {
        const qaImageInput = await generateInitialQaImage(fashionPromptData.initialJsonPrompt);
        
        const originalGarmentImageInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
        const results = await performQaAndGenerateStudioPrompts(originalGarmentImageInputs, qaImageInput, fashionPromptData);
        
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

  const handleGenerateSingleImage = async (itemId: string) => {
    const promptItem = refinedPrompts.find(p => p.id === itemId);
    if (!promptItem) return;

    setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isLoadingImage: true, error: undefined, imageUrl: undefined } : p));
    try {
        // Convert garment images to data URLs
        const garmentInputs = await Promise.all(fashionGarmentFiles.map(fileToBase64WithType));
        const garmentDataUrls = garmentInputs.map(img => `data:${img.mimeType};base64,${img.base64}`);

        const imagesForModel = firstImageUrl ? [...garmentDataUrls, firstImageUrl] : garmentDataUrls;

        const imageUrl = await generateImageViaReplicate({
          prompt: promptItem.prompt,
          aspect_ratio: promptItem.aspectRatio,
          input_images: imagesForModel,
        });

        if (!firstImageUrl) setFirstImageUrl(imageUrl);

        setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isLoadingImage: false, imageUrl } : p));
    } catch (err: any) {
        setRefinedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isLoadingImage: false, error: err.message || 'Failed' } : p));
    }
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
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
            {displayItems.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-lg shadow-md border border-slate-100 flex flex-col justify-between">
                    <h4 className="font-semibold text-slate-700 text-sm mb-2 truncate">{item.title}</h4>
                    <div className="aspect-[3/4] bg-slate-100 rounded flex items-center justify-center mb-2 overflow-hidden border border-slate-200">
                        {item.isLoadingImage && <Spinner className="w-8 h-8 text-sky-500" />}
                        {item.imageUrl && !item.isLoadingImage && <img src={item.imageUrl} onLoad={(e) => e.currentTarget.classList.remove('blur-lg')} alt={item.title} className="w-full h-full object-cover rounded blur-lg transition-all duration-700" />}
                        {!item.imageUrl && !item.isLoadingImage && !item.error && <PlaceholderIcon className="w-12 h-12 text-slate-300" />}
                        {item.error && !item.isLoadingImage && (
                            <div className="p-2 text-center">
                                <XCircleIcon className="w-8 h-8 text-red-400 mx-auto mb-1" />
                                <p className="text-xs text-red-600">{item.error}</p>
                            </div>
                        )}
                    </div>
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
                </div>
            ))}
        </div>
      );
  }

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

        {workflowMode && renderUploaders()}

        {workflowMode === 'simple' && fashionGarmentFiles.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 space-y-4">
              <h3 className="text-lg font-semibold text-secondary text-center">Generate Image Pack</h3>
              <p className="text-center text-sm text-slate-500">One click to get a full set of professional images.</p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <Button onClick={() => handleSimpleModeGeneration('studio')} disabled={isLoading} className="w-full">
                      {isLoading ? <Spinner/> : <SparklesIcon className="w-5 h-5"/>} Generate 4 Studio Images
                  </Button>
                  <Button onClick={() => handleSimpleModeGeneration('lifestyle')} disabled={isLoading} className="w-full">
                      {isLoading ? <Spinner/> : <SparklesIcon className="w-5 h-5"/>} Generate 4 Lifestyle Images
                  </Button>
                  <Button onClick={() => handleSimpleModeGeneration('all')} disabled={isLoading} className="w-full" variant="secondary">
                      {isLoading ? <Spinner/> : <SparklesIcon className="w-5 h-5"/>} Generate All 8 Images
                  </Button>
              </div>
          </div>
        )}

        {workflowMode === 'simple' && (refinedPrompts.length > 0 || isLoading) && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-secondary text-center">Generated Images</h3>
            {renderImageResultGrid(refinedPrompts)}
          </div>
        )}

        {workflowMode === 'advanced' && fashionGarmentFiles.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
              <h3 className="text-lg font-semibold text-secondary text-center mb-4">Step 1: Analyze Garment</h3>
              <Button onClick={handleGenerateFashionAnalysis} disabled={isLoading} className="w-full text-lg">
                {isLoading && !fashionPromptData ? <Spinner /> : <SparklesIcon className="w-5 h-5"/>} Analyze & Generate Initial Prompt
              </Button>
            </div>

            {fashionPromptData && !isLoading && (
              <div className="space-y-6">
                  <h3 className="text-2xl font-semibold text-secondary text-center">Step 2: Review Analysis</h3>
                  <div className="bg-white p-5 rounded-lg shadow-md border border-slate-100">
                      <h4 className="font-semibold text-secondary mb-2">Garment Analysis</h4>
                      <p className="text-slate-800 bg-slate-100 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-60 overflow-y-auto">{fashionPromptData.garmentAnalysis}</p>
                  </div>
                  <div className="bg-white p-5 rounded-lg shadow-md border border-slate-100">
                      <h4 className="font-semibold text-secondary mb-2">QA Checklist</h4>
                      <p className="text-slate-800 bg-slate-100 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-60 overflow-y-auto">{fashionPromptData.qaChecklist}</p>
                  </div>
                  <div className="bg-white p-5 rounded-lg shadow-md border border-slate-100">
                      <h4 className="font-semibold text-secondary mb-2">Initial JSON Prompt</h4>
                      <p className="text-slate-800 bg-slate-100 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-72 overflow-y-auto">{fashionPromptData.initialJsonPrompt}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <Button onClick={copyInitialJsonPrompt} variant="secondary">
                            {fashionInitialJsonPromptCopied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <ClipboardIcon className="w-5 h-5" />}
                            {fashionInitialJsonPromptCopied ? 'Copied!' : 'Copy Prompt'}
                        </Button>
                        <Button onClick={handleAutoQa} disabled={isLoading}>
                            {isLoading && refinedPrompts.length === 0 ? <Spinner /> : <WandSparklesIcon className="w-5 h-5" />}
                             Generate & Send to QA
                        </Button>
                      </div>
                  </div>
                  
                  <div className="border-t-2 border-slate-200 pt-6 mt-8 space-y-6">
                      <h3 className="text-2xl font-semibold text-secondary text-center">Step 3: QA & Final Prompt Generation</h3>
                      <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
                          <label htmlFor="qa-image-upload" className="block text-md font-medium text-sky-500 mb-3 text-center">Upload Generated Image (from Initial Prompt)</label>
                          {generatedFashionImagePreviewUrl ? (
                              <div className="text-center">
                                  <img src={generatedFashionImagePreviewUrl} alt="QA preview" className="max-h-72 w-auto mx-auto rounded-md shadow-md mb-3" />
                                  <Button variant="secondary" onClick={clearGeneratedFashionImage}><XCircleIcon className="w-4 h-4" /> Clear Image</Button>
                              </div>
                          ) : (
                              <div onClick={() => document.getElementById('qa-image-upload')?.click()} className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-lg p-8 text-center cursor-pointer max-w-md mx-auto">
                                <input type="file" id="qa-image-upload" accept="image/*" onChange={handleGeneratedFashionImageFileChange} className="hidden" />
                                <UploadIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-500">Click or drag & drop QA image.</p>
                              </div>
                          )}
                          <Button onClick={handleQaAndRefinePrompts} disabled={isLoading || !generatedFashionImageFile} className="w-full mt-6 text-lg">
                              {isLoading && refinedPrompts.length === 0 ? <Spinner /> : <WandSparklesIcon className="w-5 h-5" />}
                              Perform QA & Generate Final Prompts
                          </Button>
                      </div>
                  </div>
              </div>
            )}
            
            {refinedPrompts.length > 0 && !isLoading && (
              <div className="border-t-2 border-slate-200 pt-6 mt-8 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 rounded-lg shadow-md border border-slate-100">
                    <h3 className="text-xl font-semibold text-secondary">Step 4: Generate Final Images</h3>
                    <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${isDevMode ? 'text-slate-500' : 'text-secondary'}`}>Images</span>
                        <button onClick={() => setIsDevMode(!isDevMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDevMode ? 'bg-slate-400' : 'bg-sky-600'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDevMode ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-sm font-medium ${isDevMode ? 'text-secondary' : 'text-slate-500'}`}>Prompts</span>
                    </div>
                </div>

                {isDevMode ? (
                  <div className="space-y-4">
                    {refinedPrompts.map((item) => (
                      <div key={item.id} className="bg-white p-5 rounded-lg shadow-md border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-sky-500">{item.title}</h4>
                          {item.isLoadingImage && <Spinner className="w-5 h-5 text-sky-500"/>}
                        </div>
                        <p className="text-slate-800 bg-slate-100 p-3 rounded-md whitespace-pre-wrap text-sm pretty-scrollbar max-h-48 overflow-y-auto">{item.prompt}</p>
                        <div className="flex items-center flex-wrap gap-4 mt-4">
                            <Button onClick={() => copyRefinedPrompt(item.id)} variant="secondary" size="sm" disabled={item.isLoadingImage}>
                               {item.isCopied ? <CheckIcon className="w-4 h-4 text-green-500"/> : <ClipboardIcon className="w-4 h-4" />} {item.isCopied ? 'Copied' : 'Copy'}
                            </Button>
                             <select
                                value={item.aspectRatio}
                                onChange={(e) => handleAspectRatioChange(item.id, e.target.value)}
                                disabled={item.isLoadingImage}
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 p-2 disabled:opacity-50"
                                aria-label="Aspect Ratio"
                            >
                                <option value="3:4">3:4 (Portrait)</option>
                                <option value="4:3">4:3 (Landscape)</option>
                                <option value="1:1">1:1 (Square)</option>
                                <option value="16:9">16:9 (Widescreen)</option>
                                <option value="9:16">9:16 (Tall)</option>
                            </select>
                            <Button onClick={() => handleGenerateSingleImage(item.id)} size="sm" disabled={item.isLoadingImage}>
                              {item.isLoadingImage ? <Spinner/> : <SparklesIcon className="w-4 h-4"/>} Generate Image
                            </Button>
                        </div>
                        {item.imageUrl && !item.isLoadingImage && (
                            <div className="mt-4">
                                <img src={item.imageUrl} onLoad={(e) => e.currentTarget.classList.remove('blur-lg')} alt={`Generated: ${item.title}`} className="rounded-lg shadow-md border border-slate-200 max-w-xs mx-auto blur-lg transition-all duration-700" />
                            </div>
                        )}
                         {item.error && !item.isLoadingImage && (
                            <div className="mt-3 text-red-600 text-sm p-2 bg-red-50 rounded border border-red-200">{item.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg shadow-md border border-slate-100">
                      <Button onClick={() => handleImagePackGeneration('studio')} disabled={isLoading} className="flex-1">
                          {isLoading ? <Spinner/> : <SparklesIcon className="w-5 h-5"/>} Generate 4 Studio Images
                      </Button>
                      <Button onClick={() => handleImagePackGeneration('lifestyle')} disabled={isLoading} className="flex-1">
                          {isLoading ? <Spinner/> : <SparklesIcon className="w-5 h-5"/>} Generate 4 Lifestyle Images
                      </Button>
                      <Button onClick={() => handleImagePackGeneration('all')} disabled={isLoading} variant="secondary" className="flex-1">
                          {isLoading ? <Spinner/> : <SparklesIcon className="w-5 h-5"/>} Generate All 8 Images
                      </Button>
                    </div>
                    {renderImageResultGrid(refinedPrompts)}
                  </div>
                )}
              </div>
            )}
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
