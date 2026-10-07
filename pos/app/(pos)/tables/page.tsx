"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePos } from "@/lib/client/pos-context";
import { Badge, Button, Card, Empty, PageHeader, Spinner, Stat } from "@/components/ui";
import { Floor } from "@/components/tables/floor";
import { TableListCard } from "@/components/tables/table-card";
import { duration, tableInfo, type TableInfo } from "@/components/tables/table-info";

export default function TablesPage() {
  const { snapshot, money } = usePos();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  // Re-render timers every 30 seconds.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const open = (i: TableInfo) => router.push(i.order ? `/?order=${i.order.id}` : `/?table=${i.table.id}`);

  const infos = useMemo(() => (snapshot ? snapshot.tables.map((t) => tableInfo(t, snapshot.openOrders, now)) : []), [snapshot, now]);
  const zones = useMemo(() => {
    const m = new Map<string, TableInfo[]>();
    for (const i of infos) m.set(i.table.zone, [...(m.get(i.table.zone) ?? []), i]);
    return [...m.entries()];
  }, [infos]);

  if (!snapshot) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }

  const occupied = infos.filter((i) => i.order);
  const covers = occupied.reduce((s, i) => s + i.table.seats, 0);
  const checks = snapshot.openOrders.reduce((s, o) => s + o.total, 0);
  const avg = occupied.length ? Math.round(occupied.reduce((s, i) => s + i.minutes, 0) / occupied.length) : 0;
  const takeaway = snapshot.openOrders.filter((o) => !o.tableId);

  return (
    <div className="pb-6">
      <PageHeader
        title="Tables"
        subtitle={`${occupied.length} of ${infos.length} tables occupied`}
        actions={
          <Button variant="primary" onClick={() => router.push("/")}>
            + Takeaway order
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-4 sm:px-6 lg:grid-cols-4">
        <Stat label="Covers seated" value={covers} hint={`${infos.length - occupied.length} tables free`} />
        <Stat label="Open checks" value={money(checks)} hint={`${snapshot.openOrders.length} open order${snapshot.openOrders.length === 1 ? "" : "s"}`} />
        <Stat label="Avg. time seated" value={occupied.length ? duration(avg) : "—"} hint="across occupied tables" />
        <Stat
          label="Ready to serve"
          value={occupied.filter((i) => i.kitchen?.label === "Ready to serve").length}
          tone="ok"
          hint="tables waiting on a runner"
        />
      </div>

      {infos.length === 0 ? (
        <Card className="mx-4 mt-4 sm:mx-6">
          <Empty icon="🪑" title="No tables yet">Tables set up for this venue show up here.</Empty>
        </Card>
      ) : (
        <>
          {/* Floor plan (tablet / desktop) */}
          <div className="mt-4 hidden px-6 md:block">
            <Floor tables={snapshot.tables} orders={snapshot.openOrders} now={now} onOpen={open} />
          </div>

          {/* Grouped list (phone) */}
          <div className="mt-4 space-y-5 px-4 md:hidden">
            {zones.map(([zone, list]) => (
              <section key={zone}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                  {zone}
                  <Badge>{list.filter((i) => i.order).length}/{list.length}</Badge>
                </h2>
                <div className="grid gap-2.5">
                  {list.map((i) => (
                    <TableListCard key={i.table.id} info={i} onOpen={open} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {takeaway.length > 0 ? (
        <section className="mt-6 px-4 sm:px-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Open takeaway & tabs</h2>
          <div className="flex flex-wrap gap-2">
            {takeaway.map((o) => (
              <button key={o.id} onClick={() => router.push(`/?order=${o.id}`)} className="flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold shadow-card hover:bg-surface-2">
                🥡 #{o.number} <span className="tabular text-accent">{money(o.total)}</span>
                {o.channel.startsWith("agent:") ? <Badge tone="ai">AI</Badge> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 px-4 text-xs text-muted sm:px-6">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded border-2 border-line bg-surface" /> Free</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded border-2 border-accent/50 bg-accent-soft" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded border-2 border-ok/60 bg-ok-soft" /> Ready to serve</span>
        <span className="flex items-center gap-1.5"><span className="grid size-3.5 place-items-center rounded-full bg-ai text-[8px] font-bold text-white">✦</span> Started by an AI agent</span>
      </div>
    </div>
  );
}
