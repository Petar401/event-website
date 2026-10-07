"use client";

import type { Order } from "@/lib/domain/types";
import { AgentBadge, Badge, cx } from "@/components/ui";
import { agentOf, formatTime, itemSummary, STATUS_META } from "./format";

export function OrderRow({
  order,
  selected,
  locale,
  tableName,
  customerName,
  money,
  onSelect,
}: {
  order: Order;
  selected: boolean;
  locale: string;
  tableName: string | null;
  customerName: string | null;
  money: (cents: number) => string;
  onSelect: () => void;
}) {
  const agent = agentOf(order.channel);
  const meta = STATUS_META[order.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cx(
        "flex min-h-[4.5rem] w-full flex-col gap-1 rounded-2xl border px-3.5 py-2.5 text-left transition active:scale-[0.99]",
        selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-base font-bold tabular">#{order.number}</span>
          <span className="text-xs text-muted tabular">{formatTime(order.createdAt, locale)}</span>
        </div>
        <span className={cx("text-base font-bold tabular", order.status === "void" && "text-muted line-through")}>{money(order.total)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-ink-2">{itemSummary(order.lines)}</span>
        <Badge tone={meta.tone} className="shrink-0">
          {meta.label}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {agent ? <AgentBadge agent={agent.kind} label={`via ${agent.name}`} /> : null}
        <span className="truncate">{order.createdBy}</span>
        {tableName ? <span>· Table {tableName}</span> : null}
        {customerName ? <span className="truncate">· {customerName}</span> : null}
      </div>
    </button>
  );
}
