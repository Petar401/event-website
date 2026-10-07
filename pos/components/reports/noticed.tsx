"use client";

import Link from "next/link";
import { tool } from "@/lib/client/api";
import { useLiveData } from "@/lib/client/pos-context";
import { Badge } from "@/components/ui";

interface Insights {
  today: { orders: number; net_sales: string; average_ticket: string };
  last_7_days: { orders: number; net_sales: string; daily_average: string };
  anomalies: { severity: "info" | "warn"; title: string; detail: string }[];
  stock_alerts: { item: string; stock: number; par: number; days_of_cover: number | null; suggested_reorder: number; supplier?: string }[];
  pending_approvals: { id: string; summary: string; requested_by: string }[];
}

function InsightCard({ title, children, badge }: { title: React.ReactNode; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-ai/20 bg-ai-soft p-3.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ai text-xs text-white" aria-hidden>
        ✦
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-ink">{title}</div>
          {badge}
        </div>
        <div className="mt-0.5 text-sm text-ink-2">{children}</div>
      </div>
    </div>
  );
}

/** "Tilda noticed": anomalies, low-stock alerts and pending approvals from the business_insights tool. */
export function TildaNoticed() {
  const { data, loading } = useLiveData(() => tool<Insights>("business_insights", {}));

  const stock = data?.stock_alerts ?? [];
  const anomalies = data?.anomalies ?? [];
  const approvals = data?.pending_approvals ?? [];
  const nothing = !!data && !stock.length && !anomalies.length && !approvals.length;

  return (
    <section aria-label="Tilda noticed" className="rounded-3xl border border-ai/25 bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
          <span className="text-ai" aria-hidden>
            ✦
          </span>
          Tilda noticed
        </h2>
        {data ? (
          <span className="text-xs text-muted tabular">
            Today {data.today.net_sales} · {data.today.orders} orders · 7-day average {data.last_7_days.daily_average}/day
          </span>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-ai-soft" />
          ))}
        </div>
      ) : nothing ? (
        <InsightCard title="All quiet">Nothing unusual to flag: stock is healthy, no odd refund or discount patterns and no approvals waiting.</InsightCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {approvals.length > 0 ? (
            <InsightCard title={`${approvals.length} approval${approvals.length === 1 ? "" : "s"} waiting`} badge={<Badge tone="warn">Needs a manager</Badge>}>
              {approvals[0].summary}
              {approvals.length > 1 ? ` and ${approvals.length - 1} more.` : ""}{" "}
              <Link href="/ai" className="font-semibold text-ai underline-offset-2 hover:underline">
                Review in AI Hub
              </Link>
            </InsightCard>
          ) : null}
          {anomalies.map((a) => (
            <InsightCard key={a.title} title={a.title} badge={<Badge tone={a.severity === "warn" ? "warn" : "neutral"}>{a.severity === "warn" ? "Check" : "FYI"}</Badge>}>
              {a.detail}
            </InsightCard>
          ))}
          {stock.slice(0, 6).map((s) => (
            <InsightCard key={s.item} title={`${s.item} is ${s.stock <= 0 ? "out" : "running low"}`} badge={<Badge tone={s.stock <= 0 ? "bad" : "warn"}>{s.stock} left</Badge>}>
              Par is {s.par}
              {s.days_of_cover !== null ? `, about ${s.days_of_cover} days of cover` : ""}.
              {s.suggested_reorder > 0 ? ` Reorder ${s.suggested_reorder}${s.supplier ? ` from ${s.supplier}` : ""}.` : ""}
            </InsightCard>
          ))}
          {stock.length > 6 ? (
            <InsightCard title={`${stock.length - 6} more items below par`}>
              <Link href="/inventory" className="font-semibold text-ai underline-offset-2 hover:underline">
                Open inventory
              </Link>
            </InsightCard>
          ) : null}
        </div>
      )}
    </section>
  );
}
