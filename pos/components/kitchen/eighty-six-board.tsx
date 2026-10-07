"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/domain/types";
import { Badge, Card, Input, cx } from "@/components/ui";

/** "86 board": quick on/off toggles for products, unavailable ones first. */
export function EightySixBoard({
  products,
  onToggle,
  open,
  onOpenChange,
}: {
  products: Product[];
  onToggle: (p: Product, available: boolean) => void;
  /** Phone/tablet collapse state. On ≥ 2xl the board is always expanded. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const unavailableCount = products.filter((p) => !p.available).length;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .sort((a, b) => Number(a.available) - Number(b.available) || a.name.localeCompare(b.name));
  }, [products, q]);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left 2xl:pointer-events-none"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg font-bold">86 board</span>
          {unavailableCount > 0 ? <Badge tone="bad">{unavailableCount} off</Badge> : <Badge tone="ok">all available</Badge>}
        </span>
        <span aria-hidden className={cx("text-muted transition 2xl:hidden", open && "rotate-180")}>
          ▾
        </span>
      </button>

      <div className={cx("border-t border-line", open ? "block" : "hidden 2xl:block")}>
        <div className="p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" aria-label="Search items" type="search" />
        </div>
        <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto border-t border-line 2xl:max-h-[calc(100dvh-17rem)]">
          {rows.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="switch"
                aria-checked={p.available}
                aria-label={`${p.name} ${p.available ? "available" : "86'd"}`}
                onClick={() => onToggle(p, !p.available)}
                className={cx("flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition active:bg-surface-2", !p.available && "bg-bad-soft")}
              >
                <span className="text-2xl" aria-hidden>
                  {p.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx("block truncate text-base font-semibold", !p.available && "text-bad line-through")}>{p.name}</span>
                  {!p.available ? <span className="text-xs font-bold uppercase tracking-wide text-bad">86&apos;d</span> : p.trackStock && p.stock <= p.parLevel ? <span className="text-xs font-semibold text-warn">{p.stock} left</span> : null}
                </span>
                <span className={cx("relative h-8 w-14 shrink-0 rounded-full transition", p.available ? "bg-ok" : "bg-surface-3")}>
                  <span className={cx("absolute top-1 size-6 rounded-full bg-white shadow transition-all", p.available ? "left-7" : "left-1")} />
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-4 py-8 text-center text-sm text-muted">No items match “{q}”</li> : null}
        </ul>
      </div>
    </Card>
  );
}
