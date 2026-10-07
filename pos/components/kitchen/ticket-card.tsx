"use client";

import type { KitchenTicket, Order, OrderLine, TicketStatus } from "@/lib/domain/types";
import { AgentBadge, Button, cx } from "@/components/ui";
import { agentOf } from "@/components/orders/format";

export interface KdsTicket {
  key: string;
  order: Order;
  ticket: KitchenTicket;
  /** Status after applying optimistic updates. */
  status: TicketStatus;
}

export const NEXT_LABEL: Record<Exclude<TicketStatus, "served">, string> = {
  new: "Start preparing",
  preparing: "Mark ready",
  ready: "Served",
};

const NEW_WINDOW_MS = 30_000;

type Urgency = "calm" | "warn" | "bad";

function urgencyFor(minutes: number, status: TicketStatus): Urgency {
  if (status === "ready") return "calm";
  if (minutes > 10) return "bad";
  if (minutes > 5) return "warn";
  return "calm";
}

const frame: Record<Urgency, string> = {
  calm: "border-line",
  warn: "border-warn",
  bad: "border-bad",
};
const timerText: Record<Urgency, string> = {
  calm: "text-ink",
  warn: "text-warn",
  bad: "text-bad",
};
const barColor: Record<Urgency, string> = {
  calm: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
};

export function TicketCard({
  entry,
  now,
  tableName,
  pending,
  onBump,
}: {
  entry: KdsTicket;
  now: number;
  tableName: string | null;
  pending: boolean;
  onBump: (e: KdsTicket) => void;
}) {
  const { order, ticket, status } = entry;
  const elapsedMs = Math.max(0, now - Date.parse(ticket.sentAt));
  const minutes = Math.floor(elapsedMs / 60000);
  const urgency = urgencyFor(minutes, status);
  const isFresh = status === "new" && elapsedMs < NEW_WINDOW_MS;
  const agent = agentOf(order.channel);
  const lines = ticket.lineIds.map((id) => order.lines.find((l) => l.id === id)).filter((l): l is OrderLine => Boolean(l));
  const progress = status === "ready" ? 100 : Math.min(100, (elapsedMs / 600_000) * 100);
  const next = status === "served" ? null : NEXT_LABEL[status];

  return (
    <div className="relative">
      {isFresh ? <span aria-hidden className="pointer-events-none absolute -inset-1.5 animate-pulse rounded-[1.65rem] ring-4 ring-accent/60" /> : null}
      <article className={cx("relative overflow-hidden rounded-3xl border-2 bg-surface shadow-card animate-pop", frame[urgency])}>
        <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-black tracking-tight tabular">#{order.number}</span>
              <span className="truncate text-lg font-bold text-ink-2">{tableName ?? "Takeaway"}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-2">{ticket.station}</span>
              {isFresh ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent-ink">New</span> : null}
              {agent ? <AgentBadge agent={agent.kind} label={`via ${agent.name}`} /> : null}
            </div>
          </div>
          <div className={cx("shrink-0 text-right", timerText[urgency])}>
            <div className="text-3xl font-black leading-none tabular">{minutes < 1 ? "<1" : minutes}</div>
            <div className="mt-0.5 text-xs font-bold uppercase tracking-wide opacity-80">min</div>
          </div>
        </header>

        <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Time since ordered" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(10, minutes)}>
          <div className={cx("h-full rounded-full transition-[width] duration-700", barColor[urgency])} style={{ width: `${progress}%` }} />
        </div>

        <ul className="space-y-2.5 px-4 py-3.5">
          {lines.map((l) => (
            <li key={l.id}>
              <div className="flex items-baseline gap-2 text-xl font-bold leading-snug">
                <span className="tabular text-accent">{l.qty}×</span>
                <span className="min-w-0 break-words">{l.name}</span>
              </div>
              {l.modifiers.length > 0 ? <div className="pl-8 text-sm font-medium text-ink-2">{l.modifiers.map((m) => m.name).join(" · ")}</div> : null}
              {l.note ? <div className="ml-8 mt-1 rounded-lg bg-warn-soft px-2 py-1 text-sm font-bold text-warn">{l.note}</div> : null}
            </li>
          ))}
          {lines.length === 0 ? <li className="text-sm text-muted">Items no longer on the order</li> : null}
        </ul>

        {order.note ? (
          <div className="mx-4 mb-3 rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
            <span className="mr-1 text-xs font-bold uppercase tracking-wide opacity-80">Order note</span>
            {order.note}
          </div>
        ) : null}

        {agent ? <div className="px-4 pb-3 text-xs text-muted">Placed by {order.createdBy}</div> : null}

        {next ? (
          <div className="px-3 pb-3">
            <Button variant={status === "new" ? "primary" : status === "preparing" ? "ok" : "secondary"} size="xl" className="h-16 w-full text-xl" loading={pending} onClick={() => onBump(entry)}>
              {next}
            </Button>
          </div>
        ) : null}
      </article>
    </div>
  );
}
