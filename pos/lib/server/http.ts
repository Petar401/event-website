import { NextResponse } from "next/server";
import { getRepo } from "./env";
import { getStaffSession, scopesForRole, staffActor } from "./auth";
import { executeTool } from "../tools/registry";
import { TOOLS } from "../tools/pos-tools";

export function originOf(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host.split(",")[0].trim()}`;
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export function json(data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init.headers ?? {}) } });
}

/** Run a tool as the logged-in staff member (register UI). */
export async function runAsStaff(name: string, input: unknown) {
  const session = await getStaffSession();
  if (!session) return json({ ok: false, code: "unauthenticated", error: "Log in with your PIN" }, { status: 401 });
  const result = await executeTool(TOOLS, name, input, { repo: getRepo(), actor: staffActor(session), scopes: scopesForRole(session.role) });
  const status = result.ok ? 200 : result.code === "forbidden" ? 403 : result.code === "unknown_tool" ? 404 : result.code === "internal_error" ? 500 : result.code === "approval_required" ? 202 : 400;
  return json(result, { status });
}
