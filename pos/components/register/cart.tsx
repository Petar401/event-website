"use client";

import { useEffect, useState } from "react";
import { lineTotal } from "@/lib/domain/order";
import type { Order, OrderLine, TicketStatus } from "@/lib/domain/types";
import { usePos } from "@/lib/client/pos-context";
import { AgentBadge, Badge, Button, cx, minutesSince } from "../ui";
import type { BuiltDraft, RegisterState } from "./use-register";

interface CartHandlers {
  onTable: () => void;
  onCustomer: () => void;
  onDiscount: () => void;
}

// ---------------------------------------------------------------------------------------------
// Body: order context + lines
// ---------------------------------------------------------------------------------------------

export function CartBody({ r, onTable, onCustomer }: { r: RegisterState } & Pick<CartHandlers, "onTable" | "onCustomer">) {
  const { order } = r;
  const hasLines = r.draft.length > 0 || (order?.lines.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <CartHeader r={r} />
      <OrderContext r={r} onTable={onTable} onCustomer={onCustomer} />

      {order && order.lines.length > 0 ? (
        <section>
          <SectionLabel>On the check · sent</SectionLabel>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface-2/50">
            {order.lines.map((l) => (
              <ServerLine key={l.id} line={l} order={order} />
            ))}
          </ul>
        </section>
      ) : null}

      {r.draft.length > 0 ? (
        <section>
          {order ? <SectionLabel>New items</SectionLabel> : null}
          <ul className="divide-y divide-line">
            {r.built.map((b) => (
              <DraftRow key={b.draft.key} b={b} onQty={(d) => r.changeQty(b.draft.key, d)} />
            ))}
          </ul>
        </section>
      ) : null}

      {!hasLines ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <div className="text-4xl" aria-hidden>
            🧾
          </div>
          <div className="font-semibold">Nothing on the order yet</div>
          <div className="text-sm text-muted">Tap items to add them. Scan a barcode or type a name in the search box.</div>
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{children}</div>;
}

function CartHeader({ r }: { r: RegisterState }) {
  const { order } = r;
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 2600);
    return () => clearTimeout(t);
  }, [confirm]);

  const agent = order?.channel.startsWith("agent:");
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight">{order ? `Order #${order.number}` : "New order"}</h2>
          {agent ? <AgentBadge agent={order!.channel.slice(6)} label={order!.createdBy.split(" (")[0]} /> : null}
        </div>
        {order ? (
          <div className="text-xs text-muted">
            {order.createdBy} · {minutesSince(order.createdAt)}m ago
          </div>
        ) : null}
      </div>
      {order ? (
        <Button size="sm" variant="ghost" onClick={r.startNew}>
          + New
        </Button>
      ) : r.draft.length > 0 ? (
        <Button
          size="sm"
          variant={confirm ? "danger" : "ghost"}
          onClick={() => {
            if (confirm) {
              r.clearDraft();
              setConfirm(false);
            } else setConfirm(true);
          }}
        >
          {confirm ? "Tap to clear" : "Clear"}
        </Button>
      ) : null}
    </div>
  );
}

function OrderContext({ r, onTable, onCustomer }: { r: RegisterState } & Pick<CartHandlers, "onTable" | "onCustomer">) {
  const { order, mode, table, customer } = r;
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-surface-2/60 p-2">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-3/60 p-1" role="tablist">
        {(["takeaway", "table"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              r.selectMode(m);
              if (m === "table" && !table) onTable();
            }}
            className={cx("h-10 rounded-lg text-sm font-semibold transition", mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {m === "takeaway" ? "🥡 Takeaway" : "🍽 Table"}
          </button>
        ))}
      </div>

      {mode === "table" ? (
        <button onClick={onTable} className="flex h-12 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left text-sm font-semibold hover:bg-surface-2">
          <span aria-hidden>🪑</span>
          {table ? (
            <span className="min-w-0 flex-1 truncate">
              Table {table.name} <span className="font-normal text-muted">· {table.zone} · {table.seats} seats</span>
            </span>
          ) : (
            <span className="flex-1 text-muted">Choose a table…</span>
          )}
          <span className="text-muted" aria-hidden>
            ▾
          </span>
        </button>
      ) : null}

      <div className="flex gap-2">
        <button onClick={onCustomer} className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left text-sm font-semibold hover:bg-surface-2">
          <span aria-hidden>👤</span>
          {customer ? (
            <span className="min-w-0 flex-1 truncate">
              {customer.name} <span className="font-normal text-accent">· {customer.points} pts</span>
            </span>
          ) : (
            <span className="flex-1 text-muted">Add customer</span>
          )}
        </button>
        {customer && !order ? (
          <button onClick={r.removeCustomer} className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted hover:bg-surface-2" aria-label="Remove customer">
            ✕
          </button>
        ) : null}
      </div>

      {order ? (
        order.note ? <div className="rounded-xl bg-surface px-3 py-2 text-sm text-ink-2">📝 {order.note}</div> : null
      ) : (
        <input
          value={r.note}
          onChange={(e) => r.setNote(e.target.value)}
          placeholder="Order note (allergies, name on cup…)"
          maxLength={200}
          className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------------------------

const ticketTone: Record<TicketStatus, { label: string; tone: "neutral" | "warn" | "ok" }> = {
  new: { label: "Sent", tone: "neutral" },
  preparing: { label: "Preparing", tone: "warn" },
  ready: { label: "Ready", tone: "ok" },
  served: { label: "Served", tone: "ok" },
};

function ServerLine({ line, order }: { line: OrderLine; order: Order }) {
  const { money } = usePos();
  const ticket = order.tickets.find((t) => t.lineIds.includes(line.id));
  return (
    <li className="flex gap-3 px-3 py-2.5">
      <span className="text-2xl leading-none" aria-hidden>
        {line.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold leading-tight">
            {line.qty}× {line.name}
          </div>
          <div className="text-sm font-semibold tabular text-ink-2">{money(lineTotal(line))}</div>
        </div>
        {line.modifiers.length ? <div className="mt-0.5 text-xs text-muted">{line.modifiers.map((m) => m.name).join(" · ")}</div> : null}
        {line.note ? <div className="mt-0.5 text-xs italic text-muted">“{line.note}”</div> : null}
        <div className="mt-1">
          {ticket ? <Badge tone={ticketTone[ticket.status].tone}>{ticketTone[ticket.status].label}</Badge> : line.station === "none" ? null : <Badge tone="warn">Not sent</Badge>}
        </div>
      </div>
    </li>
  );
}

function DraftRow({ b, onQty }: { b: BuiltDraft; onQty: (delta: number) => void }) {
  const { money, snapshot } = usePos();
  const product = snapshot?.products.find((p) => p.id === b.draft.productId);
  const line = b.line;
  return (
    <li className={cx("flex gap-3 py-3 animate-pop", b.error && "opacity-90")}>
      <span className="text-2xl leading-none" aria-hidden>
        {product?.emoji ?? "•"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold leading-tight">{product?.name ?? "Unknown item"}</div>
          <div className="text-sm font-bold tabular">{money(b.total)}</div>
        </div>
        {line && line.modifiers.length ? <div className="mt-0.5 text-xs text-muted">{line.modifiers.map((m) => m.name).join(" · ")}</div> : null}
        {b.draft.note ? <div className="mt-0.5 text-xs italic text-muted">“{b.draft.note}”</div> : null}
        {b.error ? <div className="mt-1 text-xs font-semibold text-bad">{b.error}. Remove it to continue.</div> : null}
        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 p-0.5">
          <button onClick={() => onQty(-1)} className="grid size-9 place-items-center rounded-full bg-surface text-lg font-bold shadow-sm transition active:scale-90" aria-label={b.draft.qty === 1 ? "Remove item" : "Decrease quantity"}>
            {b.draft.qty === 1 ? "🗑" : "−"}
          </button>
          <span className="w-8 text-center text-sm font-bold tabular">{b.draft.qty}</span>
          <button onClick={() => onQty(1)} className="grid size-9 place-items-center rounded-full bg-surface text-lg font-bold shadow-sm transition active:scale-90" aria-label="Increase quantity">
            +
          </button>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// Footer: totals + actions
// ---------------------------------------------------------------------------------------------

export function CartFooter({ r, onDiscount }: { r: RegisterState } & Pick<CartHandlers, "onDiscount">) {
  const { money, snapshot } = usePos();
  const t = r.totals;
  const hasError = r.built.some((b) => b.error);
  const payable = r.itemCount > 0 && !hasError && (t.balance > 0 || r.draft.length > 0);
  const d = r.discount;

  return (
    <div className="space-y-3">
      {snapshot && !snapshot.shift ? (
        <div className="rounded-xl bg-warn-soft px-3 py-2 text-xs font-medium text-warn">No cash drawer open — cash payments still work; open one in Cash drawer.</div>
      ) : null}

      {r.itemCount > 0 ? (
        <dl className="space-y-1 text-sm">
          <Row label={`Subtotal · ${r.itemCount} item${r.itemCount === 1 ? "" : "s"}`} value={money(t.subtotal)} />
          {t.discountTotal > 0 ? (
            <Row
              label={
                <span>
                  Discount{d?.kind === "percent" ? ` ${d.value}%` : ""} <span className="text-muted">· {d?.reason}</span>
                </span>
              }
              value={`−${money(t.discountTotal)}`}
              tone="ok"
            />
          ) : null}
          {t.tax > 0 ? <Row label="VAT included" value={money(t.tax)} muted /> : null}
          {t.paid > 0 ? <Row label="Already paid" value={`−${money(t.paid)}`} tone="ok" /> : null}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="text-base font-bold">{t.paid > 0 ? "Balance due" : "Total"}</dt>
            <dd className="text-2xl font-black tabular">{money(t.paid > 0 ? t.balance : t.total)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" disabled={r.itemCount === 0} onClick={onDiscount}>
          % Discount
        </Button>
        <Button variant="secondary" size="lg" disabled={r.draft.length === 0 || hasError} loading={r.busy === "send"} onClick={r.send}>
          Send to kitchen
        </Button>
      </div>
      <Button variant="primary" size="xl" className="w-full text-xl" disabled={!payable} loading={r.busy === "charge"} onClick={r.charge}>
        {r.itemCount === 0 ? "Charge" : `Charge ${money(t.paid > 0 ? t.balance : t.total)}`}
      </Button>
    </div>
  );
}

function Row({ label, value, tone, muted }: { label: React.ReactNode; value: string; tone?: "ok"; muted?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3", muted && "text-xs text-muted", tone === "ok" && "text-ok")}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
