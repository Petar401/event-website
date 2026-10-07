"use client";

import { useEffect, useMemo, useState } from "react";
import { tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { Customer } from "@/lib/domain/types";
import { AddCustomerSheet } from "@/components/customers/add-customer-sheet";
import { CustomerDetail } from "@/components/customers/customer-detail";
import { CustomerRow } from "@/components/customers/customer-row";
import { useIsDesktop } from "@/components/orders/use-media-query";
import { Button, Card, Empty, Input, PageHeader, Segmented, Sheet, Stat } from "@/components/ui";

type Sort = "recent" | "name" | "points" | "spend";

const SORTS: Record<Sort, (a: Customer, b: Customer) => number> = {
  recent: (a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? "") || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  points: (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  spend: (a, b) => b.totalSpent - a.totalSpent || a.name.localeCompare(b.name),
};

export default function CustomersPage() {
  const { snapshot, money } = usePos();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Unfiltered list drives the header stats; the searched list only loads while a search term is set.
  const { data: all, loading, error, reload } = useLiveData(() => tool<Customer[]>("list_customers", {}));
  const { data: found } = useLiveData(() => (term ? tool<Customer[]>("list_customers", { search: term }) : Promise.resolve(null)), [term]);

  const customers = term ? found : all;
  const sorted = useMemo(() => [...(customers ?? [])].sort(SORTS[sort]), [customers, sort]);
  const selected = useMemo(() => (all ?? []).find((c) => c.id === selectedId) ?? null, [all, selectedId]);

  const stats = useMemo(() => {
    const list = all ?? [];
    const points = list.reduce((s, c) => s + c.points, 0);
    const visits = list.reduce((s, c) => s + c.visits, 0);
    return { count: list.length, avgVisits: list.length ? visits / list.length : 0, points };
  }, [all]);
  const pointValue = snapshot?.settings.pointValue ?? 0;

  const detail = selected ? <CustomerDetail key={selected.id} customer={selected} /> : null;

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Loyalty, favourites and visit history"
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            + Add customer
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:px-6 lg:grid-cols-3">
        <Stat label="Customers" value={all ? stats.count : "—"} />
        <Stat label="Avg. visits" value={all ? stats.avgVisits.toFixed(1) : "—"} />
        <div className="col-span-2 lg:col-span-1">
          <Stat label="Points outstanding" value={all ? stats.points.toLocaleString(snapshot?.settings.locale) : "—"} hint={all ? `Worth ${money(stats.points * pointValue)} in rewards` : undefined} tone="ai" />
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:px-6">
        <div className="sm:w-80">
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone…" aria-label="Search customers" />
        </div>
        <Segmented
          className="self-start sm:ml-auto [&>button]:h-10"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Recent" },
            { value: "name", label: "Name" },
            { value: "points", label: "Points" },
            { value: "spend", label: "Spend" },
          ]}
        />
      </div>

      {error && !all ? (
        <Empty icon="⚠️" title="Couldn't load customers">
          {error}
        </Empty>
      ) : (
        <div className="px-4 pb-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <div className="space-y-2 lg:max-h-[calc(100dvh-20rem)] lg:overflow-y-auto lg:pr-1">
            {loading && !all ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-surface-2" />) : null}
            {sorted.map((c) => (
              <CustomerRow key={c.id} customer={c} selected={selected?.id === c.id} onSelect={() => setSelectedId(c.id)} />
            ))}
            {customers && sorted.length === 0 ? (
              <Empty icon="☺" title={term ? "No customers found" : "No customers yet"}>
                {term ? "Try a different name, email or phone number." : "Add your first customer to start tracking visits and loyalty points."}
              </Empty>
            ) : null}
          </div>

          {isDesktop ? (
            <Card className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto">
              {detail ?? (
                <Empty icon="👈" title="Select a customer">
                  See their favourites, points and recent orders.
                </Empty>
              )}
            </Card>
          ) : null}
        </div>
      )}

      {!isDesktop ? (
        <Sheet open={Boolean(selected)} onClose={() => setSelectedId(null)} title="Customer">
          <div className="-mx-5 -my-4">{detail}</div>
        </Sheet>
      ) : null}

      {adding ? (
        <AddCustomerSheet
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            setSearch("");
            setTerm("");
            setSelectedId(id);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
