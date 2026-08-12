const PORT = 8787;

Deno.serve({ port: PORT }, async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers });

  const { message } = await req.json();
  const alertMessage = `Server processed "${message}" at ${new Date().toISOString()}`;

  return new Response(JSON.stringify({ alertMessage }), { headers });
});

console.log(`Alert server running at http://localhost:${PORT}`);
