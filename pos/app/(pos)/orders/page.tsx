"use client";

import { useEffect, useMemo, useState } from "react";
import { tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { Customer, Order } from "@/lib/domain/types";
import { Card, Empty, Input, PageHeader, Segmented, Sheet } from "@/components/ui";
import { dayLabel } from "@/components/orders/format";
import { OrderDetail } from "@/components/orders/order-detail";
import { OrderRow } from "@/components/orders/order-row";
import { useIsDesktop } from "@/components/orders/use-media-query";

type Filter = "all" | "open" | "paid" | "refunded";

const matchesFilter = (o: Order, f: Filter) =>
  f === "all" || (f === "open" && o.status === "open") || (f === "paid" && o.status === "paid") || (f === "refunded" && (o.status === "refunded" || o.status === "partially_refunded"));

export default function OrdersPage() {
  const { snapshot, money } = usePos();
  const isDesktop = useIsDesktop();
  const { data: orders, loading, error, reload } = useLiveData(() => tool<Order[]>("list_orders_full", { limit: 300 }));
  const { data: customers } = useLiveData(() => tool<Customer[]>("list_customers", {}));

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const locale = snapshot?.settings.locale ?? "en-IE";
  const customerName = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c.name])), [customers]);
  const tableName = useMemo(() => new Map((snapshot?.tables ?? []).map((t) => [t.id, t.name])), [snapshot?.tables]);

  // Deep link: /orders?order=<id or number> (used by the customer panel).
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("order");
    if (ref) setSelectedId(ref);
  }, []);

  const counts = useMemo(() => {
    const all = orders ?? [];
    return {
      all: all.length,
      open: all.filter((o) => matchesFilter(o, "open")).length,
      paid: all.filter((o) => matchesFilter(o, "paid")).length,
      refunded: all.filter((o) => matchesFilter(o, "refunded")).length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return (orders ?? []).filter((o) => {
      if (!matchesFilter(o, filter)) return false;
      if (!q) return true;
      const name = o.customerId ? (customerName.get(o.customerId) ?? "") : "";
      return String(o.number).includes(q) || name.toLowerCase().includes(q);
    });
  }, [orders, filter, query, customerName]);

  const groups = useMemo(() => {
    const out: { label: string; orders: Order[] }[] = [];
    for (const o of filtered) {
      const label = dayLabel(o.createdAt, locale);
      const last = out[out.length - 1];
      if (last?.label === label) last.orders.push(o);
      else out.push({ label, orders: [o] });
    }
    return out;
  }, [filtered, locale]);

  const selected = useMemo(() => (selectedId ? ((orders ?? []).find((o) => o.id === selectedId || String(o.number) === selectedId.replace(/^#/, "")) ?? null) : null), [orders, selectedId]);

  const detail = selected ? <OrderDetail key={selected.id} order={selected} customerName={selected.customerId ? (customerName.get(selected.customerId) ?? null) : null} onChanged={reload} /> : null;

  return (
    <div>
      <PageHeader title="Orders" subtitle={orders ? `${counts.all} recent orders · ${counts.open} open` : "Loading…"} />

      <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:px-6">
        <Segmented
          value={filter}
          onChange={setFilter}
          className="self-start [&>button]:h-10"
          options={[
            { value: "all", label: "All" },
            { value: "open", label: `Open${counts.open ? ` · ${counts.open}` : ""}` },
            { value: "paid", label: "Paid" },
            { value: "refunded", label: "Refunded" },
          ]}
        />
        <div className="sm:ml-auto sm:w-72">
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search # or customer…" aria-label="Search orders" />
        </div>
      </div>

      {error && !orders ? (
        <Empty icon="⚠️" title="Couldn't load orders">
          {error}
        </Empty>
      ) : (
        <div className="px-4 pb-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <div className="space-y-5 lg:max-h-[calc(100dvh-12.5rem)] lg:overflow-y-auto lg:pr-1">
            {loading && !orders
              ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-surface-2" />)
              : null}
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="sticky top-0 z-10 -mx-1 mb-2 bg-bg/90 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur">{g.label}</h2>
                <div className="space-y-2">
                  {g.orders.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      selected={selected?.id === o.id}
                      locale={locale}
                      tableName={o.tableId ? (tableName.get(o.tableId) ?? null) : null}
                      customerName={o.customerId ? (customerName.get(o.customerId) ?? null) : null}
                      money={money}
                      onSelect={() => setSelectedId(o.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {orders && groups.length === 0 ? (
              <Empty icon="🧾" title={query ? "No matching orders" : "No orders here yet"}>
                {query ? "Try an order number or a customer's name." : "Orders will show up here as soon as they're created."}
              </Empty>
            ) : null}
          </div>

          {isDesktop ? (
            <Card className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto">
              {detail ?? (
                <Empty icon="👈" title="Select an order">
                  Pick an order from the list to see its items, payments and refunds.
                </Empty>
              )}
            </Card>
          ) : null}
        </div>
      )}

      {!isDesktop ? (
        <Sheet open={Boolean(selected)} onClose={() => setSelectedId(null)} title="Order details">
          <div className="-mx-5 -my-4">{detail}</div>
        </Sheet>
      ) : null}
    </div>
  );
}
