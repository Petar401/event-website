import { changeVersion, lastEvent } from "@/lib/server/realtime";
import { env, supabaseConfigured } from "@/lib/server/env";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Cheap change feed: clients poll this (demo mode) or subscribe to Supabase Realtime pings. */
export async function GET() {
  return json({
    version: changeVersion(),
    event: lastEvent(),
    realtime: supabaseConfigured() && env.supabaseAnonKey ? { url: env.supabaseUrl, anonKey: env.supabaseAnonKey, channel: "tilda-pos" } : null,
  });
}
