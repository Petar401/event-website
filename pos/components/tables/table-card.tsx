"use client";

import { haptic } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { AgentBadge, Badge, cx } from "../ui";
import { duration, type TableInfo } from "./table-info";

const shapeRadius = { round: "rounded-[2.25rem]", square: "rounded-2xl", long: "rounded-2xl" } as const;

function tone(info: TableInfo) {
  if (!info.order) return "border-line bg-surface hover:border-ok/50 hover:bg-ok-soft/40";
  if (info.kitchen?.tone === "ok") return "border-ok/60 bg-ok-soft";
  return "border-accent/50 bg-accent-soft";
}

/** Floor-plan tile. `compact` is used for single-column tables such as bar stools. */
export function FloorTable({ info, compact, onOpen }: { info: TableInfo; compact?: boolean; onOpen: (i: TableInfo) => void }) {
  const { money } = usePos();
  const { table, order } = info;
  return (
    <button
      onClick={() => {
        haptic();
        onOpen(info);
      }}
      aria-label={order ? `Table ${table.name}, occupied, ${money(order.total)}` : `Table ${table.name}, free, ${table.seats} seats`}
      className={cx("relative flex h-full w-full flex-col items-center justify-center gap-0.5 border-2 p-1.5 text-center shadow-card transition active:scale-[0.97]", shapeRadius[table.shape], tone(info))}
    >
      <span className={cx("font-black leading-none", compact ? "text-base" : "text-2xl")}>{table.name}</span>
      {order ? (
        <>
          <span className={cx("font-bold tabular text-accent", compact ? "text-[11px]" : "text-sm", info.kitchen?.tone === "ok" && "text-ok")}>{money(order.total)}</span>
          {!compact ? (
            <>
              <span className="text-[11px] tabular text-ink-2">
                {duration(info.minutes)} · {info.items} item{info.items === 1 ? "" : "s"}
              </span>
              {info.kitchen ? <Badge tone={info.kitchen.tone} className="px-1.5 text-[10px]">{info.kitchen.label}</Badge> : null}
            </>
          ) : null}
          {info.agent ? <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ai text-[10px] font-bold text-white shadow-sm" title={`Order by ${info.agent.label}`}>✦</span> : null}
        </>
      ) : (
        <span className={cx("text-muted", compact ? "text-[10px]" : "text-xs")}>{compact ? "Free" : `${table.seats} seats · free`}</span>
      )}
    </button>
  );
}

/** Large phone card. */
export function TableListCard({ info, onOpen }: { info: TableInfo; onOpen: (i: TableInfo) => void }) {
  const { money } = usePos();
  const { table, order } = info;
  return (
    <button
      onClick={() => {
        haptic();
        onOpen(info);
      }}
      className={cx("flex min-h-24 w-full items-center gap-4 rounded-2xl border-2 p-4 text-left shadow-card transition active:scale-[0.98]", tone(info))}
    >
      <span className={cx("grid size-14 shrink-0 place-items-center bg-surface text-2xl font-black shadow-sm", table.shape === "round" ? "rounded-full" : "rounded-2xl")}>{table.name}</span>
      <div className="min-w-0 flex-1">
        {order ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-lg font-black tabular">{money(order.total)}</span>
              {info.kitchen ? <Badge tone={info.kitchen.tone}>{info.kitchen.label}</Badge> : null}
              {info.agent ? <AgentBadge agent={info.agent.agent} label={info.agent.label} /> : null}
            </div>
            <div className="mt-0.5 text-sm text-ink-2">
              Seated {duration(info.minutes)} · {info.items} item{info.items === 1 ? "" : "s"} · #{order.number}
            </div>
          </>
        ) : (
          <>
            <div className="text-lg font-bold text-ok">Free</div>
            <div className="text-sm text-muted">Seats {table.seats} · tap to start an order</div>
          </>
        )}
      </div>
      <span className="text-xl text-muted" aria-hidden>
        ›
      </span>
    </button>
  );
}
