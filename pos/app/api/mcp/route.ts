import { verifyBearer, detectAgent } from "@/lib/server/auth";
import { CORS, originOf } from "@/lib/server/http";
import { handleRpc } from "@/lib/server/mcp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function unauthorized(req: Request, message = "Missing or invalid access token") {
  const meta = `${originOf(req)}/.well-known/oauth-protected-resource/api/mcp`;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }), {
    status: 401,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer realm="tilda", error="invalid_token", resource_metadata="${meta}"`,
    },
  });
}

export async function POST(req: Request) {
  const auth = await verifyBearer(req.headers.get("authorization"));
  if (!auth) return unauthorized(req);
  if (auth.actor.agent === "other") {
    const hint = detectAgent(req.headers.get("user-agent"));
    if (hint.agent !== "other") auth.actor = { ...auth.actor, agent: hint.agent, agentLabel: hint.label };
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  }

  const messages = Array.isArray(body) ? body : [body];
  const results: object[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object" || (m as { jsonrpc?: string }).jsonrpc !== "2.0") {
      results.push({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } });
      continue;
    }
    if (!("method" in m)) continue; // a response from the client — nothing to do in a stateless server
    const r = await handleRpc(m as never, auth);
    if (r) results.push(r);
  }

  if (results.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(body) ? results : results[0], {
    headers: { ...CORS, "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  // No server-initiated stream in this stateless server. Unauthenticated GETs get the OAuth hint.
  const auth = await verifyBearer(req.headers.get("authorization"));
  if (!auth) return unauthorized(req);
  return new Response("Tilda MCP uses JSON responses; open no SSE stream.", { status: 405, headers: { ...CORS, Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
