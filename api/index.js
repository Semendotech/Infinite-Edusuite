export const config = { runtime: 'edge' };

// Dynamically import the built server at request time. This avoids bundling-time
// failures on Vercel when `dist/` does not exist yet during the build phase.
export default async function handler(request) {
  try {
    const mod = await import('../dist/server/server.js');
    const server = mod?.default ?? mod;
    if (!server || typeof server.fetch !== 'function') {
      console.error('Built server entry not found or invalid:', Object.keys(mod || {}));
      return new Response('Server not available', { status: 500 });
    }

    // Call the server's fetch handler and return its Response directly.
    const response = await server.fetch(request, undefined, undefined);
    return response;
  } catch (err) {
    console.error('Edge handler error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
