"use client";

import { useEffect, useRef, useState } from "react";
import { newKey } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Button, Field, Input, Sheet, cx } from "@/components/ui";
import { act } from "./act";

export interface AdjustTarget {
  productId: string;
  name: string;
  emoji: string;
  stock: number;
}

const QUICK = [-12, -6, -1, 1, 6, 12];
const REASONS = ["Delivery", "Waste", "Count correction", "Staff meal"];

/** Bottom sheet to change stock by a delta with a reason. */
export function AdjustSheet({ target, onClose, onDone }: { target: AdjustTarget | null; onClose: () => void; onDone: () => void }) {
  const { toast, refreshSnapshot } = usePos();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  useEffect(() => {
    if (!target) return;
    setDelta(0);
    setReason(REASONS[0]);
    setCustom("");
  }, [target]);

  // A different request needs a fresh idempotency key.
  useEffect(() => {
    key.current = newKey();
  }, [delta, reason, target]);

  if (!target) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const next = Math.max(0, target.stock + delta);
  const bump = (d: number) => {
    setDelta((v) => Math.max(-target.stock, v + d));
    setCustom("");
  };

  const submit = async () => {
    setBusy(true);
    const r = await act<{ product: string; from: number; to: number }>(
      toast,
      "adjust_stock",
      { product: target.productId, delta, reason, idempotency_key: key.current },
      { success: (d) => ({ title: `${d.product} stock updated`, body: `${d.from} → ${d.to} · ${reason}` }) },
    );
    setBusy(false);
    if (r) {
      void refreshSnapshot();
      onDone();
      onClose();
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>{target.emoji}</span> Adjust {target.name}
        </span>
      }
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={delta === 0} loading={busy} onClick={submit}>
          {delta === 0 ? "Choose an adjustment" : `Set stock to ${next}`}
        </Button>
      }
    >
      <div className="flex items-center justify-center gap-4 rounded-2xl bg-surface-2 py-5">
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Now</div>
          <div className="text-3xl font-bold tabular">{target.stock}</div>
        </div>
        <span className="text-2xl text-muted" aria-hidden>
          →
        </span>
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">After</div>
          <div key={next} className={cx("animate-pop text-3xl font-bold tabular", delta > 0 && "text-ok", delta < 0 && "text-bad")}>
            {next}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => bump(q)}
            className={cx(
              "h-12 rounded-xl border border-line bg-surface-2 text-base font-bold tabular transition active:scale-95",
              q > 0 ? "text-ok hover:bg-ok-soft" : "text-bad hover:bg-bad-soft",
            )}
          >
            {q > 0 ? `+${q}` : q}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="Custom change" hint="Use a negative number to remove stock.">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 24 or -3"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Math.trunc(Number(e.target.value));
              setDelta(Number.isFinite(n) ? Math.max(-target.stock, Math.min(10000, n)) : 0);
            }}
          />
        </Field>
        <Button
          variant="ghost"
          onClick={() => {
            setDelta(0);
            setCustom("");
          }}
        >
          Reset
        </Button>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Reason</div>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              aria-pressed={reason === r}
              className={cx(
                "h-10 rounded-full border px-4 text-sm font-semibold transition",
                reason === r ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
