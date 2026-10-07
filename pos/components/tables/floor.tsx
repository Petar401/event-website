"use client";

import { useMemo } from "react";
import type { DiningTable, Order } from "@/lib/domain/types";
import { FloorTable } from "./table-card";
import { tableInfo, type TableInfo } from "./table-info";

const SPAN = { round: 2, square: 2, long: 3 } as const;
const widthOf = (t: DiningTable) => (t.seats <= 1 ? 1 : SPAN[t.shape]);

/** 12-column floor plan. Each table sits at its (x, y); tables take two rows so cards have room to breathe. */
export function Floor({ tables, orders, now, onOpen }: { tables: DiningTable[]; orders: Order[]; now: number; onOpen: (i: TableInfo) => void }) {
  const rows = Math.max(...tables.map((t) => t.y), 0) + 2;

  const zones = useMemo(() => {
    const m = new Map<string, DiningTable[]>();
    for (const t of tables) m.set(t.zone, [...(m.get(t.zone) ?? []), t]);
    return [...m.entries()].map(([name, list]) => ({
      name,
      x0: Math.min(...list.map((t) => t.x)),
      x1: Math.max(...list.map((t) => t.x + widthOf(t) - 1)),
      y0: Math.min(...list.map((t) => t.y)),
      y1: Math.max(...list.map((t) => t.y + 1)),
    }));
  }, [tables]);

  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-surface-2/50 p-6 pt-8">
      <div className="grid min-w-[720px] gap-2" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: "68px" }}>
        {zones.map((z) => (
          <div
            key={z.name}
            className="pointer-events-none relative -m-2.5 rounded-3xl border border-dashed border-line"
            style={{ gridColumn: `${z.x0 + 1} / ${z.x1 + 2}`, gridRow: `${z.y0 + 1} / ${z.y1 + 2}` }}
            aria-hidden
          >
            <span className="absolute -top-2.5 left-4 bg-bg px-2 text-[11px] font-bold uppercase tracking-widest text-muted">{z.name}</span>
          </div>
        ))}
        {tables.map((t) => (
          <div key={t.id} className="relative z-10" style={{ gridColumn: `${t.x + 1} / span ${widthOf(t)}`, gridRow: `${t.y + 1} / span 2` }}>
            <FloorTable info={tableInfo(t, orders, now)} compact={widthOf(t) === 1} onOpen={onOpen} />
          </div>
        ))}
        {/* keeps the grid as tall as the last row even when a row has no tables */}
        <div style={{ gridRow: `${rows} / span 1`, gridColumn: "1" }} aria-hidden />
      </div>
    </div>
  );
}
