// @ts-nocheck
// Use the standard Web Fetch API types available in the Edge Runtime.

export const config = {
  runtime: 'edge',
};

async function handle(request: Request) {
  const { pathname, search } = new URL(request.url);
  const replicatePath = pathname.replace(/^\/api\/replicate\//, '');
  const url = `https://api.replicate.com/v1/${replicatePath}${search}`;

  // Clone headers except host & encoding
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (['host', 'accept-encoding'].includes(key.toLowerCase())) return;
    headers[key] = value;
  });
  headers['authorization'] = `Bearer ${process.env.REPLICATE_API_TOKEN}`;

  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export default handle; 