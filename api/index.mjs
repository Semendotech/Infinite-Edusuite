import { Buffer } from 'node:buffer';

// Node serverless (Vercel) handler — ESM. This adapts the Node `req,res`
// into a WHATWG `Request`, calls the built server's `fetch`, and returns the Response.

export default async function handler(req, res) {
  try {
    const host = req.headers.host || 'localhost';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const url = `${protocol}://${host}${req.url}`;

    const init = {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    };

    const request = new Request(url, init);

    const mod = await import('../dist/server/server.js');
    const server = mod?.default ?? mod;
    if (!server || typeof server.fetch !== 'function') {
      console.error('Built server entry missing or invalid:', Object.keys(mod || {}));
      res.statusCode = 500;
      res.end('Server build not available');
      return;
    }

    const response = await server.fetch(request, undefined, undefined);

    // Set status and headers
    res.statusCode = response.status;
    response.headers.forEach((value, name) => {
      // Vercel reserves some headers; set others directly
      res.setHeader(name, value);
    });

    // Send body
    const buf = await response.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error('Node handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
