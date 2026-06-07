export const config = { runtime: 'edge' };

// This Edge function forwards all incoming requests to the built TanStack Start
// server entry under `dist/server/server.js` which exposes a `fetch(request)` handler.
// Vercel will run the build (`npm run build`) before deployment so `dist` should exist.

import server from '../dist/server/server.js';

export default async function handler(request) {
  // Forward the incoming Request to the server's fetch handler and return its Response.
  try {
    const response = await server.fetch(request, undefined, undefined);
    return response;
  } catch (err) {
    console.error('Edge handler error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
