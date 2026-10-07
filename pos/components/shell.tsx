"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PosProvider, usePos, type Session } from "@/lib/client/pos-context";
import { haptic } from "@/lib/client/api";
import { Copilot } from "./copilot";
import { Badge, Sheet, Spinner, cx } from "./ui";

interface StaffLite {
  id: string;
  name: string;
  role: string;
  color: string;
}

const NAV = [
  { href: "/", label: "Register", icon: "▦", primary: true },
  { href: "/tables", label: "Tables", icon: "◫", primary: true },
  { href: "/kitchen", label: "Kitchen", icon: "♨", primary: true },
  { href: "/orders", label: "Orders", icon: "≣" },
  { href: "/inventory", label: "Inventory", icon: "▤" },
  { href: "/customers", label: "Customers", icon: "☺" },
  { href: "/reports", label: "Insights", icon: "↗" },
  { href: "/shifts", label: "Cash drawer", icon: "▭" },
  { href: "/ai", label: "AI Hub", icon: "✦", primary: true, ai: true },
];

export function PosApp({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; session: Session | null; staff: StaffLite[]; mode: string; setupError?: string }>({ loading: true, session: null, staff: [], mode: "demo" });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/pin", { cache: "no-store" });
      const d = await r.json();
      setState({ loading: false, session: d.session, staff: d.staff, mode: d.mode, setupError: d.setupError });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }
  if (state.setupError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-md rounded-3xl border border-line bg-surface p-6 text-center shadow-card">
          <div className="text-4xl">🛠️</div>
          <h1 className="mt-2 text-xl font-bold">Almost there</h1>
          <p className="mt-2 text-sm text-muted">{state.setupError}</p>
        </div>
      </div>
    );
  }
  if (!state.session) return <PinLogin staff={state.staff} mode={state.mode} onDone={load} />;
  return (
    <PosProvider session={state.session} onLogout={() => setState((s) => ({ ...s, session: null }))}>
      <Shell>{children}</Shell>
    </PosProvider>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-lg font-black text-accent-ink shadow-sm">t</span>
      <span className="text-lg font-bold tracking-tight">tilda</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, snapshot, logout } = usePos();
  const [more, setMore] = useState(false);
  const [copilot, setCopilot] = useState(false);
  const pending = snapshot?.pendingApprovals ?? 0;
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => setMore(false), [pathname]);

  return (
    <div className="min-h-dvh md:pl-60">
      {/* Sidebar (tablet/desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 pb-4 pt-5">
          <Logo />
          <div className="mt-1 truncate pl-11 text-xs text-muted">{snapshot?.settings.businessName ?? "…"}</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                active(n.href) ? (n.ai ? "bg-ai-soft text-ai" : "bg-accent-soft text-accent") : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <span className="w-5 text-center text-base" aria-hidden>
                {n.icon}
              </span>
              {n.label}
              {n.ai && pending > 0 ? <span className="ml-auto grid size-5 place-items-center rounded-full bg-warn text-[11px] font-bold text-white">{pending}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-line p-3">
          <button onClick={() => setCopilot(true)} className="flex h-11 w-full items-center gap-3 rounded-xl bg-ai px-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            <span aria-hidden>✦</span> Ask Tilda
            <kbd className="ml-auto rounded bg-white/20 px-1.5 text-[10px]">AI</kbd>
          </button>
          <StaffChip session={session} onLogout={logout} mode={snapshot?.mode} />
        </div>
      </aside>

      {/* Top bar (phone) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/85 px-4 py-2.5 pt-safe backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          {snapshot?.mode === "demo" ? <Badge tone="warn">Demo</Badge> : null}
          <button onClick={logout} className="grid size-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: snapshot?.staff.find((s) => s.id === session.staffId)?.color ?? "var(--accent)" }} aria-label={`Signed in as ${session.name}. Tap to switch staff.`}>
            {session.name[0]}
          </button>
        </div>
      </header>

      <main className="pb-24 md:pb-0">{children}</main>

      {/* Floating copilot (phone) */}
      <button
        onClick={() => {
          haptic();
          setCopilot(true);
        }}
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-full bg-ai text-2xl text-white shadow-card animate-pulse-ring md:hidden"
        aria-label="Ask Tilda"
      >
        ✦
      </button>

      {/* Bottom tabs (phone) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/92 pb-safe backdrop-blur md:hidden">
        {NAV.filter((n) => n.primary).map((n) => (
          <Link key={n.href} href={n.href} onClick={() => haptic()} className={cx("relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active(n.href) ? (n.ai ? "text-ai" : "text-accent") : "text-muted")}>
            <span className="text-xl leading-none" aria-hidden>
              {n.icon}
            </span>
            {n.label === "AI Hub" ? "AI" : n.label}
            {n.ai && pending > 0 ? <span className="absolute right-[calc(50%-20px)] top-2 grid size-4 place-items-center rounded-full bg-warn text-[10px] font-bold text-white">{pending}</span> : null}
          </Link>
        ))}
        <button onClick={() => setMore(true)} className={cx("flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", NAV.some((n) => !n.primary && active(n.href)) ? "text-accent" : "text-muted")}>
          <span className="text-xl leading-none" aria-hidden>
            ⋯
          </span>
          More
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="grid grid-cols-2 gap-2">
          {NAV.filter((n) => !n.primary).map((n) => (
            <Link key={n.href} href={n.href} className={cx("flex h-20 flex-col justify-center gap-1 rounded-2xl border border-line px-4 font-semibold", active(n.href) ? "bg-accent-soft text-accent" : "bg-surface-2")}>
              <span className="text-xl" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </Link>
          ))}
        </div>
        <div className="mt-4">
          <StaffChip session={session} onLogout={logout} mode={snapshot?.mode} />
        </div>
      </Sheet>

      <Copilot open={copilot} onClose={() => setCopilot(false)} />
    </div>
  );
}

function StaffChip({ session, onLogout, mode }: { session: Session; onLogout: () => void; mode?: string }) {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    try {
      setTheme(localStorage.getItem("tilda-theme"));
    } catch {
      /* ignore */
    }
  }, []);
  const cycle = () => {
    const next = theme === "dark" ? "light" : theme === "light" ? null : "dark";
    setTheme(next);
    try {
      if (next) localStorage.setItem("tilda-theme", next);
      else localStorage.removeItem("tilda-theme");
    } catch {
      /* ignore */
    }
    if (next) document.documentElement.dataset.theme = next;
    else delete document.documentElement.dataset.theme;
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2">
      <div className="min-w-0 flex-1 pl-1">
        <div className="truncate text-sm font-semibold">{session.name}</div>
        <div className="text-xs capitalize text-muted">
          {session.role}
          {mode === "demo" ? " · demo data" : ""}
        </div>
      </div>
      <button onClick={cycle} className="grid size-8 place-items-center rounded-lg text-sm hover:bg-surface-3" title="Theme: auto / dark / light" aria-label="Toggle theme">
        {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
      </button>
      <button onClick={onLogout} className="h-8 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-surface-3" title="Switch staff">
        Switch
      </button>
    </div>
  );
}

export function PinLogin({ staff, mode, onDone, compact }: { staff: StaffLite[]; mode: string; onDone: () => void; compact?: boolean }) {
  const [who, setWho] = useState<StaffLite | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (p: string) => {
      if (!who) return;
      setBusy(true);
      setError(null);
      const r = await fetch("/api/auth/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: who.id, pin: p }) });
      setBusy(false);
      if (r.ok) onDone();
      else {
        haptic(40);
        setError((await r.json()).error ?? "Wrong PIN");
        setPin("");
      }
    },
    [who, onDone],
  );

  const press = (d: string) => {
    haptic();
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  };

  useEffect(() => {
    if (!who) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      if (e.key === "Escape") setWho(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hints: Record<string, string> = { owner: "1234", manager: "2580" };

  return (
    <div className={cx("flex flex-col items-center justify-center px-6", compact ? "py-6" : "min-h-dvh py-10")}>
      {!compact ? <Logo className="mb-8 scale-125" /> : null}
      {!who ? (
        <div className="w-full max-w-md animate-fade">
          <h1 className="text-center text-2xl font-bold">Who&apos;s working?</h1>
          <p className="mt-1 text-center text-sm text-muted">Tap your name, then enter your 4-digit PIN.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {staff.map((s) => (
              <button key={s.id} onClick={() => setWho(s)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition active:scale-[0.98]">
                <span className="grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ background: s.color }}>
                  {s.name[0]}
                </span>
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block text-xs capitalize text-muted">{s.role}</span>
                </span>
              </button>
            ))}
          </div>
          {mode === "demo" ? (
            <p className="mt-6 rounded-2xl bg-warn-soft p-3 text-center text-xs text-warn">
              Demo PINs — Petar (owner) 1234 · Alex (manager) 2580 · Sam 0000 · Lena 1111
            </p>
          ) : null}
        </div>
      ) : (
        <div className="w-full max-w-xs animate-fade text-center">
          <button onClick={() => (setWho(null), setPin(""), setError(null))} className="text-sm text-muted">
            ← Not {who.name}?
          </button>
          <div className="mx-auto mt-4 grid size-16 place-items-center rounded-full text-2xl font-bold text-white" style={{ background: who.color }}>
            {who.name[0]}
          </div>
          <div className="mt-2 text-lg font-semibold">Hi {who.name}</div>
          <div className={cx("mt-5 flex justify-center gap-3", error && "animate-[pop_0.3s]")}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cx("size-4 rounded-full border-2 transition", i < pin.length ? "border-accent bg-accent" : "border-line")} />
            ))}
          </div>
          <div className="mt-2 h-5 text-sm text-bad">{error}</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
              d === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  onClick={() => (d === "⌫" ? setPin((p) => p.slice(0, -1)) : press(d))}
                  className="h-16 rounded-2xl bg-surface text-2xl font-semibold shadow-card transition active:scale-95 active:bg-surface-2"
                  aria-label={d === "⌫" ? "Delete" : d}
                >
                  {d}
                </button>
              ),
            )}
          </div>
          {mode === "demo" && hints[who.role] ? <p className="mt-4 text-xs text-muted">Demo PIN: {hints[who.role]}</p> : null}
        </div>
      )}
    </div>
  );
}
