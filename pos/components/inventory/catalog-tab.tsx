"use client";

import { useMemo, useState } from "react";
import { newKey } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { toCents } from "@/lib/domain/money";
import type { Category, Product } from "@/lib/domain/types";
import { Badge, Button, Card, Empty, Field, Input, Sheet, Spinner, cx } from "@/components/ui";
import { act } from "./act";
import { Toggle } from "./toggle";

/** Margin on the VAT-exclusive price, matching how Insights computes gross margin. */
function marginPct(price: number, cost: number, taxRate: number): number | null {
  const net = price / (1 + taxRate);
  return net > 0 ? Math.round(((net - cost) / net) * 100) : null;
}

function marginTone(m: number | null): "ok" | "warn" | "bad" | "neutral" {
  if (m === null) return "neutral";
  return m >= 60 ? "ok" : m >= 40 ? "warn" : "bad";
}

export function CatalogTab({ canManage }: { canManage: boolean }) {
  const { snapshot, money, toast, refreshSnapshot } = usePos();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    const match = (p: Product) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").includes(q);
    const byCat = new Map<string, Product[]>();
    for (const p of snapshot.products) if (match(p)) byCat.set(p.categoryId, [...(byCat.get(p.categoryId) ?? []), p]);
    return [...snapshot.categories]
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({ category: c, products: (byCat.get(c.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)) }))
      .filter((g) => g.products.length > 0);
  }, [snapshot, query]);

  if (!snapshot) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }

  const toggle = async (p: Product) => {
    setBusy(p.id);
    const r = await act(toast, "set_availability", { product: p.id, available: !p.available }, { success: () => ({ title: p.available ? `${p.name} is 86'd` : `${p.name} is back on` }) });
    setBusy(null);
    if (r) void refreshSnapshot();
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Search name, SKU or barcode" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search catalog" className="sm:max-w-xs" />

      {groups.length === 0 ? (
        <Card>
          <Empty icon="🔎" title="No products found">Try a different name, SKU or barcode.</Empty>
        </Card>
      ) : null}

      {groups.map(({ category, products }) => (
        <CategorySection key={category.id} category={category} count={products.length}>
          {products.map((p) => {
            const m = marginPct(p.price, p.cost, category.taxRate);
            return (
              <div key={p.id} className={cx("flex items-center gap-3 p-3", !p.available && "bg-surface-2/60")}>
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-2xl" aria-hidden>
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    {!p.available ? <Badge tone="neutral">86&apos;d</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {p.sku}
                    {p.barcode ? ` · ${p.barcode}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted sm:hidden">
                    <span>Cost {money(p.cost)}</span>
                    <Badge tone={marginTone(m)}>{m === null ? "n/a" : `${m}%`} margin</Badge>
                  </div>
                </div>
                <div className="hidden w-20 text-right text-sm text-muted tabular sm:block">
                  <div className="text-[11px] uppercase tracking-wide">Cost</div>
                  {money(p.cost)}
                </div>
                <div className="hidden w-20 justify-end sm:flex">
                  <Badge tone={marginTone(m)}>{m === null ? "n/a" : `${m}%`}</Badge>
                </div>
                {canManage ? (
                  <button
                    onClick={() => setEditing(p)}
                    className="min-h-11 min-w-[4.5rem] rounded-xl border border-line bg-surface-2 px-3 text-right text-sm font-bold tabular transition hover:bg-surface-3 active:scale-95"
                    aria-label={`Edit price of ${p.name}, currently ${money(p.price)}`}
                  >
                    {money(p.price)}
                  </button>
                ) : (
                  <div className="min-w-[4.5rem] text-right text-sm font-bold tabular">{money(p.price)}</div>
                )}
                <Toggle checked={p.available} disabled={busy === p.id} onChange={() => toggle(p)} label={`${p.name} available`} />
              </div>
            );
          })}
        </CategorySection>
      ))}

      <PriceSheet
        product={editing}
        taxRate={snapshot.categories.find((c) => c.id === editing?.categoryId)?.taxRate ?? 0}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function CategorySection({ category, count, children }: { category: Category; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={category.name}>
      <h2 className="mb-2 px-1 text-sm font-bold">
        <span aria-hidden>{category.emoji}</span> {category.name} <span className="font-medium text-muted">· {count}</span>
      </h2>
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
    </section>
  );
}

function PriceSheet({ product, taxRate, onClose }: { product: Product | null; taxRate: number; onClose: () => void }) {
  const { money, toast, refreshSnapshot } = usePos();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);

  // Reset the field whenever a different product opens.
  if (product && seen !== product.id) {
    setSeen(product.id);
    setValue((product.price / 100).toFixed(2));
  }
  if (!product && seen !== null) setSeen(null);

  if (!product) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const cents = toCents(value);
  const m = marginPct(cents, product.cost, taxRate);
  const changed = cents !== product.price && cents > 0;

  const save = async () => {
    setBusy(true);
    const r = await act<{ product: string; from: string; to: string }>(
      toast,
      "update_price",
      { product: product.id, price_cents: cents, idempotency_key: newKey() },
      { success: (d) => ({ title: `${d.product} price updated`, body: `${d.from} → ${d.to}` }) },
    );
    setBusy(false);
    if (r) {
      void refreshSnapshot();
      onClose();
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>{product.emoji}</span> {product.name}
        </span>
      }
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={!changed} loading={busy} onClick={save}>
          {changed ? `Save ${money(cents)}` : "Change the price to save"}
        </Button>
      }
    >
      <Field label="Price (VAT included)">
        <Input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus className="text-xl font-bold tabular" />
      </Field>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Was</div>
          <div className="font-bold tabular">{money(product.price)}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Cost</div>
          <div className="font-bold tabular">{money(product.cost)}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Margin</div>
          <div className={cx("font-bold tabular", m !== null && m < 40 && "text-bad", m !== null && m >= 60 && "text-ok")}>{m === null ? "n/a" : `${m}%`}</div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Margin is calculated on the price without VAT. Price changes made by AI agents need manager approval.</p>
    </Sheet>
  );
}
