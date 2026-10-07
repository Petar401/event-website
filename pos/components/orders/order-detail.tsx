"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePos } from "@/lib/client/pos-context";
import { computeTotals, lineTotal, lineUnitTotal, refundableAmount } from "@/lib/domain/order";
import type { Order } from "@/lib/domain/types";
import { AgentBadge, Badge, Button, cx } from "@/components/ui";
import { agentOf, formatDateTime, STATUS_META, TENDER_LABEL } from "./format";
import { ReceiptQr, receiptText } from "./receipt-qr";
import { RefundSheet } from "./refund-sheet";
import { VoidSheet } from "./void-sheet";

const TICKET_TONE = { new: "accent", preparing: "warn", ready: "ok", served: "neutral" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, strong, tone }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: "bad" | "ok" | "muted" }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3 py-0.5 text-sm", strong && "text-base font-bold", tone === "bad" && "text-bad", tone === "ok" && "text-ok", tone === "muted" && "text-muted")}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

export function OrderDetail({ order, customerName, onChanged }: { order: Order; customerName: string | null; onChanged: () => void }) {
  const { snapshot, money } = usePos();
  const [refunding, setRefunding] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const settings = snapshot?.settings;
  const locale = settings?.locale ?? "en-IE";
  const totals = computeTotals(order);
  const agent = agentOf(order.channel);
  const meta = STATUS_META[order.status];
  const table = order.tableId ? (snapshot?.tables.find((t) => t.id === order.tableId)?.name ?? null) : null;
  const refundable = refundableAmount(order);
  const canRefund = (order.status === "paid" || order.status === "partially_refunded") && refundable > 0;
  const receipt = useMemo(
    () => receiptText(order, { business: settings?.businessName ?? "Receipt", currency: settings?.currency ?? "EUR", locale }),
    [order, settings?.businessName, settings?.currency, locale],
  );

  return (
    <div className="pb-2">
      {/* Header */}
      <div className="px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-3xl font-bold tracking-tight tabular">#{order.number}</h2>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {agent ? <AgentBadge agent={agent.kind} label={`via ${agent.name}`} /> : null}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted">Created by</dt>
            <dd className="truncate font-semibold">{order.createdBy}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Channel</dt>
            <dd className="font-semibold">{agent ? `AI · ${agent.name}` : "Register"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Table</dt>
            <dd className="font-semibold">{table ? `Table ${table}` : "Takeaway"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Customer</dt>
            <dd className="truncate font-semibold">{customerName ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted">Placed</dt>
            <dd className="font-semibold tabular">{formatDateTime(order.createdAt, locale)}</dd>
          </div>
        </dl>
        {order.note ? <div className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{order.note}</div> : null}

        {/* Actions */}
        {order.status === "open" ? (
          <div className="mt-4 flex gap-2">
            <Link href={`/?order=${order.id}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink shadow-sm transition hover:brightness-105 active:scale-[0.98]">
              Continue in register
            </Link>
            <Button variant="secondary" className="text-bad" onClick={() => setVoiding(true)}>
              Void
            </Button>
          </div>
        ) : null}
        {canRefund ? (
          <div className="mt-4">
            <Button variant="secondary" className="w-full" onClick={() => setRefunding(true)}>
              Refund · up to {money(refundable)}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Lines */}
      <Section title={`Items (${order.lines.reduce((n, l) => n + l.qty, 0)})`}>
        <ul className="space-y-3">
          {order.lines.map((l) => (
            <li key={l.id} className="flex items-start gap-3">
              <span className="text-xl leading-6" aria-hidden>
                {l.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  <span className="tabular text-muted">{l.qty}× </span>
                  {l.name}
                </div>
                {l.modifiers.length > 0 ? <div className="text-xs text-muted">{l.modifiers.map((m) => m.name).join(" · ")}</div> : null}
                {l.note ? <div className="mt-1 inline-block rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-semibold text-warn">{l.note}</div> : null}
                {l.refundedQty > 0 ? <div className="mt-1 text-xs font-semibold text-bad">{l.refundedQty} refunded</div> : null}
                {l.qty > 1 ? <div className="text-xs text-muted tabular">{money(lineUnitTotal(l))} each</div> : null}
              </div>
              <div className="text-sm font-semibold tabular">{money(lineTotal(l))}</div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Totals */}
      <Section title="Totals">
        <Row label="Subtotal" value={money(totals.subtotal)} />
        {totals.discountTotal > 0 ? <Row label={`Discount${order.discount?.reason ? ` (${order.discount.reason})` : ""}`} value={`−${money(totals.discountTotal)}`} tone="ok" /> : null}
        <Row label="Total" value={money(totals.total)} strong />
        {totals.taxByRate.map((t) => (
          <Row key={t.rate} label={`VAT ${Math.round(t.rate * 1000) / 10}% included`} value={money(t.amount)} tone="muted" />
        ))}
        {totals.tipTotal > 0 ? <Row label="Tips" value={money(totals.tipTotal)} /> : null}
        <Row label="Paid" value={money(totals.paid)} />
        {totals.balance > 0 && order.status === "open" ? <Row label="Balance due" value={money(totals.balance)} tone="bad" /> : null}
        {totals.refunded > 0 ? <Row label="Refunded" value={`−${money(totals.refunded)}`} tone="bad" /> : null}
        {totals.refunded > 0 ? <Row label="Net after refunds" value={money(totals.net)} strong /> : null}
      </Section>

      {/* Payments */}
      <Section title="Payments">
        {order.payments.length === 0 ? (
          <p className="text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {order.payments.map((p) => (
              <li key={p.id} className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{TENDER_LABEL[p.method]}</span>
                  <span className="font-bold tabular">{money(p.amount)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted tabular">
                  {p.tip > 0 ? <span>Tip {money(p.tip)}</span> : null}
                  {p.tendered !== undefined ? <span>Tendered {money(p.tendered)}</span> : null}
                  {p.change ? <span>Change {money(p.change)}</span> : null}
                  <span>{formatDateTime(p.at, locale)}</span>
                </div>
                <div className="mt-0.5 break-all font-mono text-[11px] text-muted">{p.reference}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Refund history */}
      {order.refunds.length > 0 ? (
        <Section title="Refunds">
          <ul className="space-y-2.5">
            {order.refunds.map((r) => (
              <li key={r.id} className="rounded-xl bg-bad-soft px-3 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-bad">Refunded to {TENDER_LABEL[r.method]}</span>
                  <span className="font-bold text-bad tabular">−{money(r.amount)}</span>
                </div>
                <div className="mt-1 text-ink-2">{r.reason}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {r.by} · {formatDateTime(r.at, locale)}
                  {r.restock ? " · restocked" : ""}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Kitchen */}
      {order.tickets.length > 0 ? (
        <Section title="Kitchen">
          <ul className="space-y-1.5">
            {order.tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold capitalize">
                  {t.station} <span className="font-normal text-muted">· {t.lineIds.length} item{t.lineIds.length === 1 ? "" : "s"}</span>
                </span>
                <Badge tone={TICKET_TONE[t.status]} className="capitalize">
                  {t.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Receipt */}
      <Section title="Receipt">
        <ReceiptQr text={receipt} />
      </Section>

      {refunding ? (
        <RefundSheet
          order={order}
          onClose={() => setRefunding(false)}
          onDone={() => {
            setRefunding(false);
            onChanged();
          }}
        />
      ) : null}
      {voiding ? (
        <VoidSheet
          order={order}
          onClose={() => setVoiding(false)}
          onDone={() => {
            setVoiding(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
