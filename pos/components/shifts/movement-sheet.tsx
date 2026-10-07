"use client";

import { useEffect, useState } from "react";
import { usePos } from "@/lib/client/pos-context";
import { Button, Field, Input, Sheet, cx } from "@/components/ui";
import { act } from "./act";
import { Keypad } from "./keypad";

export type MovementType = "paid_in" | "paid_out" | "no_sale";

const COPY: Record<MovementType, { title: string; cta: string; presets: string[] }> = {
  paid_in: { title: "Paid in", cta: "Add to drawer", presets: ["Change top-up", "Float top-up", "Customer deposit"] },
  paid_out: { title: "Paid out", cta: "Take from drawer", presets: ["Milk run", "Supplies", "Tip payout", "Delivery cash"] },
  no_sale: { title: "No sale", cta: "Open drawer (no sale)", presets: ["Change for customer", "Checking float", "Drawer check"] },
};

/** Record cash in/out of the drawer, or a no-sale open. */
export function MovementSheet({ type, onClose }: { type: MovementType | null; onClose: () => void }) {
  const { money, toast, refreshSnapshot } = usePos();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmount(0);
    setReason("");
  }, [type]);

  if (!type) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const copy = COPY[type];
  const needsAmount = type !== "no_sale";
  const effectiveReason = reason.trim() || (type === "no_sale" ? "No sale" : "");
  const valid = effectiveReason.length > 0 && (!needsAmount || amount > 0);

  const submit = async () => {
    setBusy(true);
    const r = await act(toast, "cash_movement", { type, amount_cents: needsAmount ? amount : 0, reason: effectiveReason });
    setBusy(false);
    if (r) {
      toast({ tone: "ok", title: needsAmount ? `${copy.title} ${money(amount)}` : "No sale logged", body: effectiveReason });
      void refreshSnapshot();
      onClose();
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={copy.title}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={!valid} loading={busy} onClick={submit}>
          {copy.cta}
          {needsAmount && amount > 0 ? ` · ${money(amount)}` : ""}
        </Button>
      }
    >
      {needsAmount ? (
        <div className="mb-4">
          <div className="mb-3 text-center text-4xl font-bold tabular" aria-live="polite">
            {money(amount)}
          </div>
          <Keypad value={amount} onChange={setAmount} max={999_999} />
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted">Opens the drawer without a sale. It is logged with your name so the count stays honest.</p>
      )}
      <div className="mb-2 flex flex-wrap gap-2">
        {copy.presets.map((p) => (
          <button
            key={p}
            onClick={() => setReason(p)}
            aria-pressed={reason === p}
            className={cx("h-10 rounded-full border px-4 text-sm font-semibold transition", reason === p ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3")}
          >
            {p}
          </button>
        ))}
      </div>
      <Field label="Reason">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "no_sale" ? "No sale" : "What was it for?"} maxLength={120} />
      </Field>
    </Sheet>
  );
}
