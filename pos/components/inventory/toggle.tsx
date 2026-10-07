"use client";

import { cx } from "@/components/ui";

/** Accessible on/off switch with a 44px tap area. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="grid h-11 w-12 shrink-0 place-items-center disabled:opacity-50"
    >
      <span className={cx("relative block h-6 w-11 rounded-full transition-colors", checked ? "bg-ok" : "bg-surface-3")}>
        <span className={cx("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
    </button>
  );
}
