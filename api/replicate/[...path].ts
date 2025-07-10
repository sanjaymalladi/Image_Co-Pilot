// @ts-nocheck
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

async function handler(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const replicatePath = pathname.replace(/^\/api\/replicate\//, '');
  const url = `https://api.replicate.com/v1/${replicatePath}${search}`;

  // Clone headers except host & encoding
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (['host', 'accept-encoding'].includes(key.toLowerCase())) return;
    headers[key] = value;
  });
  headers['authorization'] = `Bearer ${process.env.REPLICATE_API_TOKEN}`;

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler; 