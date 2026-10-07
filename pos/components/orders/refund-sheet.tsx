"use client";

import { useMemo, useState } from "react";
import { callTool, haptic, newKey } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { toCents } from "@/lib/domain/money";
import { lineUnitTotal, linesRefundValue, refundableAmount } from "@/lib/domain/order";
import type { Order } from "@/lib/domain/types";
import { Button, Field, Input, Segmented, Sheet, cx } from "@/components/ui";

type Mode = "items" | "full" | "custom";

const QUICK_REASONS = ["Wrong item", "Order error", "Quality issue", "Customer unhappy"];

/** Mount only while open so each opening gets a fresh idempotency key and empty form. */
export function RefundSheet({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const { session, toast, money } = usePos();
  const [mode, setMode] = useState<Mode>("items");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [custom, setCustom] = useState("");
  const [restock, setRestock] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [key] = useState(newKey);

  const max = refundableAmount(order);
  const remaining = useMemo(() => order.lines.map((l) => ({ line: l, left: l.qty - l.refundedQty })).filter((r) => r.left > 0), [order.lines]);
  const selected = useMemo(() => remaining.filter((r) => (qty[r.line.id] ?? 0) > 0).map((r) => ({ lineId: r.line.id, qty: qty[r.line.id] })), [remaining, qty]);

  const amount =
    mode === "full" ? max : mode === "custom" ? Math.min(max, Math.max(0, toCents(custom))) : Math.min(max, selected.length ? linesRefundValue(order, selected) : 0);
  const customTooHigh = mode === "custom" && toCents(custom) > max;
  const canSubmit = amount > 0 && reason.trim().length > 0;
  const needsApproval = session.role === "cashier";

  const step = (id: string, delta: number, left: number) => {
    haptic();
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(left, (q[id] ?? 0) + delta)) }));
  };

  const submit = async () => {
    setBusy(true);
    const base = { order: order.id, reason: reason.trim(), restock: restock && mode !== "custom", idempotency_key: key };
    // A full refund also ticks every remaining line off, with the exact refundable amount, so no cents are left behind.
    const body =
      mode === "items"
        ? { ...base, lines: selected.map((s) => ({ line_id: s.lineId, qty: s.qty })) }
        : mode === "full"
          ? { ...base, lines: remaining.map((r) => ({ line_id: r.line.id, qty: r.left })), amount_cents: max }
          : { ...base, amount_cents: amount };
    const res = await callTool("refund_order", body);
    setBusy(false);
    if (res.ok) {
      toast({ title: `Refunded ${money(amount)}`, body: `Order #${order.number}`, tone: "ok" });
      onDone();
    } else if (res.code === "approval_required") {
      toast({ title: "Sent to a manager for approval", body: `Refund of ${money(amount)} on #${order.number} is waiting for a manager.`, tone: "warn" });
      onDone();
    } else {
      toast({ title: "Refund failed", body: res.error, tone: "bad" });
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Refund order #${order.number}`}
      footer={
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Refund amount</span>
            <span className="text-2xl font-bold tabular">{money(amount)}</span>
          </div>
          {needsApproval ? <p className="text-xs text-warn">Cashier refunds are sent to a manager for approval.</p> : null}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" disabled={!canSubmit} loading={busy} onClick={submit}>
              {needsApproval ? "Request refund" : "Refund"}
            </Button>
          </div>
        </div>
      }
    >
      <Segmented
        className="w-full [&>button]:flex-1"
        value={mode}
        onChange={setMode}
        options={[
          { value: "items", label: "Items" },
          { value: "full", label: "Full refund" },
          { value: "custom", label: "Custom" },
        ]}
      />

      <div className="mt-4">
        {mode === "items" ? (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {remaining.map(({ line, left }) => {
              const n = qty[line.id] ?? 0;
              return (
                <li key={line.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-xl" aria-hidden>
                    {line.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{line.name}</div>
                    <div className="text-xs text-muted tabular">
                      {money(lineUnitTotal(line))} each · {left} refundable
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => step(line.id, -1, left)} disabled={n === 0} aria-label={`Fewer ${line.name}`} className="grid size-11 place-items-center rounded-xl bg-surface-2 text-lg font-bold disabled:opacity-40">
                      −
                    </button>
                    <span className={cx("w-7 text-center text-base font-bold tabular", n > 0 && "text-accent")}>{n}</span>
                    <button type="button" onClick={() => step(line.id, 1, left)} disabled={n >= left} aria-label={`More ${line.name}`} className="grid size-11 place-items-center rounded-xl bg-surface-2 text-lg font-bold disabled:opacity-40">
                      +
                    </button>
                  </div>
                </li>
              );
            })}
            {remaining.length === 0 ? <li className="px-3 py-4 text-sm text-muted">All items have already been refunded.</li> : null}
          </ul>
        ) : null}

        {mode === "full" ? (
          <div className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
            Refunds everything still refundable on this order: <b className="tabular text-ink">{money(max)}</b>.
          </div>
        ) : null}

        {mode === "custom" ? (
          <Field label="Amount" hint={`Up to ${money(max)} can still be refunded.`}>
            <Input inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="0.00" autoFocus aria-invalid={customTooHigh} />
            {customTooHigh ? <span className="mt-1 block text-xs text-bad">That&apos;s more than the refundable amount, so it will be capped at {money(max)}.</span> : null}
          </Field>
        ) : null}
      </div>

      {mode !== "custom" ? (
        <button type="button" role="switch" aria-checked={restock} onClick={() => setRestock((r) => !r)} className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 text-left">
          <span>
            <span className="block text-sm font-semibold">Return items to stock</span>
            <span className="block text-xs text-muted">Adds the refunded quantities back to inventory.</span>
          </span>
          <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition", restock ? "bg-ok" : "bg-surface-3")}>
            <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", restock ? "left-[1.35rem]" : "left-0.5")} />
          </span>
        </button>
      ) : null}

      <div className="mt-4">
        <Field label="Reason (required)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being refunded?" maxLength={200} />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="h-9 rounded-full border border-line bg-surface-2 px-3 text-sm font-semibold text-ink-2 hover:bg-surface-3">
              {r}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
