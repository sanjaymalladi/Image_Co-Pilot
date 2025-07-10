interface ReplicateInputs {
  prompt: string;
  aspect_ratio: string; // e.g., "1:1", "16:9"
  input_images?: string[]; // Optional reference images (some models ignore this)
  safety_tolerance?: number; // 0 (strict) to 2 (most permissive)
  disable_safety_checker?: boolean; // true to bypass model safety filter if supported
  // Add other Replicate model-specific inputs if needed
}

interface ReplicatePrediction {
  id: string;
  model: string;
  version: string;
  input: Record<string, any>;
  logs: string | null;
  error: any | null;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  urls: {
    get: string;
    cancel: string;
  };
  output?: any; // Output structure varies by model
}

// Two models: multi-image fusion and text-only fallback.
const FUSION_MODEL = 'flux-kontext-apps/multi-image-list';
const TEXT_MODEL = 'stability-ai/sdxl';
const POLLING_INTERVAL_MS = 3000; // 3 seconds
const MAX_POLLING_ATTEMPTS = 100; // Max attempts (100 * 3s = 5 minutes)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resolve the default or latest model version for the specified Replicate model.
 */
const fetchModelVersion = async (modelName: string): Promise<string> => {
  const response = await fetch(`/api/replicate/models/${modelName}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch model info: ${response.status} ${body}`);
  }
  const data = await response.json();
  const versionId =
    data?.default_version?.id ||
    data?.latest_version?.id ||
    (Array.isArray(data?.versions) && data.versions.length > 0 ? data.versions[0].id : undefined);
  if (!versionId) {
    throw new Error('Unable to determine default version for model.');
  }
  return versionId as string;
};

/**
 * Generate an image using Replicate's HTTP API. This function expects the Vite dev server (or your production
 * backend) to proxy `/api/replicate/*` requests to `https://api.replicate.com/v1` **and** to attach the
 * `Authorization: Bearer <REPLICATE_API_TOKEN>` header. This keeps your secret API token on the server side.
 */
export const generateImageViaReplicate = async (inputs: ReplicateInputs): Promise<string> => {
  // Build the payload dynamically; include optional fields only when defined
  const inputPayload: Record<string, any> = {
    prompt: inputs.prompt,
  };

  // Some text-only models accept an "aspect_ratio" param; if yours doesn't, feel free to remove it.
  if (inputs.aspect_ratio) inputPayload['aspect_ratio'] = inputs.aspect_ratio;

  if (inputs.input_images && inputs.input_images.length > 0) {
    inputPayload['input_images'] = inputs.input_images;
  }

  if (typeof inputs.safety_tolerance === 'number') {
    inputPayload['safety_tolerance'] = inputs.safety_tolerance;
  }

  if (typeof inputs.disable_safety_checker === 'boolean') {
    inputPayload['disable_safety_checker'] = inputs.disable_safety_checker;
  }

  // Choose model based on whether images are supplied
  const modelToUse = (inputs.input_images && inputs.input_images.length > 0) ? FUSION_MODEL : TEXT_MODEL;

  // If fusion model chosen but no images (empty array), throw early
  if (modelToUse === FUSION_MODEL && (!inputs.input_images || inputs.input_images.length === 0)) {
    throw new Error('The fusion model requires at least one image in `input_images`.');
  }

  console.log('Replicate → Using model:', modelToUse);
  console.log('Replicate → Input:', inputPayload);

  try {
    console.log('Replicate → Resolving model version…');
    const modelVersion = await fetchModelVersion(modelToUse);
    console.log('Replicate → Resolved version:', modelVersion);

    console.log('Replicate → Creating prediction…');
    const createResponse = await fetch('/api/replicate/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: modelVersion,
        input: inputPayload,
      }),
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      throw new Error(`Failed to create prediction: ${createResponse.status} ${errorBody}`);
    }

    const prediction: ReplicatePrediction = await createResponse.json();
    console.log('Replicate → Prediction created:', prediction.id);

    // Poll until the prediction finishes (succeeded / failed / canceled)
    let attempts = 0;
    while (attempts < MAX_POLLING_ATTEMPTS) {
      attempts += 1;
      await delay(POLLING_INTERVAL_MS);

      const pollUrl = prediction.urls.get.replace('https://api.replicate.com/v1', '/api/replicate');
      const pollResponse = await fetch(pollUrl);

      if (!pollResponse.ok) {
        const errorBody = await pollResponse.text();
        if (pollResponse.status === 429) {
          // Rate limited – wait a bit longer and retry.
          console.warn('Replicate → Rate-limited while polling. Retrying…');
          await delay(POLLING_INTERVAL_MS * 2);
          continue;
        }
        throw new Error(`Polling error: ${pollResponse.status} ${errorBody}`);
      }

      const polledPrediction: ReplicatePrediction = await pollResponse.json();
      console.log(`Replicate → Poll #${attempts}: ${polledPrediction.status}`);

      if (polledPrediction.status === 'succeeded') {
        if (polledPrediction.output) {
          // The output can be either an array of URLs or a single string URL depending on the model.
          const outputUrl = Array.isArray(polledPrediction.output)
            ? polledPrediction.output[0]
            : polledPrediction.output;
          if (typeof outputUrl === 'string') {
            console.log('Replicate → Success. Output URL:', outputUrl);
            return outputUrl;
          }
        }
        throw new Error('Prediction succeeded but the output format was unexpected.');
      }

      if (polledPrediction.status === 'failed') {
        throw new Error(`Prediction failed: ${polledPrediction.error || 'Unknown error'}`);
      }

      if (polledPrediction.status === 'canceled') {
        throw new Error('Prediction was canceled.');
      }
    }

    throw new Error('Prediction timed out after maximum polling attempts.');
  } catch (error) {
    console.error('Replicate → Error:', error);
    if (error instanceof Error) throw new Error(`Replicate error: ${error.message}`);
    throw new Error('An unknown error occurred while generating an image with Replicate.');
  }
};
