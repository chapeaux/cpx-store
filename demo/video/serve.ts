// Static file server for the video demo pages. Serves the whole package
// root (not just demo/video/) so relative imports like `../../cpx-store.js`
// resolve exactly as they do when the files are opened directly.
const ROOT = new URL("../../", import.meta.url);
const PORT = 8000;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/typescript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname === "/" ? "/demo/video/01-simple-example.html" : url.pathname;

  if (pathname.includes("..")) return new Response("Bad Request", { status: 400 });

  try {
    const fileUrl = new URL("." + pathname, ROOT);
    const file = await Deno.readFile(fileUrl);
    const ext = pathname.slice(pathname.lastIndexOf("."));
    return new Response(file, {
      headers: { "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
});

console.log(`Demo files served at http://localhost:${PORT}/`);
console.log(`  http://localhost:${PORT}/demo/video/01-simple-example.html`);
console.log(`  http://localhost:${PORT}/demo/video/02-react-vs-cpx.html`);
console.log(`  http://localhost:${PORT}/demo/video/05-persistence-example.html`);
