"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Customer, DiningTable, Discount, Order } from "@/lib/domain/types";
import { callTool, haptic } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Badge, Button, Input, Sheet, Spinner, cx } from "../ui";

// ---------------------------------------------------------------------------------------------
// Table picker
// ---------------------------------------------------------------------------------------------

export function TablePicker({
  open,
  onClose,
  tables,
  openOrders,
  currentTableId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  tables: DiningTable[];
  openOrders: Order[];
  currentTableId: string | null;
  onPick: (t: DiningTable) => void;
}) {
  const { money } = usePos();
  const zones = useMemo(() => {
    const m = new Map<string, DiningTable[]>();
    for (const t of tables) m.set(t.zone, [...(m.get(t.zone) ?? []), t]);
    return [...m.entries()];
  }, [tables]);

  return (
    <Sheet open={open} onClose={onClose} title="Choose a table" wide>
      <div className="space-y-5">
        {zones.map(([zone, list]) => (
          <section key={zone}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{zone}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {list.map((t) => {
                const o = openOrders.find((x) => x.tableId === t.id);
                const current = t.id === currentTableId;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      haptic();
                      onPick(t);
                      onClose();
                    }}
                    className={cx(
                      "flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border p-2 transition active:scale-[0.97]",
                      current ? "border-accent ring-2 ring-accent/40" : "border-line",
                      o ? "bg-accent-soft" : "bg-surface-2 hover:bg-surface-3",
                    )}
                  >
                    <span className="text-xl font-black leading-none">{t.name}</span>
                    <span className="text-[11px] text-muted">{t.seats} seats</span>
                    {o ? <span className="text-xs font-bold tabular text-accent">{money(o.total)}</span> : <span className="text-[11px] font-semibold text-ok">Free</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <p className="text-xs text-muted">Occupied tables open their running check, so new items are added to it.</p>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Customer picker
// ---------------------------------------------------------------------------------------------

export function CustomerPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: Customer) => void }) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Customer[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search box on desktops only; on phones the keyboard would cover the list.
  useEffect(() => {
    if (!open || !window.matchMedia("(pointer: fine)").matches) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setRows(null);
    const t = setTimeout(async () => {
      const r = await callTool<Customer[]>("list_customers", { search: search.trim() || undefined });
      if (alive) setRows(r.ok ? (r.data as Customer[]).slice(0, 30) : []);
    }, search ? 200 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, search]);

  return (
    <Sheet open={open} onClose={onClose} title="Attach customer">
      <div className="space-y-3">
        <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none" />
        {rows === null ? (
          <div className="grid place-items-center py-10">
            <Spinner className="size-5 text-accent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">No customers match. Add new customers from the Customers screen.</div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    haptic();
                    onPick(c);
                    onClose();
                  }}
                  className="flex min-h-14 w-full items-center gap-3 bg-surface px-3 py-2 text-left hover:bg-surface-2"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent">{c.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{c.email ?? c.phone ?? `${c.visits} visits`}</span>
                  </span>
                  <Badge tone={c.points > 0 ? "accent" : "neutral"}>{c.points} pts</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Discount sheet
// ---------------------------------------------------------------------------------------------

const PRESETS = [10, 15, 20];
const REASONS = ["Staff", "Loyalty", "Complaint", "Promo"];

export function DiscountSheet({
  open,
  onClose,
  current,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  current?: Discount;
  onApply: (percent: number, reason: string) => Promise<boolean>;
}) {
  const [percent, setPercent] = useState<number>(10);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPercent(current?.kind === "percent" ? current.value : 10);
    setCustom("");
    setReason(current?.reason ?? "");
  }, [open, current]);

  const effective = custom ? Math.min(100, Math.max(0, Number(custom) || 0)) : percent;
  const valid = effective > 0 && reason.trim().length > 0;

  const submit = async (p: number, r: string) => {
    setBusy(true);
    const ok = await onApply(p, r);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Discount"
      footer={
        <div className="flex gap-2">
          {current ? (
            <Button size="lg" variant="ghost" className="shrink-0" disabled={busy} onClick={() => submit(0, "Removed")}>
              Remove
            </Button>
          ) : null}
          <Button size="lg" variant="primary" className="flex-1" disabled={!valid} loading={busy} onClick={() => submit(effective, reason.trim())}>
            Apply {effective}% off
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Percent off</div>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  haptic(4);
                  setPercent(p);
                  setCustom("");
                }}
                className={cx("h-14 rounded-xl border text-lg font-bold transition", !custom && percent === p ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2")}
              >
                {p}%
              </button>
            ))}
            <div className="relative">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
                inputMode="decimal"
                placeholder="Other"
                aria-label="Custom percent"
                className={cx("h-14 w-full rounded-xl border bg-surface-2 pr-7 text-center text-lg font-bold placeholder:text-sm placeholder:font-medium placeholder:text-muted focus:outline-none", custom ? "border-accent" : "border-line")}
              />
              {custom ? <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-muted">%</span> : null}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Reason (required)</div>
          <div className="mb-2 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} onClick={() => setReason(r)} className={cx("h-9 rounded-full border px-3 text-sm font-semibold", reason === r ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2")}>
                {r}
              </button>
            ))}
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this discount given?" maxLength={120} />
        </div>
        <p className="text-xs text-muted">Large discounts may need a manager&apos;s approval before they apply.</p>
      </div>
    </Sheet>
  );
}
