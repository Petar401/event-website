"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { tool } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Badge, Button, Sheet, Spinner, cx } from "./ui";

interface ToolStep {
  id: string;
  title: string;
  status: "running" | "ok" | "error" | "approval";
  error?: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: ToolStep[];
  error?: string;
}

const SUGGESTIONS = [
  "How are we doing today?",
  "What's running low?",
  "Ring up 2 oat flat whites and a croissant for table 3",
  "Who are our best customers this month?",
  "Draft a reorder for Hart Bakery",
  "Close-of-day briefing",
];

interface Insights {
  today: { orders: number; net_sales: string; average_ticket: string };
  last_7_days: { orders: number; net_sales: string; daily_average: string };
  anomalies: { severity: string; title: string; detail: string }[];
  stock_alerts: { item: string; stock: number; par: number; days_of_cover: number | null; suggested_reorder: number; supplier?: string }[];
  pending_approvals: { id: string; summary: string; requested_by: string }[];
}

export function Copilot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = usePos();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || enabled !== null) return;
    fetch("/api/copilot")
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, [open, enabled]);

  useEffect(() => {
    if (open && enabled === false && !insights) tool<Insights>("business_insights").then(setInsights).catch(() => {});
  }, [open, enabled, insights]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    const history: Turn[] = [...turns, { role: "user", content: question }];
    setTurns([...history, { role: "assistant", content: "", steps: [] }]);
    setBusy(true);
    const update = (fn: (t: Turn) => Turn) => setTurns((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Copilot unavailable");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "text") update((t) => ({ ...t, content: t.content ? `${t.content}\n\n${e.text}` : e.text }));
          if (e.type === "tool")
            update((t) => {
              const steps = [...(t.steps ?? [])];
              const i = steps.findIndex((s) => s.id === e.id);
              const step = { id: e.id, title: e.title, status: e.status, error: e.error };
              if (i >= 0) steps[i] = step;
              else steps.push(step);
              return { ...t, steps };
            });
          if (e.type === "error") update((t) => ({ ...t, error: e.error }));
        }
      }
    } catch (err) {
      update((t) => ({ ...t, error: err instanceof Error ? err.message : "Something went wrong" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-ai text-white">✦</span> Ask Tilda
          {enabled ? <Badge tone="ai">Claude</Badge> : null}
        </span>
      }
      footer={
        enabled ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask anything, ${session.name}…`}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-4 text-base focus:border-ai focus:outline-none"
              autoFocus
              enterKeyHint="send"
            />
            <Button type="submit" variant="ai" size="lg" disabled={busy || !input.trim()} aria-label="Send">
              {busy ? <Spinner /> : "↑"}
            </Button>
          </form>
        ) : null
      }
    >
      {enabled === null ? (
        <div className="grid place-items-center py-16">
          <Spinner className="size-6 text-ai" />
        </div>
      ) : enabled ? (
        <div className="space-y-4">
          {turns.length === 0 ? (
            <div className="py-4">
              <p className="text-sm text-muted">
                I run on the same tools your AI connectors use — sales, stock, orders, customers. Big refunds, discounts and price changes still go to a manager for approval.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-ai/30 bg-ai-soft px-3 py-2 text-left text-sm font-medium text-ai transition hover:brightness-95 active:scale-[0.98]">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-ink">{t.content}</div>
              </div>
            ) : (
              <div key={i} className="max-w-[95%] animate-fade">
                {t.steps?.length ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {t.steps.map((s) => (
                      <span key={s.id} title={s.error} className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.status === "error" ? "bg-bad-soft text-bad" : s.status === "approval" ? "bg-warn-soft text-warn" : "bg-ai-soft text-ai")}>
                        {s.status === "running" ? <Spinner className="size-3" /> : s.status === "ok" ? "✓" : s.status === "approval" ? "⏳" : "!"}
                        {s.title}
                        {s.status === "approval" ? " · needs approval" : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
                {t.content ? <Markdownish text={t.content} /> : busy && i === turns.length - 1 ? <TypingDots /> : null}
                {t.error ? <div className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{t.error}</div> : null}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      ) : (
        <OfflineBriefing insights={insights} onClose={onClose} />
      )}
    </Sheet>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-2" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2 animate-bounce rounded-full bg-ai" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

/** Tiny, safe renderer for the model's markdown: paragraphs, bullets, **bold**. No HTML injection. */
function Markdownish({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part.replace(/`/g, "")}</span>));
  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-ink">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
          return (
            <ul key={i} className="space-y-1 pl-1">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-ai">•</span>
                  <span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        if (/^#{1,4}\s/.test(b)) return <div key={i} className="font-bold">{inline(b.replace(/^#{1,4}\s/, ""))}</div>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 ? <br /> : null}</span>)}</p>;
      })}
    </div>
  );
}

function OfflineBriefing({ insights, onClose }: { insights: Insights | null; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ai/30 bg-ai-soft p-4">
        <div className="font-semibold text-ai">Bring your own AI</div>
        <p className="mt-1 text-sm text-ink-2">
          Connect Claude, ChatGPT, Perplexity or Cursor to Tilda over MCP and run the shop by chat. To enable this built-in chat, add an <code className="rounded bg-surface px-1">ANTHROPIC_API_KEY</code>.
        </p>
        <Link href="/ai" onClick={onClose} className="mt-3 inline-flex h-10 items-center rounded-xl bg-ai px-4 text-sm font-semibold text-white">
          Open AI Hub →
        </Link>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Instant briefing</div>
      {!insights ? (
        <div className="grid place-items-center py-8">
          <Spinner className="text-ai" />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">Today</div>
              <div className="text-xl font-bold tabular">{insights.today.net_sales}</div>
              <div className="text-xs text-muted">{insights.today.orders} orders · avg {insights.today.average_ticket}</div>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">7-day daily average</div>
              <div className="text-xl font-bold tabular">{insights.last_7_days.daily_average}</div>
              <div className="text-xs text-muted">{insights.last_7_days.orders} orders this week</div>
            </div>
          </div>
          {insights.pending_approvals.map((a) => (
            <div key={a.id} className="rounded-xl bg-warn-soft px-3 py-2 text-warn">
              ⏳ {a.summary} — from {a.requested_by}
            </div>
          ))}
          {insights.anomalies.map((a) => (
            <div key={a.title} className="rounded-xl bg-surface-2 px-3 py-2">
              <b>{a.title}</b> — {a.detail}
            </div>
          ))}
          {insights.stock_alerts.slice(0, 5).map((s) => (
            <div key={s.item} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
              <span>
                {s.item} · {s.stock} left{s.days_of_cover !== null ? ` (~${s.days_of_cover}d)` : ""}
              </span>
              {s.suggested_reorder ? <Badge tone="warn">order {s.suggested_reorder}</Badge> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
