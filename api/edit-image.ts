import Replicate from 'replicate';

interface EditImageRequest {
  prompt: string;
  input_image: string; // URL or data URL
  output_format?: 'jpg' | 'png';
  num_inference_steps?: number;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN env var' });
  }

  let body: EditImageRequest;
  try {
    let rawBody: any = req.body;
    if (Buffer.isBuffer(rawBody)) {
      rawBody = rawBody.toString('utf8');
    }
    if (typeof rawBody === 'string') {
      body = JSON.parse(rawBody);
    } else {
      body = rawBody as EditImageRequest;
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const {
    prompt,
    input_image,
    output_format = 'png',
    num_inference_steps = 30
  } = body;

  if (!prompt || !input_image) {
    return res.status(400).json({ error: 'prompt and input_image are required' });
  }

  // Validate input_image format
  if (!input_image.startsWith('http') && !input_image.startsWith('data:')) {
    return res.status(400).json({ error: 'input_image must be a valid URL or data URL' });
  }

  // Initialize Replicate with auth token
  const replicate = new Replicate({
    auth: token,
  });

  const MODEL_NAME = 'black-forest-labs/flux-kontext-dev';

  try {
    const prediction = await replicate.run(MODEL_NAME, {
      input: {
        prompt,
        input_image,
        output_format,
        num_inference_steps,
      },
    });

    // Handle the prediction result
    let outputUrl: string | undefined;
    if (Array.isArray(prediction)) {
      outputUrl = prediction[0];
    } else if (typeof prediction === 'string') {
      outputUrl = prediction;
    } else if (prediction && typeof prediction === 'object' && 'output' in prediction) {
      // Handle case where prediction has an output property
      const output = (prediction as any).output;
      if (Array.isArray(output)) {
        outputUrl = output[0];
      } else if (typeof output === 'string') {
        outputUrl = output;
      }
    }

    if (!outputUrl) {
      console.error('Unexpected Replicate output format:', prediction);
      return res.status(500).json({
        error: 'Unexpected Replicate output format',
        details: 'The model returned an unexpected response format'
      });
    }

    res.status(200).json({ url: outputUrl });
  } catch (err: any) {
    console.error('Replicate edit error:', err);

    // Handle specific Replicate errors
    if (err.message?.includes('safety')) {
      return res.status(400).json({
        error: 'Content safety violation',
        details: 'The edit request was blocked by safety filters'
      });
    }

    if (err.message?.includes('quota') || err.message?.includes('limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        details: 'Please try again later'
      });
    }

    if (err.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout',
        details: 'The edit operation took too long to complete'
      });
    }

    res.status(500).json({
      error: 'Image edit failed',
      details: err?.message || 'An unknown error occurred during image editing'
    });
  }
}