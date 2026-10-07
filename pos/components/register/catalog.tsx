"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Product } from "@/lib/domain/types";
import { haptic } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { cx } from "../ui";

interface CatalogProps {
  products: Product[];
  categories: Category[];
  cartQty: Map<string, number>;
  /** Tap on a tile. */
  onPick: (p: Product) => void;
  /** Scanner / quick-enter add: no modifier sheet. */
  onScan: (p: Product) => void;
}

export function Catalog({ products, categories, cartQty, onPick, onScan }: CatalogProps) {
  const { toast } = usePos();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search box (desktop keyboards).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sortedCats = useMemo(() => [...categories].sort((a, b) => a.sort - b.sort), [categories]);
  const q = search.trim().toLowerCase();

  const visible = useMemo(() => {
    return products.filter((p) => {
      if (cat !== "all" && p.categoryId !== cat) return false;
      if (!q) return true;
      return [p.name, p.sku, p.barcode, p.description].some((v) => v?.toLowerCase().includes(q));
    });
  }, [products, cat, q]);

  const sections = useMemo(() => {
    if (q || cat !== "all") return [{ id: "flat", title: null as string | null, items: visible }];
    return sortedCats
      .map((c) => ({ id: c.id, title: `${c.emoji} ${c.name}`, items: visible.filter((p) => p.categoryId === c.id) }))
      .filter((s) => s.items.length > 0);
  }, [visible, sortedCats, q, cat]);

  const onEnter = () => {
    const raw = search.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    const exact = products.find((p) => p.barcode === raw || p.sku.toLowerCase() === lower);
    const target = exact ?? (visible.length === 1 ? visible[0] : undefined);
    if (!target) {
      toast({ title: "No match", body: `Nothing found for “${raw}”.`, tone: "warn" });
      return;
    }
    if (!target.available) {
      toast({ title: `${target.name} is 86'd`, body: "Not available right now.", tone: "warn" });
    } else {
      onScan(target);
      toast({ title: `Added ${target.name}`, tone: "ok" });
    }
    setSearch("");
  };

  return (
    <div>
      <div className="sticky top-[calc(47px+env(safe-area-inset-top))] z-20 border-b border-line bg-bg/92 px-4 pb-3 pt-3 backdrop-blur md:top-0 md:px-5 md:pt-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
            ⌕
          </span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onEnter()}
            placeholder="Search or scan barcode…"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-line bg-surface pl-9 pr-16 text-base text-ink shadow-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
          {search ? (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Clear search">
              ✕
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-surface-2 px-1.5 text-xs font-semibold text-muted md:block">/</kbd>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:-mx-5 md:px-5">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            All
          </Chip>
          {sortedCats.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              <span aria-hidden>{c.emoji}</span> {c.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-4 pb-6 pt-4 md:px-5">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="text-4xl">🔎</div>
            <div className="font-semibold">Nothing matches “{search}”</div>
            <div className="text-sm text-muted">Try a shorter name, or scan the barcode.</div>
          </div>
        ) : null}
        {sections.map((s) => (
          <section key={s.id}>
            {s.title ? <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{s.title}</h2> : null}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {s.items.map((p) => (
                <Tile key={p.id} product={p} inCart={cartQty.get(p.id) ?? 0} onPick={onPick} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        haptic(4);
        onClick();
      }}
      className={cx(
        "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition",
        active ? "border-accent bg-accent text-accent-ink shadow-sm" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function Tile({ product: p, inCart, onPick }: { product: Product; inCart: number; onPick: (p: Product) => void }) {
  const low = p.trackStock && p.available && p.stock <= p.parLevel;
  return (
    <button
      disabled={!p.available}
      onClick={(e) => {
        e.currentTarget.animate([{ transform: "scale(0.94)" }, { transform: "scale(1)" }], { duration: 200, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.3)" });
        onPick(p);
      }}
      className={cx(
        "group relative flex min-h-[136px] flex-col overflow-hidden rounded-2xl border border-line bg-surface p-3 pt-4 text-left shadow-card transition",
        p.available ? "hover:border-accent/50 active:scale-[0.98]" : "cursor-not-allowed",
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} aria-hidden />
      <div className={cx("flex items-start justify-between", !p.available && "opacity-40 grayscale")}>
        <span className="text-4xl leading-none" aria-hidden>
          {p.emoji}
        </span>
        {inCart > 0 ? <span className="grid min-w-6 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-ink animate-pop">{inCart}</span> : null}
      </div>
      <div className={cx("mt-auto pt-3", !p.available && "opacity-50")}>
        <div className="line-clamp-2 text-sm font-semibold leading-tight">{p.name}</div>
        <div className="mt-1 flex items-center justify-between gap-1">
          <PriceTag cents={p.price} />
          {low ? <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-bold text-warn">{p.stock} left</span> : null}
        </div>
      </div>
      {!p.available ? (
        <span className="absolute -right-8 top-4 rotate-45 bg-bad px-9 py-0.5 text-[11px] font-bold tracking-wide text-white shadow-sm">86&apos;d</span>
      ) : null}
    </button>
  );
}

function PriceTag({ cents }: { cents: number }) {
  const { money } = usePos();
  return <span className="text-sm font-bold tabular text-ink-2">{money(cents)}</span>;
}
