"use client";

import { haptic } from "@/lib/client/api";
import { cx } from "@/components/ui";

/** Large, glanceable segmented control for the kitchen display (44px+ targets). */
export function BigSegmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-2xl border border-line bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => {
            haptic();
            onChange(o.value);
          }}
          className={cx("h-11 min-w-20 rounded-xl px-4 text-base font-bold transition", value === o.value ? "bg-ink text-bg shadow-sm" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
