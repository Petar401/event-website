"use client";

import { useState } from "react";
import { callTool, newKey } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import type { Order } from "@/lib/domain/types";
import { Button, Field, Input, Sheet } from "@/components/ui";

const QUICK_REASONS = ["Customer left", "Ordered by mistake", "Duplicate order", "Test order"];

/** Mount only while open so each opening gets a fresh idempotency key and empty form. */
export function VoidSheet({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const { toast } = usePos();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [key] = useState(newKey);

  const submit = async () => {
    setBusy(true);
    const res = await callTool("void_order", { order: order.id, reason: reason.trim(), idempotency_key: key });
    setBusy(false);
    if (res.ok) {
      toast({ title: `Order #${order.number} voided`, tone: "ok" });
      onDone();
    } else if (res.code === "approval_required") {
      toast({ title: "Sent to a manager for approval", body: `Voiding #${order.number} is waiting for a manager's OK.`, tone: "warn" });
      onDone();
    } else {
      toast({ title: "Couldn't void order", body: res.error, tone: "bad" });
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Void order #${order.number}`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Keep order
          </Button>
          <Button variant="danger" className="flex-1" disabled={!reason.trim()} loading={busy} onClick={submit}>
            Void order
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-ink-2">Voiding cancels this unpaid order and removes it from the kitchen. This can&apos;t be undone.</p>
      <Field label="Reason (required)">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this order being voided?" maxLength={200} autoFocus />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className="h-9 rounded-full border border-line bg-surface-2 px-3 text-sm font-semibold text-ink-2 hover:bg-surface-3">
            {r}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
