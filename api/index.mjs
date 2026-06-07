import server from "../dist/server/server.js";

function buildFetchRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value != null) {
      headers.set(key, String(value));
    }
  }

  const body = (req.method === "GET" || req.method === "HEAD") ? null : req;

  return new Request(url, { method: req.method, headers, body });
}

export default async function handler(req, res) {
  try {
    const fetchReq = buildFetchRequest(req);
    const response = await server.fetch(fetchReq, process.env, undefined);

    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      // Vercel/res.setHeader expects header values as string
      res.setHeader(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}
