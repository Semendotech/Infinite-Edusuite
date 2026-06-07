import { Buffer } from 'node:buffer';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';

const startHandler = createStartHandler(defaultStreamHandler);

// Node serverless (Vercel) handler — ESM. This adapts the Node `req,res`
// into a WHATWG `Request`, calls the TanStack Start server handler, and returns the Response.

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
    const response = await startHandler(request);

    res.statusCode = response.status;
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(name, value);
    });

    const buf = await response.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error('Node handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
