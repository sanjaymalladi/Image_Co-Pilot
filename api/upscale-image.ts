import Replicate from 'replicate';

interface UpscaleRequest {
    image_url: string;
    scale: 2 | 4;
    output_format?: 'jpg' | 'png';
}

export default async function handler(req: any, res: any) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN env var' });
    }

    let body: UpscaleRequest;
    try {
        let rawBody: any = req.body;
        if (Buffer.isBuffer(rawBody)) {
            rawBody = rawBody.toString('utf8');
        }
        if (typeof rawBody === 'string') {
            body = JSON.parse(rawBody);
        } else {
            body = rawBody as UpscaleRequest;
        }
    } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { image_url, scale, output_format = 'png' } = body;

    // Validate input
    if (!image_url) {
        return res.status(400).json({ error: 'image_url is required' });
    }

    if (![2, 4].includes(scale)) {
        return res.status(400).json({ error: 'scale must be 2 or 4' });
    }

    if (!['jpg', 'png'].includes(output_format)) {
        return res.status(400).json({ error: 'output_format must be jpg or png' });
    }

    // Validate image_url format
    if (!image_url.startsWith('http') && !image_url.startsWith('data:')) {
        return res.status(400).json({ error: 'image_url must be a valid URL or data URL' });
    }

    // Initialize Replicate with auth token
    const replicate = new Replicate({
        auth: token,
    });

    const MODEL_NAME = 'nightmareai/real-esrgan';

    try {
        const prediction = await replicate.run(MODEL_NAME, {
            input: {
                image: image_url,
                scale: scale,
                face_enhance: false, // Set to true if you want face enhancement
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
                details: 'The upscaling model returned an unexpected response format'
            });
        }

        // Return the upscaled image URL
        return res.status(200).json({
            url: outputUrl,
            scale: scale,
            format: output_format
        });

    } catch (err: any) {
        console.error('Replicate upscale error:', err);

        // Handle specific Replicate errors
        if (err.message?.includes('quota') || err.message?.includes('limit')) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                details: 'Please try again later'
            });
        }

        if (err.message?.includes('timeout')) {
            return res.status(408).json({
                error: 'Request timeout',
                details: 'The upscaling operation took too long to complete'
            });
        }

        return res.status(500).json({
            error: 'Image upscaling failed',
            details: err?.message || 'An unknown error occurred during image upscaling'
        });
    }
}