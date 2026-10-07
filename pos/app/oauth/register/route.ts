import { registerClient } from "@/lib/server/auth";
import { CORS } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** RFC 7591 Dynamic Client Registration. Stateless: the client_id is a signed blob of its metadata. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { client_name?: string; redirect_uris?: unknown } | null;
  const uris = Array.isArray(body?.redirect_uris) ? body!.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  const valid = uris.length > 0 && uris.length <= 10 && uris.every((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" || /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && url.protocol !== "javascript:" && url.protocol !== "data:" && url.protocol !== "http:";
    } catch {
      return false;
    }
  });
  if (!valid) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "redirect_uris must be https, localhost or a native app scheme" }, { status: 400, headers: CORS });
  }
  const client = await registerClient(String(body?.client_name ?? "MCP client").slice(0, 80), uris);
  return Response.json(
    {
      ...client,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: CORS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
