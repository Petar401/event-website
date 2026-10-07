import type { Repo } from "../data/repo";
import { DemoRepo } from "../data/demo-repo";
import { SupabaseRepo } from "../data/supabase-repo";

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  copilotModel: process.env.COPILOT_MODEL || "claude-opus-5-5",
  appSecret: process.env.APP_SECRET || "",
};

export const supabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);

const g = globalThis as unknown as { __tildaRepo?: Repo };

/** One repository per server instance. Demo mode keeps state in memory across requests on that instance. */
export function getRepo(): Repo {
  if (!g.__tildaRepo) {
    g.__tildaRepo = supabaseConfigured() ? new SupabaseRepo(env.supabaseUrl, env.supabaseServiceKey) : new DemoRepo();
  }
  return g.__tildaRepo;
}

/** Signing secret. Falls back to a fixed dev secret in demo mode so the app works out of the box. */
export function secretKey(): Uint8Array {
  const s = env.appSecret || (supabaseConfigured() ? "" : "tilda-demo-secret-change-me-please-0001");
  if (!s) throw new Error("APP_SECRET must be set when Supabase is configured");
  return new TextEncoder().encode(s);
}
