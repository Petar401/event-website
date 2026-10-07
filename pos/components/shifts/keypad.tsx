"use client";

import { haptic } from "@/lib/client/api";
import { cx } from "@/components/ui";

/**
 * Cash-register style keypad: digits push in from the right as cents (typing 1 5 0 0 0 gives 150.00).
 * The value is controlled in cents so callers can also set it from quick-amount chips.
 */
export function Keypad({ value, onChange, max = 99_999_99 }: { value: number; onChange: (cents: number) => void; max?: number }) {
  const press = (d: string) => {
    haptic(6);
    const next = d === "00" ? value * 100 : value * 10 + Number(d);
    if (next <= max) onChange(next);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === "⌫" ? "Delete last digit" : k}
          onClick={() => {
            if (k === "⌫") {
              haptic(6);
              onChange(Math.floor(value / 10));
            } else press(k);
          }}
          className={cx("h-14 rounded-2xl border border-line text-xl font-semibold tabular transition active:scale-95", k === "⌫" ? "bg-surface-3 text-ink-2" : "bg-surface-2 hover:bg-surface-3")}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
