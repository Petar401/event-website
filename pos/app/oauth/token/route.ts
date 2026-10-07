import { issueTokens, readAuthCode, verifyRefreshToken } from "@/lib/server/auth";
import { s256, sha256 } from "@/lib/server/crypto";
import { getRepo } from "@/lib/server/env";
import { CORS } from "@/lib/server/http";
import type { Scope } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const fail = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

async function params(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    return new URLSearchParams(body);
  }
  return new URLSearchParams(await req.text());
}

export async function POST(req: Request) {
  const p = await params(req);
  const repo = getRepo();
  const grant = p.get("grant_type");

  if (grant === "authorization_code") {
    const code = await readAuthCode(p.get("code") ?? "");
    if (!code) return fail("invalid_grant", "Code is invalid or expired");
    if (code.clientId !== p.get("client_id")) return fail("invalid_grant", "client_id mismatch");
    if (code.redirectUri !== p.get("redirect_uri")) return fail("invalid_grant", "redirect_uri mismatch");
    const verifier = p.get("code_verifier") ?? "";
    if (!verifier || s256(verifier) !== code.challenge) return fail("invalid_grant", "PKCE verification failed");
    const usedKey = `oauth-code:${sha256(p.get("code")!)}`;
    if ((await repo.getIdempotent(usedKey)) !== undefined) return fail("invalid_grant", "Code already used");
    await repo.setIdempotent(usedKey, true);
    const tokens = await issueTokens({ staffId: code.staffId, scopes: code.scopes, agent: code.agent, label: code.label, kid: code.kid, clientId: code.clientId });
    return Response.json(tokens, { headers: { ...CORS, "Cache-Control": "no-store" } });
  }

  if (grant === "refresh_token") {
    const rt = await verifyRefreshToken(p.get("refresh_token") ?? "");
    if (!rt?.sub) return fail("invalid_grant", "Refresh token is invalid or expired");
    const record = await repo.getApiKey(rt.kid);
    if (record?.revoked || (!record && repo.mode === "supabase")) return fail("invalid_grant", "This connection was revoked in Tilda");
    const tokens = await issueTokens({ staffId: rt.sub, scopes: rt.scope.split(" ") as Scope[], agent: rt.agent, label: rt.label, kid: rt.kid, clientId: rt.client_id ?? "" });
    return Response.json(tokens, { headers: { ...CORS, "Cache-Control": "no-store" } });
  }

  return fail("unsupported_grant_type", "Use authorization_code or refresh_token");
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
