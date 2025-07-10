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

export const generateImageViaReplicate = async (inputs: ReplicateInputs): Promise<string> => {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Server error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    if (!data.url || typeof data.url !== 'string') {
      throw new Error('Invalid response from generate-image endpoint');
    }
    return data.url;
  } catch (err: any) {
    console.error('generateImageViaReplicate error:', err);
    throw err;
  }
};
