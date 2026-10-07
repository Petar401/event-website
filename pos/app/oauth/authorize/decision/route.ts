import { NextResponse } from "next/server";
import { createAuthCode, detectAgent, getStaffSession, readClient, scopesForRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/env";
import { uid } from "@/lib/domain/order";
import { broadcast } from "@/lib/server/realtime";
import type { Scope } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** Consent form target. Issues an authorization code bound to the logged-in staff member. */
export async function POST(req: Request) {
  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "");
  const client = await readClient(get("client_id"));
  const redirectUri = get("redirect_uri");
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return new NextResponse("Invalid client or redirect_uri", { status: 400 });
  }
  const back = new URL(redirectUri);
  const state = get("state");
  if (state) back.searchParams.set("state", state);

  if (get("decision") !== "allow") {
    back.searchParams.set("error", "access_denied");
    return NextResponse.redirect(back, 303);
  }
  const session = await getStaffSession();
  if (!session) return new NextResponse("Log in first", { status: 401 });

  const allowed = scopesForRole(session.role);
  const wantReadOnly = get("access") === "read";
  const scopes: Scope[] = wantReadOnly ? ["pos:read"] : allowed;
  const { agent, label } = detectAgent(client.client_name, client.client_id);
  const kid = uid("grant_");
  await getRepo().saveApiKey({
    id: kid,
    kind: "oauth",
    name: client.client_name,
    prefix: "OAuth",
    staffId: session.staffId,
    scopes,
    agent,
    createdAt: new Date().toISOString(),
    revoked: false,
  });
  await broadcast(["keys"], { connected: label });

  const code = await createAuthCode({ clientId: client.client_id, redirectUri, challenge: get("code_challenge"), staffId: session.staffId, scopes, kid, agent, label });
  back.searchParams.set("code", code);
  return NextResponse.redirect(back, 303);
}
