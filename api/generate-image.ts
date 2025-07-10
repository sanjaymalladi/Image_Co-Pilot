import Replicate from 'replicate';

interface GenerateImageRequest {
  prompt: string;
  aspect_ratio: string; // e.g. "1:1" or "3:4"
  input_images?: string[]; // data URLs or https URLs
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN env var' });
  }

  let body: GenerateImageRequest;
  try {
    let rawBody: any = req.body;
    if (Buffer.isBuffer(rawBody)) {
      rawBody = rawBody.toString('utf8');
    }
    if (typeof rawBody === 'string') {
      body = JSON.parse(rawBody);
    } else {
      body = rawBody as GenerateImageRequest;
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { prompt, aspect_ratio, input_images = [] } = body;
  if (!prompt || !aspect_ratio) {
    return res.status(400).json({ error: 'prompt and aspect_ratio are required' });
  }

  // Initialize Replicate with auth token
  const replicate = new Replicate({
    auth: token,
  });

  // Ensure all images are URLs. For data URLs, we'll need to handle them differently
  // since Replicate v0.25.2 doesn't have direct file upload support
  const processedUrls: string[] = [];
  for (const img of input_images) {
    if (!img) continue;
    if (img.startsWith('data:')) {
      // For data URLs, we'll need to use them directly
      processedUrls.push(img);
    } else {
      processedUrls.push(img);
    }
  }

  // If no images were processed, return an error since the model requires them
  if (processedUrls.length === 0) {
    return res.status(400).json({ error: 'At least one valid input image is required' });
  }

  const MODEL_NAME = 'flux-kontext-apps/multi-image-list';

  try {
    const prediction = await replicate.run(MODEL_NAME, {
      input: {
        prompt,
        aspect_ratio,
        input_images: processedUrls,
        output_format: 'png',
        safety_tolerance: 2,
      },
    });

    // Handle the prediction result
    let outputUrl: string | undefined;
    if (Array.isArray(prediction)) {
      outputUrl = prediction[0];
    } else if (typeof prediction === 'string') {
      outputUrl = prediction;
    }

    if (!outputUrl) {
      return res.status(500).json({ error: 'Unexpected Replicate output format' });
    }

    res.status(200).json({ url: outputUrl });
  } catch (err: any) {
    console.error('Replicate generation error:', err);
    res.status(500).json({ error: 'Replicate generation failed', details: err?.message });
  }
} 