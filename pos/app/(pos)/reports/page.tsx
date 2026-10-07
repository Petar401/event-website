"use client";

import { useMemo, useState } from "react";
import { tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { Order } from "@/lib/domain/types";
import { groupSales, ordersInRange, rangeBounds, summarize, type RangeKey } from "@/lib/domain/reports";
import { Empty, PageHeader, Segmented, Stat } from "@/components/ui";
import { AreaChart, ChartCard, ColumnChart, Donut, HBars, NoData, OTHER, StackedBar, seriesColor, type Point, type Segment } from "@/components/reports/charts";
import { TildaNoticed } from "@/components/reports/noticed";

const DAY = 86_400_000;
const RANGES: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function ReportsPage() {
  const { snapshot, money } = usePos();
  const [range, setRange] = useState<RangeKey>("today");

  const { data: orders, loading, error } = useLiveData(
    () => tool<Order[]>("list_orders_full", { since: new Date(rangeBounds(range).from.getTime() - DAY).toISOString(), limit: 5000 }),
    [range],
  );

  const report = useMemo(() => {
    if (!orders || !snapshot) return null;
    const now = new Date();
    const ctx = { products: snapshot.products, categories: snapshot.categories, staff: snapshot.staff };
    const rows = (g: Parameters<typeof groupSales>[2]) => groupSales(orders, range, g, ctx, now);
    const summary = summarize(orders, snapshot.products, range, now);

    // Hourly buckets cover trading hours at minimum so the shape is comparable across days.
    const byHour = new Map(rows("hour").map((r) => [Number(r.key), r]));
    const hours = [...byHour.keys()];
    const h0 = Math.min(8, ...hours);
    const h1 = Math.max(18, ...hours);
    const hourly: Point[] = Array.from({ length: h1 - h0 + 1 }, (_, i) => {
      const h = h0 + i;
      const r = byHour.get(h);
      const label = `${String(h).padStart(2, "0")}`;
      return { key: label, label, title: `${label}:00 to ${String(h + 1).padStart(2, "0")}:00`, value: r?.amount ?? 0, detail: plural(r?.orders ?? 0, "order") };
    });

    // Daily buckets are built in local time so late-night orders land on the right day.
    const { from } = rangeBounds(range, now);
    const days = range === "30d" ? 30 : range === "7d" ? 7 : 0;
    const daily: Point[] = [];
    if (days) {
      const buckets = new Map<string, { amount: number; orders: number }>();
      for (const o of ordersInRange(orders, range, now)) {
        const k = localKey(new Date(o.closedAt ?? o.createdAt));
        const b = buckets.get(k) ?? { amount: 0, orders: 0 };
        b.amount += o.total;
        b.orders += 1;
        buckets.set(k, b);
      }
      for (let i = 0; i < days; i++) {
        const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
        const b = buckets.get(localKey(d));
        daily.push({
          key: localKey(d),
          label: days === 7 ? d.toLocaleDateString(undefined, { weekday: "short" }) : d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
          title: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }),
          value: b?.amount ?? 0,
          detail: plural(b?.orders ?? 0, "order"),
        });
      }
    }

    const categories = rows("category");
    const catTop = categories.slice(0, 5);
    const catRest = categories.slice(5).reduce((s, r) => s + r.amount, 0);
    const catSegments: Segment[] = [...catTop.map((r) => ({ key: r.key, label: r.label, value: r.amount, color: "" })), ...(catRest > 0 ? [{ key: "other", label: "Other", value: catRest, color: OTHER }] : [])];
    catSegments.forEach((s, i) => {
      if (s.key !== "other") s.color = seriesColor(i, catSegments.length);
    });

    const tenders = rows("tender");
    const tenderSegments: Segment[] = tenders.map((r, i) => ({ key: r.key, label: r.label, value: r.amount, color: seriesColor(i, tenders.length), detail: plural(r.orders, "payment") }));

    const channels = rows("channel");
    const register = channels.filter((c) => !c.key.startsWith("agent:"));
    const agents = channels.filter((c) => c.key.startsWith("agent:"));
    const registerAmt = register.reduce((s, r) => s + r.amount, 0);
    const agentAmt = agents.reduce((s, r) => s + r.amount, 0);
    const channelSegments: Segment[] = [
      { key: "register", label: "Register", value: registerAmt, color: "var(--accent)", detail: plural(register.reduce((s, r) => s + r.orders, 0), "order") },
      { key: "agents", label: "AI agents", value: agentAmt, color: "var(--ai)", detail: plural(agents.reduce((s, r) => s + r.orders, 0), "order") },
    ];

    return { summary, hourly, daily, items: rows("item").slice(0, 8), catSegments, tenderSegments, channelSegments, agents, staff: rows("staff") };
  }, [orders, snapshot, range]);

  const axis = useMemo(() => {
    const fmt = new Intl.NumberFormat(snapshot?.settings.locale ?? "en-IE", { style: "currency", currency: snapshot?.settings.currency ?? "EUR", maximumFractionDigits: 0, notation: "compact" });
    return (cents: number) => fmt.format(cents / 100);
  }, [snapshot?.settings.locale, snapshot?.settings.currency]);

  const staffColor = useMemo(() => new Map((snapshot?.staff ?? []).map((s) => [s.id, s.color])), [snapshot?.staff]);
  const label = rangeBounds(range).label;
  const s = report?.summary;

  return (
    <div className="mx-auto max-w-7xl pb-6">
      <PageHeader title="Insights" subtitle={`${label} · live, updates as orders come in`} actions={<Segmented value={range} onChange={setRange} options={RANGES} />} />

      <div className="space-y-4 px-4 sm:px-6">
        {error && !orders ? <Empty icon="⚠️" title="Couldn't load sales">{error}</Empty> : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {loading && !report ? (
            Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-line bg-surface" />)
          ) : s ? (
            <>
              <Stat label="Net sales" value={money(s.net)} hint={s.refunds || s.discounts ? `${money(s.discounts + s.refunds)} discounts and refunds` : `${plural(s.items, "item")} sold`} />
              <Stat label="Orders" value={s.orders} hint={`${plural(s.items, "item")} sold`} />
              <Stat label="Avg ticket" value={money(s.avgTicket)} hint={s.orders ? `${(s.items / s.orders).toFixed(1)} items per order` : undefined} />
              <Stat label="Tips" value={money(s.tips)} hint={s.net > 0 ? `${((s.tips / s.net) * 100).toFixed(1)}% of net sales` : undefined} />
              <Stat label="Gross margin" value={money(s.margin)} tone={s.margin > 0 ? "ok" : undefined} hint={s.net > 0 ? `${Math.round((s.margin / s.net) * 100)}% of net sales, after VAT and cost` : undefined} />
              <Stat label="AI-agent orders" value={s.agentOrders} tone="ai" hint={`${s.orders ? Math.round((s.agentOrders / s.orders) * 100) : 0}% of orders · ${money(s.agentSales)}`} />
            </>
          ) : null}
        </div>

        <TildaNoticed />

        {report && s && s.orders === 0 ? <Empty icon="📊" title={`No sales ${range === "today" ? "yet today" : "in this period"}`}>Charts fill in as soon as the first order is paid.</Empty> : null}

        {report && s && s.orders > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <ChartCard title="Sales by hour" subtitle="Order totals by the hour they were paid" className="lg:col-span-2">
              <ColumnChart data={report.hourly} format={money} fmtAxis={axis} ariaLabel={`Sales by hour, ${label}`} />
            </ChartCard>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:grid-cols-1">
              <ChartCard title="Channel mix" subtitle="Register vs AI agents">
                <StackedBar segments={report.channelSegments} format={money} ariaLabel="Sales by channel" />
                {report.agents.length > 0 ? <p className="mt-3 text-xs text-muted">{report.agents.map((a) => `${a.label}: ${plural(a.orders, "order")}`).join(" · ")}</p> : null}
              </ChartCard>
              <ChartCard title="Tender mix" subtitle="How customers paid">
                {report.tenderSegments.length ? <StackedBar segments={report.tenderSegments} format={money} ariaLabel="Payments by tender" /> : <NoData />}
              </ChartCard>
            </div>

            {report.daily.length > 0 ? (
              <ChartCard title="Sales by day" subtitle={`Daily order totals, ${label.toLowerCase()}`} className="lg:col-span-2 xl:col-span-3">
                <AreaChart data={report.daily} format={money} fmtAxis={axis} ariaLabel={`Sales by day, ${label}`} />
              </ChartCard>
            ) : null}

            <ChartCard title="Top items" subtitle="Best sellers by revenue">
              {report.items.length ? (
                <HBars
                  ariaLabel="Top items by revenue"
                  rows={report.items.map((r) => ({ key: r.key, label: r.label, value: r.amount, valueLabel: money(r.amount), sub: `${r.qty} sold` }))}
                />
              ) : (
                <NoData />
              )}
            </ChartCard>

            <ChartCard title="Category mix" subtitle="Share of revenue">
              {report.catSegments.length ? <Donut segments={report.catSegments} format={money} ariaLabel="Sales by category" center={{ label: "Total", value: money(report.catSegments.reduce((a, c) => a + c.value, 0)) }} /> : <NoData />}
            </ChartCard>

            <ChartCard title="Staff leaderboard" subtitle="Sales rung up per person" className="lg:col-span-2 xl:col-span-1">
              {report.staff.length ? (
                <HBars
                  ariaLabel="Sales by staff member"
                  rows={report.staff.map((r) => ({
                    key: r.key,
                    label: r.label,
                    value: r.amount,
                    valueLabel: money(r.amount),
                    sub: `${plural(r.orders, "order")} · avg ${money(r.orders ? Math.round(r.amount / r.orders) : 0)}`,
                    color: staffColor.get(r.key),
                  }))}
                />
              ) : (
                <NoData />
              )}
            </ChartCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
