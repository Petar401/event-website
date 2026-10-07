"use client";

import { useState } from "react";
import { haptic } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Button, Card, cx } from "@/components/ui";
import { act } from "./act";
import { Keypad } from "./keypad";

const QUICK = [10000, 15000, 20000];

/** Big "start your shift" card with a float keypad. */
export function OpenDrawer({ onOpened }: { onOpened: () => void }) {
  const { money, toast, refreshSnapshot } = usePos();
  const [float, setFloat] = useState(15000);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    const r = await act(toast, "open_shift", { opening_float_cents: float });
    setBusy(false);
    if (r) {
      toast({ tone: "ok", title: "Drawer open", body: `Starting float ${money(float)}. Have a great shift.` });
      void refreshSnapshot();
      onOpened();
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden">
      <div className="bg-accent-soft px-5 py-5 text-center">
        <div className="text-4xl" aria-hidden>
          🔓
        </div>
        <h2 className="mt-1 text-xl font-bold">Open the cash drawer</h2>
        <p className="mt-1 text-sm text-ink-2">Count the opening float and enter it below. Sales can be taken once the drawer is open.</p>
      </div>
      <div className="space-y-4 p-5">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Opening float</div>
          <div className="text-5xl font-bold tabular" aria-live="polite">
            {money(float)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => {
                haptic(6);
                setFloat(q);
              }}
              aria-pressed={float === q}
              className={cx("h-11 rounded-xl border text-sm font-bold tabular transition active:scale-95", float === q ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 hover:bg-surface-3")}
            >
              {money(q).replace(/[.,]00$/, "")}
            </button>
          ))}
        </div>
        <Keypad value={float} onChange={setFloat} />
        <Button variant="primary" size="xl" className="w-full" loading={busy} onClick={open}>
          Open drawer with {money(float)}
        </Button>
      </div>
    </Card>
  );
}
