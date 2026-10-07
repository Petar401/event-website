"use client";

import { Badge, Button, Card, minutesSince, timeAgo, cx } from "@/components/ui";
import type { CashEvent, Shift } from "@/lib/domain/types";
import { usePos } from "@/lib/client/pos-context";
import type { OpenReport } from "./act";
import { clean } from "./act";
import type { MovementType } from "./movement-sheet";

function duration(iso: string): string {
  const m = minutesSince(iso);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function Figure({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={cx("rounded-2xl p-3", strong ? "bg-accent-soft" : "bg-surface-2")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("mt-0.5 text-xl font-bold tabular", strong && "text-accent")}>{value}</div>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/** Live numbers for the open shift plus the movement and close buttons. */
export function ShiftSummary({ report, canClose, onMove, onClose }: { report: OpenReport; canClose: boolean; onMove: (t: MovementType) => void; onClose: () => void }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 animate-pulse rounded-full bg-ok" aria-hidden />
            <h2 className="text-lg font-bold">Drawer open</h2>
          </div>
          <p className="text-sm text-muted">
            Opened by {report.opened_by} · {new Date(report.opened_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {duration(report.opened_at)} ago
          </p>
        </div>
        <Badge tone="neutral">{report.orders} orders</Badge>
      </div>

      <div className="mt-4">
        <Figure label="Expected cash in drawer" value={report.expected_cash} hint="Float + cash sales − refunds + paid in − paid out" strong />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Figure label="Opening float" value={report.opening_float} />
        <Figure label="Cash sales" value={report.cash_sales} hint={`Refunds ${report.cash_refunds}`} />
        <Figure label="Card sales" value={report.card_sales} hint="Simulated" />
        <Figure label="Tips" value={report.tips} />
        <Figure label="Paid in" value={report.paid_in} />
        <Figure label="Paid out" value={report.paid_out} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant="secondary" size="lg" onClick={() => onMove("paid_in")}>
          ⬇ Paid in
        </Button>
        <Button variant="secondary" size="lg" onClick={() => onMove("paid_out")}>
          ⬆ Paid out
        </Button>
        <Button variant="secondary" size="lg" onClick={() => onMove("no_sale")}>
          🔓 No sale
        </Button>
      </div>
      {canClose ? (
        <Button variant="primary" size="lg" className="mt-2 w-full" onClick={onClose}>
          Close drawer
        </Button>
      ) : (
        <p className="mt-3 text-center text-xs text-muted">Only a manager or owner can close the drawer.</p>
      )}
    </Card>
  );
}

const EVENT_META: Record<CashEvent["type"], { icon: string; label: string; sign: 1 | -1 | 0 }> = {
  paid_in: { icon: "⬇", label: "Paid in", sign: 1 },
  paid_out: { icon: "⬆", label: "Paid out", sign: -1 },
  no_sale: { icon: "🔓", label: "No sale", sign: 0 },
  cash_sale: { icon: "💶", label: "Cash sale", sign: 1 },
  cash_refund: { icon: "↩", label: "Cash refund", sign: -1 },
};

/** Cash movements for the open shift, newest first. */
export function EventsTimeline({ shift }: { shift: Shift }) {
  const { money } = usePos();
  const events = [...shift.events].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-bold">Drawer activity</h2>
      <ol className="mt-3 space-y-0">
        {events.map((e) => {
          const m = EVENT_META[e.type];
          return (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              <span className="absolute bottom-0 left-[17px] top-9 w-px bg-line" aria-hidden />
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-base" aria-hidden>
                {m.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{m.label}</span>
                  {m.sign !== 0 ? <span className={cx("font-bold tabular", m.sign > 0 ? "text-ok" : "text-bad")}>{`${m.sign > 0 ? "+" : "−"}${money(e.amount)}`}</span> : null}
                </div>
                <div className="truncate text-sm text-ink-2">{clean(e.reason)}</div>
                <div className="text-xs text-muted">
                  {e.by} · {timeAgo(e.at)}
                </div>
              </div>
            </li>
          );
        })}
        <li className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-base" aria-hidden>
            🔑
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">Drawer opened</span>
              <span className="font-bold tabular">{money(shift.openingFloat)}</span>
            </div>
            <div className="text-xs text-muted">
              {shift.openedBy} · {timeAgo(shift.openedAt)}
            </div>
          </div>
        </li>
      </ol>
      {events.length === 0 ? <p className="mt-3 text-sm text-muted">No paid in, paid out or no-sale events yet.</p> : null}
    </Card>
  );
}
