import { env, supabaseConfigured } from "./env";

export type ChangeKind = "orders" | "catalog" | "customers" | "approvals" | "audit" | "shift" | "purchase_orders" | "settings" | "keys";

const g = globalThis as unknown as { __tildaVersion?: number; __tildaLastEvent?: unknown };

/** Monotonic change counter for this server instance (demo-mode polling uses it). */
export function changeVersion(): number {
  return g.__tildaVersion ?? 0;
}

export function lastEvent(): unknown {
  return g.__tildaLastEvent ?? null;
}

/**
 * Tell connected screens something changed. With Supabase we push a tiny "ping" over Realtime
 * Broadcast (no POS data in the payload — clients refetch through the authenticated API).
 * Without Supabase, clients poll /api/live and see the version bump.
 */
export async function broadcast(kinds: ChangeKind[], meta: Record<string, unknown> = {}): Promise<void> {
  g.__tildaVersion = (g.__tildaVersion ?? 0) + 1;
  const event = { kinds, at: new Date().toISOString(), version: g.__tildaVersion, ...meta };
  g.__tildaLastEvent = event;
  if (!supabaseConfigured()) return;
  try {
    await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceKey,
        Authorization: `Bearer ${env.supabaseServiceKey}`,
      },
      body: JSON.stringify({ messages: [{ topic: "tilda-pos", event: "change", payload: { kinds, version: event.version, at: event.at } }] }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Realtime is best-effort; clients also poll.
  }
}
