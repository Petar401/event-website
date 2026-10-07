import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { Actor, AgentKind, Role, Scope, Staff } from "../domain/types";
import { getRepo, secretKey } from "./env";
import { uid } from "../domain/order";

export const SESSION_COOKIE = "tilda_session";
const ISSUER = "tilda-pos";

export interface StaffSession {
  staffId: string;
  name: string;
  role: Role;
}

async function sign(payload: JWTPayload, typ: string, ttl?: string): Promise<string> {
  let jwt = new SignJWT({ ...payload, typ }).setProtectedHeader({ alg: "HS256" }).setIssuer(ISSUER).setIssuedAt();
  if (ttl) jwt = jwt.setExpirationTime(ttl);
  return jwt.sign(secretKey());
}

async function verify<T extends JWTPayload>(token: string, typ: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER });
    return payload.typ === typ ? (payload as T) : null;
  } catch {
    return null;
  }
}

// ---------- Staff sessions (PIN login on the register) ----------

export async function createSessionToken(s: Staff): Promise<string> {
  return sign({ sub: s.id, name: s.name, role: s.role }, "session", "12h");
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const p = await verify<JWTPayload & { name: string; role: Role }>(token, "session");
  return p?.sub ? { staffId: p.sub, name: p.name, role: p.role } : null;
}

export function staffActor(s: StaffSession): Actor {
  return { type: "staff", staffId: s.staffId, name: s.name, role: s.role };
}

// ---------- Agents (MCP clients) ----------

const AGENTS: [RegExp, AgentKind, string][] = [
  [/claude|anthropic/i, "claude", "Claude"],
  [/chatgpt|openai/i, "chatgpt", "ChatGPT"],
  [/perplexity/i, "perplexity", "Perplexity"],
  [/gemini|google/i, "gemini", "Gemini"],
  [/copilot|microsoft/i, "copilot", "Copilot"],
  [/cursor/i, "cursor", "Cursor"],
];

export function detectAgent(...hints: (string | null | undefined)[]): { agent: AgentKind; label: string } {
  const text = hints.filter(Boolean).join(" ");
  for (const [re, agent, label] of AGENTS) if (re.test(text)) return { agent, label };
  return { agent: "other", label: hints.find(Boolean)?.slice(0, 40) || "AI agent" };
}

export const ALL_SCOPES: Scope[] = ["pos:read", "pos:write", "pos:manage"];

export function scopesForRole(role: Role): Scope[] {
  return role === "cashier" ? ["pos:read", "pos:write"] : ALL_SCOPES;
}

interface TokenClaims extends JWTPayload {
  kid: string;
  scope: string;
  agent: AgentKind;
  label: string;
  client_id?: string;
}

export async function issueTokens(input: { staffId: string; scopes: Scope[]; agent: AgentKind; label: string; kid: string; clientId: string }) {
  const claims = { sub: input.staffId, kid: input.kid, scope: input.scopes.join(" "), agent: input.agent, label: input.label, client_id: input.clientId };
  return {
    access_token: await sign(claims, "access", "1h"),
    refresh_token: await sign(claims, "refresh", "30d"),
    token_type: "Bearer",
    expires_in: 3600,
    scope: claims.scope,
  };
}

export async function verifyRefreshToken(token: string) {
  return verify<TokenClaims>(token, "refresh");
}

/** Create a long-lived API key for clients that don't speak OAuth (Claude Code, Cursor, scripts). */
export async function createApiKey(input: { name: string; staffId: string; scopes: Scope[]; agent: AgentKind }) {
  const id = uid("key_");
  const label = detectAgent(input.name).label;
  const token = "tilda_" + (await sign({ sub: input.staffId, kid: id, scope: input.scopes.join(" "), agent: input.agent, label }, "key"));
  await getRepo().saveApiKey({
    id,
    kind: "api_key",
    name: input.name,
    prefix: token.slice(0, 14) + "…" + token.slice(-4),
    staffId: input.staffId,
    scopes: input.scopes,
    agent: input.agent,
    createdAt: new Date().toISOString(),
    revoked: false,
  });
  return { id, token };
}

export interface BearerContext {
  actor: Actor;
  scopes: Scope[];
  kid: string;
}

export async function verifyBearer(header: string | null): Promise<BearerContext | null> {
  const raw = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!raw) return null;
  const claims = raw.startsWith("tilda_") ? await verify<TokenClaims>(raw.slice(6), "key") : await verify<TokenClaims>(raw, "access");
  if (!claims?.sub) return null;
  const repo = getRepo();
  const record = await repo.getApiKey(claims.kid);
  if (record?.revoked) return null;
  // Demo mode: a different server instance may not know the record yet; signature is still verified.
  if (!record && repo.mode === "supabase") return null;
  const staff = (await repo.listStaff()).find((s) => s.id === claims.sub && s.active);
  if (!staff) return null;
  if (record && (!record.lastUsedAt || Date.now() - Date.parse(record.lastUsedAt) > 60_000)) {
    await repo.saveApiKey({ ...record, lastUsedAt: new Date().toISOString() });
  }
  return {
    kid: claims.kid,
    scopes: claims.scope.split(" ").filter(Boolean) as Scope[],
    actor: { type: "agent", staffId: staff.id, name: staff.name, role: staff.role, agent: claims.agent, agentLabel: claims.label },
  };
}

// ---------- OAuth 2.1 helpers (stateless clients and codes, signed with APP_SECRET) ----------

export interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

export async function registerClient(name: string, redirectUris: string[]): Promise<OAuthClient> {
  const client_id = "tc_" + (await sign({ n: name.slice(0, 80), r: redirectUris }, "client"));
  return { client_id, client_name: name, redirect_uris: redirectUris };
}

export async function readClient(clientId: string): Promise<OAuthClient | null> {
  if (/^https:\/\//.test(clientId ?? "")) return fetchClientMetadata(clientId);
  if (!clientId?.startsWith("tc_")) return null;
  const p = await verify<JWTPayload & { n: string; r: string[] }>(clientId.slice(3), "client");
  return p ? { client_id: clientId, client_name: p.n, redirect_uris: p.r } : null;
}

export async function createAuthCode(input: { clientId: string; redirectUri: string; challenge: string; staffId: string; scopes: Scope[]; kid: string; agent: AgentKind; label: string }) {
  return sign({ ...input, jti: uid("cd_") }, "code", "5m");
}

export async function readAuthCode(code: string) {
  return verify<JWTPayload & { clientId: string; redirectUri: string; challenge: string; staffId: string; scopes: Scope[]; kid: string; agent: AgentKind; label: string }>(code, "code");
}

/** OAuth Client ID Metadata Documents: the client_id is an HTTPS URL serving the client's metadata. */
async function fetchClientMetadata(url: string): Promise<OAuthClient | null> {
  try {
    const host = new URL(url).hostname;
    if (!host.includes(".") || /^(localhost|[\d.]+|\[.*\])$/i.test(host)) return null;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000), redirect: "error" });
    if (!res.ok) return null;
    const doc = (await res.json()) as { client_id?: string; client_name?: string; redirect_uris?: string[] };
    if (doc.client_id !== url || !Array.isArray(doc.redirect_uris)) return null;
    return { client_id: url, client_name: (doc.client_name ?? new URL(url).hostname).slice(0, 80), redirect_uris: doc.redirect_uris };
  } catch {
    return null;
  }
}
