"use client";

import type { ToolResult } from "../tools/registry";

export type { ToolResult };

/** Call a POS tool as the logged-in staff member. Never throws; inspect `ok`. */
export async function callTool<T = unknown>(name: string, input: Record<string, unknown> = {}): Promise<ToolResult & { data?: T }> {
  try {
    const res = await fetch(`/api/tools/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("tilda:logout"));
    }
    return (await res.json()) as ToolResult & { data?: T };
  } catch (e) {
    return { ok: false, code: "network", error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Like callTool but throws on failure — handy inside effects that already catch. */
export async function tool<T>(name: string, input: Record<string, unknown> = {}): Promise<T> {
  const r = await callTool<T>(name, input);
  if (!r.ok) throw Object.assign(new Error(r.error), { code: r.code, result: r });
  return r.data as T;
}

export function newKey(): string {
  return crypto.randomUUID();
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
