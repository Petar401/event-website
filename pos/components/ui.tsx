"use client";

import { useEffect, useRef } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ai" | "ok";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-105 active:brightness-95 shadow-sm",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 border border-line",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-bad text-white hover:brightness-110",
  ai: "bg-ai text-white hover:brightness-110 shadow-sm",
  ok: "bg-ok text-white hover:brightness-110",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" | "xl"; loading?: boolean }) {
  const sizes = { sm: "h-9 px-3 text-sm rounded-xl", md: "h-11 px-4 text-sm rounded-xl", lg: "h-13 px-5 text-base rounded-2xl", xl: "h-16 px-6 text-lg rounded-2xl" };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx("rounded-2xl border border-line bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

type Tone = "neutral" | "accent" | "ai" | "ok" | "warn" | "bad";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  ai: "bg-ai-soft text-ai",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "ai" | "ok" | "bad" }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("mt-1 text-2xl font-bold tabular", tone === "ai" && "text-ai", tone === "ok" && "text-ok", tone === "bad" && "text-bad")}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </Card>
  );
}

export function Empty({ icon = "✨", title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="font-semibold">{title}</div>
      {children ? <div className="max-w-sm text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cx("inline-flex rounded-xl border border-line bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("h-8 rounded-lg px-3 text-sm font-semibold transition", value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 animate-fade bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-card outline-none sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-surface-3 sm:hidden" />
        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="text-lg font-bold">{title}</div>
            <button onClick={onClose} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Close">
              ✕
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line bg-surface px-5 py-3 pb-safe">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Input(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none",
        props.className,
      )}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function AgentBadge({ agent, label }: { agent?: string; label?: string }) {
  const icon: Record<string, string> = { claude: "✳️", chatgpt: "◎", perplexity: "✱", gemini: "✦", copilot: "◆", cursor: "▲" };
  return (
    <Badge tone="ai">
      <span aria-hidden>{icon[agent ?? ""] ?? "🤖"}</span>
      {label ?? "AI"}
    </Badge>
  );
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
}
