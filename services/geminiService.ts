
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { generateImageViaReplicate } from "./replicateService";
import { FileConversionResult } from "../utils/fileUtils";
import { FashionPromptData, RefinedPromptItem } from "../App"; 

const API_KEY = process.env.API_KEY;

if (!API_KEY || API_KEY.trim() === "") {
  console.error("API_KEY environment variable not set or is empty. Please ensure it is configured.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });
const model = 'gemini-2.5-flash';
// We no longer rely on Google Imagen (billing-restricted) for image generation.
// Instead, we call our Replicate helper which uses Stability AI SDXL (or any model you configure there).
const imageModel = 'replicate-sdxl'; // symbolic only – not used directly.

interface ImageInput extends FileConversionResult {}

interface RefinedStudioPrompt {
  title: string;
  prompt: string;
}

interface GeneratedImageResult {
  id: string;
  imageUrl?: string;
  error?: string;
}

// Helper: fetch an image URL and convert it to base64 (needed for downstream QA steps)
const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch generated image for base64 conversion: ${response.status}`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { base64, mimeType };
};

const generateImageFromPrompt = async (prompt: string, aspectRatio: string): Promise<string> => {
  try {
    const imageUrl = await generateImageViaReplicate({
      prompt,
      aspect_ratio: aspectRatio,
    });
    return imageUrl;
  } catch (error) {
    console.error('Error calling Replicate for image generation:', error);
    if (error instanceof Error) throw new Error(`Replicate Error: ${error.message}`);
    throw new Error('An unknown error occurred during image generation via Replicate.');
  }
};

export const generateSingleImage = async (prompt: string, aspectRatio: string): Promise<string> => {
  return await generateImageFromPrompt(prompt, aspectRatio);
};

export const generateInitialQaImage = async (prompt: string): Promise<ImageInput> => {
  const imageUrl = await generateImageFromPrompt(prompt, '3:4');

  // If Replicate already returned a data URL, extract base64 directly; otherwise fetch & convert.
  if (imageUrl.startsWith('data:')) {
    const base64Data = imageUrl.split(',')[1];
    const mimeMatch = imageUrl.match(/^data:(.*?);base64,/);
    return { base64: base64Data, mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg' };
  }

  const { base64, mimeType } = await urlToBase64(imageUrl);
  return { base64, mimeType };
};

export const generateImagePack = async (promptsToGenerate: RefinedPromptItem[]): Promise<GeneratedImageResult[]> => {
  const generationPromises = promptsToGenerate.map(async (promptItem) => {
    try {
      const imageUrl = await generateImageFromPrompt(promptItem.prompt, promptItem.aspectRatio);
      return { id: promptItem.id, imageUrl };
    } catch (err: any) {
      return { id: promptItem.id, error: err.message || 'Image generation failed.' };
    }
  });
  return Promise.all(generationPromises);
};

export const generateFashionAnalysisAndInitialJsonPrompt = async (
    garmentImages: ImageInput[],
    backgroundRefImages?: ImageInput[],
    modelRefImages?: ImageInput[]
): Promise<FashionPromptData> => {
    if (!garmentImages || garmentImages.length === 0 || garmentImages.length > 2) {
        throw new Error("Please provide 1 or 2 garment images.");
    }
    
    let imageProcessingInstruction = "You will be provided with one image of a garment. Analyze it accordingly.";
    if (garmentImages.length === 2) {
        imageProcessingInstruction = `You will be provided with two garment images.
First, determine if these two images show:
(a) The same garment from different perspectives or details.
(b) Two distinct garments (e.g., a top and a bottom, or two different dresses).

If **(a) same garment**: Synthesize all information from both images into a single, comprehensive analysis for that one garment. The 'initialJsonPrompt' should feature this single garment.
If **(b) two distinct garments**:
    - Your 'garmentAnalysis' string must clearly separate the analysis for each garment. Use a format like:
      '**Garment 1 ([briefly name/describe garment from image 1, e.g., Red Silk Blouse]):**\\n[Detailed analysis of Garment 1]\\n\\n**Garment 2 ([briefly name/describe garment from image 2, e.g., Black Denim Jeans]):**\\n[Detailed analysis of Garment 2]'
    - Your 'qaChecklist' string must similarly separate checks for each distinct garment, using a similar heading format.
    - Your 'initialJsonPrompt' (Step 4) must aim to generate an image featuring **both distinct garments** styled appropriately together on a model (or models, if logical for the garments). The prompt should describe this complete look or ensemble clearly.
This distinction is crucial for accurate output.`;
    }

    const systemInstruction = `You are an AI assistant specialized in fashion image prompting. {{image_processing_instruction}}
You may also receive optional background reference images and/or model reference images.
Follow these steps extremely carefully and return the output as a single JSON object with three keys: "garmentAnalysis", "qaChecklist", and "initialJsonPrompt".

🧩 Step 1: Input Analysis
- Study the input garment image(s) in detail. (Handle 1 or 2 images as per the initial instruction above).
- Extract and document the following attributes. If analyzing two distinct garments, do this for each:
    - Garment type (e.g., T-shirt, kurta, dress, onesie, jacket, trousers)
    - Target wearer (infant / child / adult male / adult female)
    - Fabric type and weave (cotton, silk, denim, wool, polyester, jersey, etc.)
    - Color tone (with nuance: e.g., muted dusty blue, vibrant cherry red, matte olive green)
    - Material finish (matte / glossy / satin / velvet / dry)
    - Neckline or collar shape (round neck, V-neck, shirt collar, mandarin collar, lapel)
    - Sleeve style (sleeveless, cap sleeves, cuffed full sleeves, raglan, drop shoulder)
    - Closure details (button, zipper, hook — count, type, spacing, material)
    - Seam type (topstitched, hidden seams, visible decorative seams)
    - Print, embroidery, or patterns (type, size, placement)
    - Fit style (relaxed, slim, oversized, flared)
    - Trims and additional details (pockets, lace, elastics, belts, hoodie)
    - Edge finishing (folded, topstitched, raw hem, piped)
    - Drape and structure (soft flowy, structured crisp, rigid denim, etc.)
- Format this 'garmentAnalysis' as a multi-line string. If two distinct garments, ensure clear separation as instructed.
{{reference_image_instructions}}
- Also consider any provided reference images for background or model appearance when formulating descriptions later, but the core garment analysis here is based on the garment images ONLY.

🛡 Step 2: Checklist Preparation
- Based on the extracted garment attributes from Step 1, dynamically build a strict QA checklist. If analyzing two distinct garments, create checklist sections for each.
- Add special checks based on garment type(s).
    - Example: For suits → lapel sharpness, vent symmetry.
    - Example: For baby onesies → snap closure spacing, fabric softness.
- Format this 'qaChecklist' as a multi-line string. If two distinct garments, ensure clear separation.

🎯 Step 3: Set Ultra-Strict QA Mode
- (This is an internal mode for you for future QA if applicable. No specific text output needed for this key in THIS response, but keep it in mind.)

📈 Step 4: Give a JSON prompt for generating an output
- Based on the input analysis (Step 1) and the QA checklist (Step 2), give a detailed JSON prompt string.
- This JSON prompt string should be suitable for use in an AI image generation model.
- The prompt should aim to generate a premium image (for socials and print) featuring the garment(s) on an appropriate person/people (inferred from garment analysis).
- If one garment was analyzed, feature that garment. If two distinct garments were analyzed, the prompt must feature **both distinct garments** styled as an ensemble or complete look.
- The prompt must specify a **STUDIO background**.
    - If background reference images were provided (see Step 1 instructions), ensure the studio background description (e.g., seamless paper color, texture, simple props) is creatively inspired by their style, mood, or key elements, while *remaining a clean studio setup*. For example, if a reference shows a moody forest, the studio background might be "dark olive green seamless paper with subtle dappled lighting effect" rather than an actual forest.
    - If no background references, use a standard professional studio background (e.g., "light grey seamless paper," "plain white cyclorama wall").
- The prompt must specify professional studio lighting.
- If model reference images were provided (see Step 1 instructions), the description of the model in this JSON prompt should aim to have the generated model resemble the characteristics (features, hair, ethnicity, body type if discernible and appropriate) from those reference images.
- Include model pose(s) and encourage variations to ensure diverse outputs when used.
- This "initialJsonPrompt" must be a single string (copy-paste ready).

Return a single JSON object with the keys "garmentAnalysis", "qaChecklist", and "initialJsonPrompt".
Do not include any other text, explanations, or markdown formatting outside this JSON object.
The entire response MUST be a single, valid JSON object.
Ensure any double quotes within the string values (especially 'initialJsonPrompt') are properly escaped (e.g., "a \\"quoted\\" phrase").
    `.replace('{{image_processing_instruction}}', imageProcessingInstruction)
     .replace('{{reference_image_instructions}}', 
        (backgroundRefImages && backgroundRefImages.length > 0 ? '\n- Optional background reference image(s) are provided. Analyze these for style, mood, key elements, or composition. When generating the \'initialJsonPrompt\' (Step 4), ensure the **STUDIO background** description is subtly inspired or influenced by these references (e.g., color palette, texture hints, overall mood) while remaining a studio setting. Do not simply copy the reference; integrate its essence.' : '') +
        (modelRefImages && modelRefImages.length > 0 ? '\n- Optional model reference image(s) are provided. Analyze these for model appearance (e.g., general features, hair style/color, ethnicity if clearly discernible and relevant, body type). When generating the \'initialJsonPrompt\' (Step 4), the description of the model wearing the garment(s) should reflect these observed characteristics from the reference images. Aim for the generated model to resemble the reference(s).' : '')
     );

    const parts: Part[] = [];
    garmentImages.forEach((img, idx) => {
      parts.push({text: `Input Garment Image ${idx + 1}:`}); 
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
    });
    if (backgroundRefImages && backgroundRefImages.length > 0) {
        parts.push({text: "Optional Background Reference Image(s):"});
        backgroundRefImages.forEach((img) => parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
    }
    if (modelRefImages && modelRefImages.length > 0) {
        parts.push({text: "Optional Model Reference Image(s):"});
        modelRefImages.forEach((img) => parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
    }
    parts.push({ text: `Analyze the images and generate the fashion analysis, QA checklist, and initial JSON prompt.` });
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: { systemInstruction, responseMimeType: "application/json" }
        });

        let jsonStr = (response.text ?? '').trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        if (jsonStr.match(fenceRegex)) jsonStr = jsonStr.match(fenceRegex)![2].trim();
        
        const parsedData = JSON.parse(jsonStr) as FashionPromptData;
        
        if (!parsedData || typeof parsedData.garmentAnalysis !== 'string' || typeof parsedData.qaChecklist !== 'string' || typeof parsedData.initialJsonPrompt !== 'string') {
            throw new Error("API returned an unexpected format for the fashion prompt analysis.");
        }
        
        return parsedData;

    } catch (error) {
        console.error("Error calling Gemini API for fashion analysis:", error);
        if (error instanceof Error) {
            if (error.message.includes("API_KEY_INVALID")) throw new Error("The API key is invalid.");
            if (error.message.includes("Quota")) throw new Error("API quota exceeded.");
            if (error.message.includes("blockedBy")) throw new Error("Generation blocked by safety policy.");
            if (error.message.toLowerCase().includes("json")) throw new Error(`Failed to parse fashion analysis. The response might not be valid JSON.`);
            throw new Error(`Failed to generate fashion analysis from Gemini API: ${error.message}`);
        }
        throw new Error("An unknown error occurred during fashion analysis generation.");
    }
};

export const performQaAndGenerateStudioPrompts = async (
    originalGarmentImages: ImageInput[],
    generatedFashionImage: ImageInput,
    analysisData: FashionPromptData
): Promise<RefinedStudioPrompt[]> => {
    const systemInstruction = `You are an AI fashion QA expert and prompt generator.
You will receive:
1.  Original garment image(s) (1 or 2 images showing the garment(s) to be accurately represented).
2.  A garment analysis (text describing the original garment(s) attributes, possibly influenced by original model/background refs).
3.  A QA checklist (specific points to verify for the original garment(s)).
4.  An initial JSON prompt (the prompt that was ideally used to create an image of the garment(s), possibly influenced by original model/background refs).
5.  The 'generated image' (an image supposedly created based on the initial prompt, which needs QA).

Your tasks are:
A.  **Ultra-Strict QA:**
    -   Compare the 'generated image' meticulously against the 'original garment image(s)', the 'garment analysis', and the 'QA checklist'.
    -   Identify ALL discrepancies: color shifts, fabric weave differences, fit inaccuracies, incorrect seam types, pattern misplacements, errors in closure details, neckline shape, sleeve style, etc. If the analysis specified two garments, check both.
    -   Note if material finish (matte/glossy/satin) is correct for the garment(s).
    -   Assess if the 'generated image' generally adhered to the 'initial JSON prompt' in terms of pose, background, and style, but prioritize accuracy to the *original garment(s)* above all.
    -   Provide a brief summary of key QA findings if significant deviations are found (this summary is for your internal use to inform prompt generation, not for direct output in the JSON).

B.  **Refine & Generate 4 Studio Prompts:**
    -   Based on your QA AND primarily drawing from the accurate details in the 'original garment image(s)' and 'garment analysis', generate 4 NEW, highly detailed studio prompts.
    -   **IMPORTANT CONSISTENCY RULES FOR STUDIO PROMPTS:** For all 4 studio prompts below:
        1.  You **MUST** choose ONE consistent, clean studio background (e.g., "plain white seamless paper background," "soft grey cyclorama wall," "neutral textured backdrop"). This choice can be informed by the 'initial JSON prompt' if it specified a good studio setup.
        2.  You **MUST** choose ONE consistent professional studio lighting setup (e.g., "bright and even studio lighting using softboxes," "dramatic single-source key light with subtle fill," "crisp fashion studio lighting").
        3.  Use these exact same chosen background and lighting descriptions in EACH of the 4 studio prompts. Do not vary them.
    -   These prompts must aim to create images that *perfectly and accurately* represent the *original garment(s) or ensemble* as detailed in the 'garment analysis', in this consistent high-quality studio setting.
    -   The model description in these studio prompts should be consistent with the one described/implied in the 'garment analysis' (which might have been influenced by original model references).
    -   The 4 studio prompts must be titled exactly:
        1.  **"Studio Prompt - Front View"**: Detailed description of the garment(s) on a model, full body or 3/4 shot, model facing front. Emphasize clear visibility of all front details of the garment or ensemble. Incorporate relevant details from the 'garment analysis'.
        2.  **"Studio Prompt - Back View"**: 
            *   **Internal Pre-computation (Mandatory for AI):** Before writing this prompt, meticulously re-examine the 'original garment image(s)' and 'garment analysis'. Internally list ALL back-specific design elements, closures, seam details, fabric behaviors, patterns, prints, texture, and any other distinguishing features visible or relevant to the back of the garment(s) or ensemble.
            *   **Prompt Generation:** This prompt is CRITICAL. Do not be generic. Based on your internal list, provide a detailed description of the garment(s) on a model, full body or 3/4 shot, model facing back/angled to showcase complete back details. Describe specific back design elements, closures, seams, cut/shape of the back, fabric drape/fit from the rear, and patterns/prints visible primarily from this perspective. If an ensemble, describe EACH garment's back. Suggest a pose that unambiguously showcases all critical back details. Incorporate all relevant back details from the 'garment analysis' and your internal pre-computation. The level of detail must be exhaustive.
        3.  **"Studio Prompt - Side View"**: Detailed description of the garment(s) on a model, full body or 3/4 shot, model in profile. Describe silhouette, fit, and side-specific details. Incorporate relevant details from the 'garment analysis'.
        4.  **"Studio Prompt - Close-up Detail"**: Focus on a specific, key feature of the garment(s). If one garment, a key detail (e.g., "texture of the fabric," "embroidery on sleeve"). If an ensemble, a key feature of *one* garment or their interaction (e.g., "close-up of the textured knit of the sweater (Garment 1) where it meets the waistband of the skirt (Garment 2)"). Be specific.
    -   For each studio prompt: Adhere to chosen consistent studio background/lighting. Suggest appropriate model pose. Incorporate all critical details from 'garment analysis'. Correct QA issues implicitly.

C.  **Generate 4 Lifestyle Prompts (with CONSISTENT Background):**
    -   Based on your QA AND primarily drawing from the accurate details in the 'original garment image(s)' and 'garment analysis', generate 4 NEW, distinct lifestyle prompts.
    -   **CRUCIAL BACKGROUND CONSISTENCY:**
        1.  First, establish **ONE SINGLE, CONSISTENT, highly detailed, and realistic lifestyle background scene.**
            *   This scene's *concept* should be inspired by any background ideas present in the 'initial JSON prompt' (which itself might have been influenced by user-provided background reference images during the initial analysis phase).
            *   If the 'initial JSON prompt' provides a clear lifestyle background concept, elaborate on it richly for this single scene.
            *   If no strong background concept is evident from the 'initial JSON prompt' or if no background references were used initially, then you must invent ONE suitable, aspirational, and detailed lifestyle setting appropriate for the garment(s)/ensemble (e.g., "a sun-drenched Italian cafe terrace with terracotta pots and distant rolling hills," "a minimalist art gallery interior with large abstract paintings and polished concrete floors," "a vibrant autumn park scene with golden leaves and a cobblestone path").
        2.  Once this single lifestyle background scene is established and described in detail, **USE THIS EXACT SAME DETAILED BACKGROUND SCENE DESCRIPTION in EACH of the 4 lifestyle prompts.** Do not create four entirely different locations.
        3.  The variation in the 4 lifestyle prompts should come from:
            *   Different model poses and actions *within this same scene*.
            *   Different camera angles or perspectives focusing on the model and garment(s) *within this same scene*.
            *   Subtle variations in lighting if natural (e.g., "golden hour light casting long shadows across the previously described cafe terrace," "soft, diffused daylight filtering into the same art gallery").
    -   The model description in these lifestyle prompts should be consistent with the one described/implied in the 'garment analysis'.
    -   These prompts must aim to create images that *accurately* represent the *original garment(s) or ensemble* in this consistent lifestyle setting.
    -   The 4 lifestyle prompts must be titled exactly:
        1.  **"Lifestyle Prompt - Scene 1"**
        2.  **"Lifestyle Prompt - Scene 2"**
        3.  **"Lifestyle Prompt - Scene 3"**
        4.  **"Lifestyle Prompt - Scene 4"**
    -   For EACH of these 4 lifestyle prompts:
        -   Start with the established consistent, detailed background scene description.
        -   Then, describe the model wearing the garment(s) naturally, interacting within *that specific part* of the consistent scene, or viewed from a different angle within it.
        -   Suggest appropriate model poses, dynamic camera angles, and lighting suitable for *that part* of the consistent scene.
        -   Incorporate all critical details from the 'garment analysis' (fabric, color, fit, style, specific features for each garment if multiple) to ensure faithful representation.
        -   If your QA noted issues in the 'generated image', the new prompts should implicitly correct these by focusing on the true garment attributes.

**VERY IMPORTANT OUTPUT FORMATTING for ALL 8 Prompts:**
-   Your entire response MUST be a single, valid JSON array of objects.
-   Each object in the array MUST have a "title" field (exactly as listed for all 8 prompts above) and a "prompt" field (the generated text prompt as a string).
-   There should be exactly 8 objects in the array (4 studio, 4 lifestyle).
-   Do NOT include any other text, explanations, code block fences (like \`\`\`json), or markdown formatting outside of this single JSON array.
-   The JSON array should start with '[' and end with ']'.
-   **Crucially, ensure that any double quotes (") within the textual description of ANY prompt MUST be escaped (e.g., using \\\\" for a quote, so it would look like: "a model wearing a \\\\\\"silken\\\\\\" dress").**`;

    const parts: Part[] = [];
    originalGarmentImages.forEach((img, index) => {
        parts.push({text: `Original Garment Image ${index + 1}:`});
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 }});
    });
    parts.push({text: "Garment Analysis:"}, {text: analysisData.garmentAnalysis});
    parts.push({text: "QA Checklist:"}, {text: analysisData.qaChecklist});
    parts.push({text: "Initial JSON Prompt:"}, {text: analysisData.initialJsonPrompt});
    parts.push({text: "Generated Image (for QA):"});
    parts.push({ inlineData: { mimeType: generatedFashionImage.mimeType, data: generatedFashionImage.base64 } });
    parts.push({ text: `Perform QA and generate the 8 final prompts.` });

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: { systemInstruction, responseMimeType: "application/json" }
        });

        let jsonStr = (response.text ?? '').trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        if (jsonStr.match(fenceRegex)) jsonStr = jsonStr.match(fenceRegex)![2].trim();
        
        const parsedData = JSON.parse(jsonStr) as RefinedStudioPrompt[];
        
        const expectedTitles = ["Studio Prompt - Front View", "Studio Prompt - Back View", "Studio Prompt - Side View", "Studio Prompt - Close-up Detail", "Lifestyle Prompt - Scene 1", "Lifestyle Prompt - Scene 2", "Lifestyle Prompt - Scene 3", "Lifestyle Prompt - Scene 4"];

        if (!Array.isArray(parsedData) || parsedData.length !== expectedTitles.length) {
            throw new Error(`API returned an incorrect number or format of refined prompts.`);
        }
        if (!parsedData.every(item => typeof item?.title === 'string' && typeof item?.prompt === 'string')) {
            throw new Error("One or more refined prompt items from API are malformed.");
        }
        
        return parsedData;

    } catch (error) {
        console.error("Error calling Gemini API for QA and refined prompts:", error);
        if (error instanceof Error) {
            if (error.message.includes("API_KEY_INVALID")) throw new Error("The API key is invalid.");
            if (error.message.includes("Quota")) throw new Error("API quota exceeded.");
            if (error.message.includes("blockedBy")) throw new Error("Generation blocked by safety policy.");
            if (error.message.toLowerCase().includes("json")) throw new Error(`Failed to parse refined prompts. The response might not be valid JSON.`);
            throw new Error(`Failed to generate refined prompts from Gemini API: ${error.message}`);
        }
        throw new Error("An unknown error occurred during QA and prompt generation.");
    }
};
