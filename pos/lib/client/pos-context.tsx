"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Role, Snapshot } from "../domain/types";
import { formatMoney } from "../domain/money";
import { tool } from "./api";

export interface Session {
  staffId: string;
  name: string;
  role: Role;
}

export interface LiveEvent {
  kinds: string[];
  version: number;
  at: string;
  tool?: string;
  summary?: string;
  by?: string;
  agent?: string;
  approval?: string;
  connected?: string;
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "default" | "ai" | "ok" | "bad" | "warn";
  href?: string;
}

interface PosCtx {
  session: Session;
  snapshot: Snapshot | null;
  refreshSnapshot: () => Promise<void>;
  /** Increments whenever anything changes server-side; use as an effect dependency to refetch. */
  version: number;
  lastEvent: LiveEvent | null;
  toast: (t: Omit<Toast, "id">) => void;
  money: (cents: number) => string;
  logout: () => Promise<void>;
}

const Ctx = createContext<PosCtx | null>(null);

export function usePos(): PosCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePos must be used inside <PosProvider>");
  return c;
}

/** Refetch helper: runs `load` on mount and whenever the live version changes. */
export function useLiveData<T>(load: () => Promise<T>, deps: unknown[] = []): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const { version } = usePos();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let alive = true;
    loadRef
      .current()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, nonce, ...deps]);
  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

export function PosProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [version, setVersion] = useState(0);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<number>(-1);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.tone === "ai" ? 7000 : 4000);
  }, []);

  const refreshSnapshot = useCallback(async () => {
    try {
      setSnapshot(await tool<Snapshot>("pos_snapshot"));
    } catch {
      /* keep the last good snapshot */
    }
  }, []);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot, version]);

  // Live feed: poll /api/live; when Supabase Realtime is configured also subscribe for instant pings.
  useEffect(() => {
    let stop = false;
    let interval = 2500;
    let cleanupRealtime: (() => void) | null = null;

    const check = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const live = (await res.json()) as { version: number; event: LiveEvent | null; realtime: { url: string; anonKey: string; channel: string } | null };
        if (live.realtime && !cleanupRealtime) {
          interval = 15000;
          cleanupRealtime = await subscribeRealtime(live.realtime, () => bump());
        }
        if (seen.current === -1) seen.current = live.version;
        else if (live.version !== seen.current) {
          seen.current = live.version;
          handleEvent(live.event);
          setVersion((v) => v + 1);
        }
      } catch {
        /* offline — try again */
      }
    };

    const bump = () => {
      // Realtime ping (no payload data). Pull the details through the authenticated feed.
      fetch("/api/live", { cache: "no-store" })
        .then((r) => r.json())
        .then((live) => {
          seen.current = live.version;
          handleEvent(live.event);
        })
        .catch(() => {})
        .finally(() => setVersion((v) => v + 1));
    };

    const handleEvent = (e: LiveEvent | null) => {
      if (!e) return;
      setLastEvent(e);
      if (e.agent && e.summary) toast({ title: e.by ?? "AI agent", body: e.summary, tone: "ai", href: "/ai" });
      else if (e.approval) toast({ title: "Approval needed", body: `${e.approval} — requested by ${e.by}`, tone: "warn", href: "/ai" });
      else if (e.connected) toast({ title: `${e.connected} connected`, body: "A new AI connection was authorised.", tone: "ai", href: "/ai" });
    };

    const loop = async () => {
      while (!stop) {
        if (document.visibilityState === "visible") await check();
        await new Promise((r) => setTimeout(r, interval));
      }
    };
    loop();
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      cleanupRealtime?.();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [toast]);

  useEffect(() => {
    const out = () => onLogout();
    window.addEventListener("tilda:logout", out);
    return () => window.removeEventListener("tilda:logout", out);
  }, [onLogout]);

  const value = useMemo<PosCtx>(
    () => ({
      session,
      snapshot,
      refreshSnapshot,
      version,
      lastEvent,
      toast,
      money: (c: number) => formatMoney(c, snapshot?.settings.currency ?? "EUR", snapshot?.settings.locale ?? "en-IE"),
      logout: async () => {
        await fetch("/api/auth/pin", { method: "DELETE" });
        onLogout();
      },
    }),
    [session, snapshot, refreshSnapshot, version, lastEvent, toast, onLogout],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((all) => all.filter((t) => t.id !== id))} />
    </Ctx.Provider>
  );
}

async function subscribeRealtime(cfg: { url: string; anonKey: string; channel: string }, onPing: () => void): Promise<() => void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } });
    const ch = sb.channel(cfg.channel).on("broadcast", { event: "change" }, () => onPing()).subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  } catch {
    return () => {};
  }
}

const toneClass: Record<Toast["tone"], string> = {
  default: "border-line",
  ai: "border-ai/50 bg-ai-soft",
  ok: "border-ok/40 bg-ok-soft",
  bad: "border-bad/40 bg-bad-soft",
  warn: "border-warn/40 bg-warn-soft",
};

function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 pt-safe sm:items-end sm:p-4" aria-live="polite">
      {toasts.map((t) => (
        <a
          key={t.id}
          href={t.href}
          onClick={(e) => {
            if (!t.href) e.preventDefault();
            onDismiss(t.id);
          }}
          className={`pointer-events-auto w-full max-w-sm animate-slide-up rounded-2xl border bg-surface p-3 pr-4 shadow-card ${toneClass[t.tone]}`}
        >
          <div className="flex items-start gap-3">
            {t.tone === "ai" ? (
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ai text-xs font-bold text-white animate-pulse-ring">AI</span>
            ) : null}
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.body ? <div className="mt-0.5 text-sm text-ink-2">{t.body}</div> : null}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
