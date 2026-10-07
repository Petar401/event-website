"use client";

import { useMemo, useState } from "react";
import { newKey, tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { StockInsight } from "@/lib/domain/reports";
import { Badge, Button, Card, Empty, Input, Segmented, Spinner, cx } from "@/components/ui";
import { act } from "./act";
import { AdjustSheet, type AdjustTarget } from "./adjust-sheet";

const NO_SUPPLIER = "No supplier";
const COVER_CAP_DAYS = 14;

const statusMeta: Record<StockInsight["status"], { label: string; tone: "bad" | "warn" | "ok"; bar: string }> = {
  out: { label: "Out", tone: "bad", bar: "bg-bad" },
  low: { label: "Low", tone: "warn", bar: "bg-warn" },
  ok: { label: "OK", tone: "ok", bar: "bg-ok" },
};

type Filter = "all" | "attention";

export function StockTab({ canManage }: { canManage: boolean }) {
  const { snapshot, money, toast, refreshSnapshot } = usePos();
  const { data, loading, error, reload } = useLiveData(() => tool<StockInsight[]>("inventory_report", {}));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const products = useMemo(() => new Map((snapshot?.products ?? []).map((p) => [p.id, p])), [snapshot?.products]);
  const rows = useMemo(() => data ?? [], [data]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.supplier ?? "").toLowerCase().includes(q));
  const needs = visible.filter((r) => r.suggestedQty > 0);
  const healthy = filter === "attention" ? [] : visible.filter((r) => r.suggestedQty <= 0);

  const costOf = (r: StockInsight) => r.suggestedQty * (products.get(r.productId)?.cost ?? 0);

  // Group reorder candidates by supplier (alphabetical, "no supplier" last).
  const byGroup = new Map<string, StockInsight[]>();
  for (const r of needs) byGroup.set(r.supplier ?? NO_SUPPLIER, [...(byGroup.get(r.supplier ?? NO_SUPPLIER) ?? []), r]);
  const groups = [...byGroup.entries()].sort(([a], [b]) => (a === NO_SUPPLIER ? 1 : b === NO_SUPPLIER ? -1 : a.localeCompare(b)));

  // AI summary uses the whole report, not the search-filtered view.
  const allNeeds = rows.filter((r) => r.suggestedQty > 0);
  const aiSuppliers = new Set(allNeeds.map((r) => r.supplier).filter(Boolean));
  const aiTotal = allNeeds.reduce((s, r) => s + costOf(r), 0);

  const mark = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const draftPo = async (supplier: string, silent = false) => {
    mark(`po:${supplier}`, true);
    const r = await act<{ number: number; supplier: string; total: string }>(
      toast,
      "draft_purchase_order",
      { supplier, idempotency_key: newKey() },
      { success: silent ? undefined : (d) => ({ title: `PO #${d.number} drafted`, body: `${d.supplier} · ${d.total}. Review it in Purchase orders.` }) },
    );
    mark(`po:${supplier}`, false);
    if (r) reload();
    return r;
  };

  const draftAll = async () => {
    mark("po:all", true);
    let made = 0;
    for (const s of aiSuppliers) if (s && (await draftPo(s, true))) made++;
    mark("po:all", false);
    if (made) toast({ tone: "ok", title: `${made} purchase order${made === 1 ? "" : "s"} drafted`, body: "Nothing is sent until you mark it sent." });
  };

  const toggle86 = async (r: StockInsight) => {
    const p = products.get(r.productId);
    if (!p) return;
    mark(r.productId, true);
    const done = await act(toast, "set_availability", { product: r.productId, available: !p.available }, { success: () => ({ title: p.available ? `${p.name} is 86'd` : `${p.name} is back on` }) });
    mark(r.productId, false);
    if (done) void refreshSnapshot();
  };

  if (loading && !data) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }
  if (error && !data) return <Empty icon="⚠️" title="Couldn't load stock">{error}</Empty>;

  const rowProps = (r: StockInsight) => ({
    r,
    available: products.get(r.productId)?.available ?? true,
    canManage,
    busy: busy.has(r.productId),
    onAdjust: () => setAdjusting({ productId: r.productId, name: r.name, emoji: r.emoji, stock: r.stock }),
    onToggle: () => toggle86(r),
  });

  return (
    <div className="space-y-4">
      {allNeeds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-ai/30 bg-ai-soft p-4 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ai text-lg text-white" aria-hidden>
            ✦
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ai">Tilda suggests</div>
            <p className="text-sm text-ink">
              Reorder <b>{allNeeds.length}</b> item{allNeeds.length === 1 ? "" : "s"} from <b>{aiSuppliers.size}</b> supplier{aiSuppliers.size === 1 ? "" : "s"} (<b className="tabular">{money(aiTotal)}</b>), based on the last 14 days of sales.
            </p>
          </div>
          {aiSuppliers.size > 0 ? (
            <Button variant="ai" loading={busy.has("po:all")} onClick={draftAll} className="w-full sm:w-auto">
              Draft {aiSuppliers.size === 1 ? "PO" : "all POs"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok-soft p-4 text-sm text-ok">
          <span aria-hidden className="text-lg">
            ✓
          </span>
          <span className="font-semibold">Everything is above par. Nothing to reorder right now.</span>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input placeholder="Search items or suppliers" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search stock" className="sm:max-w-xs" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All items" },
            { value: "attention", label: `Needs reorder${allNeeds.length ? ` (${allNeeds.length})` : ""}` },
          ]}
        />
      </div>

      {groups.map(([supplier, items]) => {
        const cost = items.reduce((s, r) => s + costOf(r), 0);
        return (
          <section key={supplier} aria-label={`Reorder from ${supplier}`}>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold">
                  🚚 {supplier} <span className="font-medium text-muted">· {items.length} item{items.length === 1 ? "" : "s"} · ≈ {money(cost)}</span>
                </h2>
              </div>
              {supplier !== NO_SUPPLIER ? (
                <Button size="sm" variant="secondary" loading={busy.has(`po:${supplier}`)} onClick={() => draftPo(supplier)}>
                  Draft PO
                </Button>
              ) : null}
            </div>
            <Card className="divide-y divide-line overflow-hidden">
              {items.map((r) => (
                <StockRow key={r.productId} {...rowProps(r)} />
              ))}
            </Card>
          </section>
        );
      })}

      {healthy.length > 0 ? (
        <section aria-label="Healthy stock">
          <h2 className="mb-2 px-1 text-sm font-bold">Healthy stock</h2>
          <Card className="divide-y divide-line overflow-hidden">
            {healthy.map((r) => (
              <StockRow key={r.productId} {...rowProps(r)} />
            ))}
          </Card>
        </section>
      ) : null}

      {visible.length === 0 ? <Empty icon="📦" title={rows.length ? "No matches" : "No tracked items yet"}>{rows.length ? "Try a different search." : "Turn on stock tracking for a product and it shows up here."}</Empty> : null}

      <AdjustSheet target={adjusting} onClose={() => setAdjusting(null)} onDone={reload} />
    </div>
  );
}

function StockRow({ r, available, canManage, busy, onAdjust, onToggle }: { r: StockInsight; available: boolean; canManage: boolean; busy: boolean; onAdjust: () => void; onToggle: () => void }) {
  const meta = statusMeta[r.status];
  // Bar shows days of cover (capped); items with no recent sales fall back to stock versus twice par.
  const cover = r.daysOfCover === null ? Math.min(1, r.stock / Math.max(1, r.parLevel * 2)) : Math.min(1, r.daysOfCover / COVER_CAP_DAYS);
  const coverText = r.daysOfCover === null ? "No recent sales" : r.daysOfCover >= COVER_CAP_DAYS ? `${COVER_CAP_DAYS}+ days cover` : `${r.daysOfCover} days cover`;
  return (
    <div className={cx("flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4", !available && "bg-surface-2/60")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
          {r.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold">{r.name}</span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {!available ? <Badge tone="neutral">86&apos;d</Badge> : null}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            <span className="tabular font-semibold text-ink-2">{r.stock}</span> in stock · par {r.parLevel} · ≈ {r.dailyVelocity.toFixed(1)}/day
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
              role="img"
              aria-label={`${coverText}${r.daysOfCover === null ? "" : ` out of ${COVER_CAP_DAYS} shown`}`}
            >
              <div className={cx("h-full rounded-full transition-all", meta.bar)} style={{ width: `${Math.max(r.stock > 0 ? 4 : 0, cover * 100)}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right text-xs text-muted tabular">{coverText}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        {r.suggestedQty > 0 ? <Badge tone="ai">✦ Reorder {r.suggestedQty}</Badge> : <span />}
        <div className="flex items-center gap-2">
          {canManage ? (
            <Button size="sm" variant="secondary" onClick={onAdjust} className="min-h-11">
              Adjust
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" loading={busy} onClick={onToggle} className="min-h-11" aria-pressed={!available}>
            {available ? "86" : "Un-86"}
          </Button>
        </div>
      </div>
    </div>
  );
}
