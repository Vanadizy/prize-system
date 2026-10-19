import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, "dist");
const indexFile = path.join(buildDir, "index.html");
const port = Number(process.env.PORT) || 10000;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

if (!existsSync(indexFile)) {
  console.error("Frontend build not found. Run `npm run build` before starting the server.");
  process.exit(1);
}

createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "");
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const requestedFile = path.resolve(buildDir, requestPath || "index.html");
  if (requestedFile !== buildDir && !requestedFile.startsWith(`${buildDir}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  const filePath = existsSync(requestedFile) && statSync(requestedFile).isFile()
    ? requestedFile
    : path.extname(requestPath) ? null : indexFile;
  if (!filePath) {
    response.writeHead(404).end("Not found");
    return;
  }

  const headers = {
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": filePath === indexFile ? "no-cache" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  response.writeHead(200, headers);
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
}).listen(port, "0.0.0.0", () => {
  console.log(`Frontend Node server listening on port ${port}`);
});
