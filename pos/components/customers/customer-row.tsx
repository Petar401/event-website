"use client";

import type { Customer } from "@/lib/domain/types";
import { Badge, cx, timeAgo } from "@/components/ui";
import { CustomerAvatar } from "./customer-avatar";

export function tagTone(tag: string): "warn" | "ai" | "neutral" {
  const t = tag.toLowerCase();
  if (t === "vip") return "warn";
  if (t === "regular") return "ai";
  return "neutral";
}

export function CustomerRow({ customer, selected, onSelect }: { customer: Customer; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cx(
        "flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition active:scale-[0.99]",
        selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2",
      )}
    >
      <CustomerAvatar name={customer.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-semibold">{customer.name}</span>
        </div>
        {customer.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {customer.tags.slice(0, 3).map((t) => (
              <Badge key={t} tone={tagTone(t)}>
                {t}
              </Badge>
            ))}
            {customer.tags.length > 3 ? <Badge>+{customer.tags.length - 3}</Badge> : null}
          </div>
        ) : null}
        <div className="mt-1 text-xs text-muted tabular">
          {customer.visits} visit{customer.visits === 1 ? "" : "s"} · {customer.lastVisitAt ? timeAgo(customer.lastVisitAt) : "no visits yet"}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-base font-bold tabular">{customer.points}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">points</div>
      </div>
    </button>
  );
}
