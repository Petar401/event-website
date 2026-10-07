"use client";

import { useMemo } from "react";
import Link from "next/link";
import { tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { Customer, Order } from "@/lib/domain/types";
import { Badge, Spinner, timeAgo } from "@/components/ui";
import { formatDateTime, itemSummary, STATUS_META } from "@/components/orders/format";
import { CustomerAvatar } from "./customer-avatar";
import { tagTone } from "./customer-row";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold tabular">{value}</div>
      {hint ? <div className="text-xs text-muted tabular">{hint}</div> : null}
    </div>
  );
}

interface Favourite {
  key: string;
  name: string;
  emoji: string;
  qty: number;
}

function favouritesFrom(orders: Order[]): Favourite[] {
  const map = new Map<string, Favourite>();
  for (const o of orders) {
    if (o.status === "void") continue;
    for (const l of o.lines) {
      const qty = l.qty - l.refundedQty;
      if (qty <= 0) continue;
      const cur = map.get(l.productId);
      if (cur) cur.qty += qty;
      else map.set(l.productId, { key: l.productId, name: l.name, emoji: l.emoji, qty });
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
}

export function CustomerDetail({ customer }: { customer: Customer }) {
  const { snapshot, money } = usePos();
  const locale = snapshot?.settings.locale ?? "en-IE";
  const pointValue = snapshot?.settings.pointValue ?? 0;
  const { data: orders, loading } = useLiveData(() => tool<Order[]>("list_orders_full", { customer_id: customer.id, limit: 100 }), [customer.id]);
  const favourites = useMemo(() => favouritesFrom(orders ?? []), [orders]);
  const recent = (orders ?? []).slice(0, 5);
  const phoneHref = customer.phone ? `tel:${customer.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <div>
      <div className="flex items-center gap-4 px-5 pb-4 pt-5">
        <CustomerAvatar name={customer.name} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold tracking-tight">{customer.name}</h2>
          <div className="text-sm text-muted">
            Customer since {new Date(customer.createdAt).toLocaleDateString(locale, { month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <Metric label="Lifetime spend" value={money(customer.totalSpent)} />
        <Metric label="Visits" value={customer.visits} hint={customer.lastVisitAt ? `Last ${timeAgo(customer.lastVisitAt)}` : "No visits yet"} />
        <Metric label="Loyalty points" value={customer.points} hint={`Worth ${money(customer.points * pointValue)}`} />
        <Metric label="Avg. spend / visit" value={customer.visits > 0 ? money(Math.round(customer.totalSpent / customer.visits)) : "—"} />
      </div>

      <Section title="Contact">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Email</dt>
            <dd className="min-w-0 truncate font-semibold">
              {customer.email ? (
                <a className="text-accent hover:underline" href={`mailto:${encodeURIComponent(customer.email)}`}>
                  {customer.email}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Phone</dt>
            <dd className="min-w-0 truncate font-semibold">
              {phoneHref ? (
                <a className="text-accent hover:underline" href={phoneHref}>
                  {customer.phone}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </Section>

      {customer.tags.length > 0 || customer.note ? (
        <Section title="Notes & tags">
          {customer.tags.length > 0 ? (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {customer.tags.map((t) => (
                <Badge key={t} tone={tagTone(t)}>
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}
          {/* Customer-supplied text: rendered as plain text, never as HTML. */}
          {customer.note ? <p className="whitespace-pre-wrap break-words rounded-xl bg-warn-soft px-3 py-2 text-sm text-ink">{customer.note}</p> : null}
        </Section>
      ) : null}

      <Section title="Favourites">
        {loading && !orders ? (
          <Spinner className="text-muted" />
        ) : favourites.length === 0 ? (
          <p className="text-sm text-muted">No orders yet, so no favourites to show.</p>
        ) : (
          <ul className="space-y-2">
            {favourites.map((f) => (
              <li key={f.key} className="flex items-center gap-3 text-sm">
                <span className="text-xl" aria-hidden>
                  {f.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                <span className="text-muted tabular">{f.qty}×</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent orders">
        {loading && !orders ? (
          <Spinner className="text-muted" />
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted">No orders linked to this customer yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href={`/orders?order=${o.id}`} className="flex min-h-14 items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 transition hover:bg-surface-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="font-bold tabular">#{o.number}</span>
                      <span className="text-xs text-muted tabular">{formatDateTime(o.createdAt, locale)}</span>
                    </div>
                    <div className="truncate text-xs text-ink-2">{itemSummary(o.lines)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular">{money(o.total)}</div>
                    <Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
