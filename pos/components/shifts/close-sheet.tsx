"use client";

import { useEffect, useState } from "react";
import { haptic } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Button, Sheet, cx } from "@/components/ui";
import { act, type ZReport } from "./act";

/** Notes and coins, in cents. */
const DENOMS: { cents: number; label: string }[] = [
  { cents: 5000, label: "€50" },
  { cents: 2000, label: "€20" },
  { cents: 1000, label: "€10" },
  { cents: 500, label: "€5" },
  { cents: 200, label: "€2" },
  { cents: 100, label: "€1" },
  { cents: 50, label: "50c" },
  { cents: 20, label: "20c" },
  { cents: 10, label: "10c" },
];

/** Count the drawer by denomination, see over/short live, then close the shift. */
export function CloseSheet({ open, expectedCents, onClose, onClosed }: { open: boolean; expectedCents: number; onClose: () => void; onClosed: (z: ZReport) => void }) {
  const { money, toast, refreshSnapshot } = usePos();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setCounts({});
  }, [open]);

  const counted = DENOMS.reduce((s, d) => s + d.cents * (counts[d.cents] ?? 0), 0);
  const diff = counted - expectedCents;
  const tone = diff === 0 ? "ok" : "bad";
  const set = (cents: number, n: number) => {
    haptic(6);
    setCounts((c) => ({ ...c, [cents]: Math.max(0, Math.min(999, n)) }));
  };

  const close = async () => {
    setBusy(true);
    const r = await act<ZReport>(toast, "close_shift", { counted_cash_cents: counted });
    setBusy(false);
    if (r) {
      void refreshSnapshot();
      onClosed(r);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title="Close drawer"
      footer={
        <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={close}>
          Close drawer · counted {money(counted)}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted">Count what is in the drawer, including the float. Tap + for each note or coin, or type the quantity.</p>
      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DENOMS.map((d) => {
            const n = counts[d.cents] ?? 0;
            return (
              <li key={d.cents} className={cx("flex items-center gap-2 rounded-2xl border p-2", n > 0 ? "border-accent/40 bg-accent-soft/40" : "border-line bg-surface-2")}>
                <div className="w-12 text-center text-base font-bold tabular">{d.label}</div>
                <button onClick={() => set(d.cents, n - 1)} disabled={n === 0} aria-label={`Remove one ${d.label}`} className="grid size-11 place-items-center rounded-xl bg-surface text-xl font-bold shadow-sm transition active:scale-90 disabled:opacity-40">
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label={`${d.label} quantity`}
                  value={n || ""}
                  placeholder="0"
                  onChange={(e) => set(d.cents, Math.trunc(Number(e.target.value.replace(/\D/g, ""))) || 0)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface text-center text-lg font-bold tabular focus:border-accent focus:outline-none"
                />
                <button onClick={() => set(d.cents, n + 1)} aria-label={`Add one ${d.label}`} className="grid size-11 place-items-center rounded-xl bg-accent text-xl font-bold text-accent-ink shadow-sm transition active:scale-90">
                  +
                </button>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2 md:sticky md:top-0 md:self-start">
          <div className="rounded-2xl bg-surface-2 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Expected</span>
              <span className="font-semibold tabular">{money(expectedCents)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-muted">Counted</span>
              <span className="font-semibold tabular">{money(counted)}</span>
            </div>
          </div>
          <div className={cx("rounded-2xl p-4 text-center", tone === "ok" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")} role="status" aria-live="polite">
            <div className="text-xs font-semibold uppercase tracking-wide">{diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short"}</div>
            <div key={diff} className="animate-pop text-3xl font-bold tabular">
              {diff === 0 ? money(0) : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
            </div>
          </div>
          {counted === 0 ? <p className="text-center text-xs text-muted">Nothing counted yet. Closing with zero records the whole drawer as short.</p> : null}
        </div>
      </div>
    </Sheet>
  );
}
