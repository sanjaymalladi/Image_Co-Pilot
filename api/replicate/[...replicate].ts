// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy any request under /api/replicate/** to Replicate’s official HTTP API.
 * This is implemented as a **Node.js Serverless Function** (default runtime on Vercel).
 *
 * Usage examples from the client:
 *   • GET  /api/replicate/models/{owner}/{model}
 *   • POST /api/replicate/predictions { version, input }
 */

export default async function replicateProxy(req: VercelRequest, res: VercelResponse) {
  // Validate token early so we fail fast in case of mis-configuration.
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN environment variable' });
  }

  // Build the full Replicate API URL by stripping the local prefix.
  // req.url is always defined in Vercel Functions.
  const replicatePath = req.url!.replace(/^\/api\/replicate/, '');
  const targetUrl = `https://api.replicate.com/v1${replicatePath}`;

  // Copy inbound headers, excluding ones that should not be forwarded.
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (['host', 'accept-encoding'].includes(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(',') : value;
  }
  headers['authorization'] = `Bearer ${token}`;

  // For GET / HEAD there is no body; for others forward the raw buffer.
  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
  } as any;

  try {
    const response = await fetch(targetUrl, fetchOptions);

    // Forward status & headers back to the client.
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Pipe the response body directly.
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Replicate proxy error:', err);
    res.status(500).json({ error: 'Proxy request to Replicate failed', details: err?.message });
  }
} 