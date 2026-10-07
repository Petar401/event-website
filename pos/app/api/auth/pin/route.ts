import { cookies } from "next/headers";
import { getRepo } from "@/lib/server/env";
import { SESSION_COOKIE, createSessionToken, getStaffSession } from "@/lib/server/auth";
import { verifyPin } from "@/lib/server/crypto";
import { json } from "@/lib/server/http";
import { buildSeed } from "@/lib/data/seed";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { n: number; until: number }>();

let seeded = false;

export async function GET() {
  const repo = getRepo();
  try {
    // First run on a fresh Supabase project: load the demo café so there's someone to log in as.
    if (!seeded && repo.mode === "supabase" && process.env.SEED_ON_EMPTY !== "false" && (await repo.isEmpty())) {
      await repo.importSeed(buildSeed());
    }
    seeded = true;
    const session = await getStaffSession();
    const staff = (await repo.listStaff()).filter((s) => s.active).map(({ id, name, role, color }) => ({ id, name, role, color }));
    return json({ session, staff, mode: repo.mode });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ session: null, staff: [], mode: repo.mode, setupError: /does not exist|schema cache/i.test(message) ? "Supabase is connected but the Tilda tables are missing. Run supabase/migrations/*.sql in the Supabase SQL editor, then reload." : message });
  }
}

export async function POST(req: Request) {
  const { staffId, pin } = (await req.json().catch(() => ({}))) as { staffId?: string; pin?: string };
  const key = staffId ?? "?";
  const a = attempts.get(key);
  if (a && a.until > Date.now()) return json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  const staff = (await getRepo().listStaff()).find((s) => s.id === staffId && s.active);
  if (!staff || !pin || !verifyPin(pin, staff.pinHash)) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(key, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    return json({ error: "Wrong PIN" }, { status: 401 });
  }
  attempts.delete(key);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(staff), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });
  return json({ session: { staffId: staff.id, name: staff.name, role: staff.role } });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
}
