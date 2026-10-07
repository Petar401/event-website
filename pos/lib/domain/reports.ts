import { lineTotal } from "./order";
import type { Category, Order, Product, Staff } from "./types";

export type RangeKey = "today" | "yesterday" | "7d" | "30d";
export type GroupBy = "item" | "category" | "hour" | "day" | "staff" | "tender" | "channel";

export function rangeBounds(range: RangeKey, now = new Date()): { from: Date; to: Date; label: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  switch (range) {
    case "today":
      return { from: start, to: now, label: "Today" };
    case "yesterday":
      return { from: new Date(start.getTime() - day), to: start, label: "Yesterday" };
    case "7d":
      return { from: new Date(start.getTime() - 6 * day), to: now, label: "Last 7 days" };
    case "30d":
      return { from: new Date(start.getTime() - 29 * day), to: now, label: "Last 30 days" };
  }
}

const isSale = (o: Order) => o.status === "paid" || o.status === "refunded" || o.status === "partially_refunded";

export function ordersInRange(orders: Order[], range: RangeKey, now = new Date()): Order[] {
  const { from, to } = rangeBounds(range, now);
  return orders.filter((o) => {
    const t = new Date(o.closedAt ?? o.createdAt).getTime();
    return isSale(o) && t >= from.getTime() && t < to.getTime() + 1;
  });
}

export interface Summary {
  label: string;
  orders: number;
  gross: number;
  discounts: number;
  refunds: number;
  net: number;
  tax: number;
  tips: number;
  avgTicket: number;
  items: number;
  cogs: number;
  margin: number;
  agentOrders: number;
  agentSales: number;
}

export function summarize(orders: Order[], products: Product[], range: RangeKey, now = new Date()): Summary {
  const inRange = ordersInRange(orders, range, now);
  const costOf = new Map(products.map((p) => [p.id, p.cost]));
  let gross = 0,
    discounts = 0,
    refunds = 0,
    tax = 0,
    tips = 0,
    items = 0,
    cogs = 0,
    agentOrders = 0,
    agentSales = 0;
  for (const o of inRange) {
    gross += o.subtotal;
    discounts += o.discountTotal;
    refunds += o.refunds.reduce((s, r) => s + r.amount, 0);
    tax += o.tax;
    tips += o.tipTotal;
    for (const l of o.lines) {
      items += l.qty - l.refundedQty;
      cogs += (costOf.get(l.productId) ?? 0) * (l.qty - l.refundedQty);
    }
    if (o.channel.startsWith("agent:")) {
      agentOrders += 1;
      agentSales += o.total;
    }
  }
  const net = gross - discounts - refunds;
  return {
    label: rangeBounds(range, now).label,
    orders: inRange.length,
    gross,
    discounts,
    refunds,
    net,
    tax,
    tips,
    avgTicket: inRange.length ? Math.round(net / inRange.length) : 0,
    items,
    cogs,
    margin: net - tax - cogs,
    agentOrders,
    agentSales,
  };
}

export interface Row {
  key: string;
  label: string;
  qty: number;
  amount: number;
  orders: number;
}

export function groupSales(
  orders: Order[],
  range: RangeKey,
  groupBy: GroupBy,
  ctx: { products: Product[]; categories: Category[]; staff: Pick<Staff, "id" | "name">[] },
  now = new Date(),
): Row[] {
  const inRange = ordersInRange(orders, range, now);
  const rows = new Map<string, Row>();
  const bump = (key: string, label: string, qty: number, amount: number, orderId: string, seen: Set<string>) => {
    const r = rows.get(key) ?? { key, label, qty: 0, amount: 0, orders: 0 };
    r.qty += qty;
    r.amount += amount;
    if (!seen.has(key)) {
      r.orders += 1;
      seen.add(key);
    }
    rows.set(key, r);
    void orderId;
  };
  const catOf = new Map(ctx.products.map((p) => [p.id, p.categoryId]));
  const catName = new Map(ctx.categories.map((c) => [c.id, `${c.emoji} ${c.name}`]));
  const staffName = new Map(ctx.staff.map((s) => [s.id, s.name]));

  for (const o of inRange) {
    const seen = new Set<string>();
    const ratio = o.subtotal > 0 ? o.total / o.subtotal : 0;
    const when = new Date(o.closedAt ?? o.createdAt);
    switch (groupBy) {
      case "item":
      case "category":
        for (const l of o.lines) {
          const qty = l.qty - l.refundedQty;
          if (qty <= 0) continue;
          const amount = Math.round((lineTotal(l) / l.qty) * qty * ratio);
          if (groupBy === "item") bump(l.productId, `${l.emoji} ${l.name}`, qty, amount, o.id, seen);
          else {
            const c = catOf.get(l.productId) ?? "other";
            bump(c, catName.get(c) ?? "Other", qty, amount, o.id, seen);
          }
        }
        break;
      case "hour": {
        const h = when.getHours();
        bump(String(h).padStart(2, "0"), `${String(h).padStart(2, "0")}:00`, 1, o.total, o.id, seen);
        break;
      }
      case "day": {
        const d = when.toISOString().slice(0, 10);
        bump(d, d, 1, o.total, o.id, seen);
        break;
      }
      case "staff":
        bump(o.staffId, staffName.get(o.staffId) ?? "Unknown", 1, o.total, o.id, seen);
        break;
      case "channel": {
        const label = o.channel === "pos" ? "Register" : o.channel.replace("agent:", "AI · ");
        bump(o.channel, label, 1, o.total, o.id, seen);
        break;
      }
      case "tender":
        for (const p of o.payments) bump(p.method, p.method.replace("_", " "), 1, p.amount, o.id, seen);
        break;
    }
  }
  const out = [...rows.values()];
  if (groupBy === "hour" || groupBy === "day") return out.sort((a, b) => a.key.localeCompare(b.key));
  return out.sort((a, b) => b.amount - a.amount);
}

export interface StockInsight {
  productId: string;
  name: string;
  emoji: string;
  stock: number;
  parLevel: number;
  dailyVelocity: number;
  daysOfCover: number | null;
  suggestedQty: number;
  supplier?: string;
  status: "out" | "low" | "ok";
}

/** Stock health using 14-day sales velocity — powers low-stock alerts and AI reorder suggestions. */
export function stockInsights(products: Product[], orders: Order[], now = new Date()): StockInsight[] {
  const since = now.getTime() - 14 * 86_400_000;
  const sold = new Map<string, number>();
  for (const o of orders) {
    if (!isSale(o) || new Date(o.createdAt).getTime() < since) continue;
    for (const l of o.lines) sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.qty - l.refundedQty);
  }
  return products
    .filter((p) => p.trackStock)
    .map((p) => {
      const dailyVelocity = Math.round(((sold.get(p.id) ?? 0) / 14) * 10) / 10;
      const daysOfCover = dailyVelocity > 0 ? Math.round((p.stock / dailyVelocity) * 10) / 10 : null;
      const target = Math.max(p.parLevel * 2, Math.ceil(dailyVelocity * 7));
      const suggestedQty = p.stock <= p.parLevel ? Math.max(p.reorderQty, target - p.stock) : 0;
      const status: StockInsight["status"] = p.stock <= 0 ? "out" : p.stock <= p.parLevel ? "low" : "ok";
      return {
        productId: p.id,
        name: p.name,
        emoji: p.emoji,
        stock: p.stock,
        parLevel: p.parLevel,
        dailyVelocity,
        daysOfCover,
        suggestedQty,
        supplier: p.supplier,
        status,
      };
    })
    .sort((a, b) => (a.daysOfCover ?? 999) - (b.daysOfCover ?? 999));
}

export interface Anomaly {
  severity: "info" | "warn";
  title: string;
  detail: string;
}

/** Lightweight loss-prevention signals: refund/discount concentration per staff member. */
export function detectAnomalies(orders: Order[], staff: Pick<Staff, "id" | "name">[], now = new Date()): Anomaly[] {
  const recent = ordersInRange(orders, "7d", now);
  const out: Anomaly[] = [];
  const byStaff = new Map<string, { sales: number; refunds: number; discounts: number; count: number }>();
  for (const o of recent) {
    const s = byStaff.get(o.staffId) ?? { sales: 0, refunds: 0, discounts: 0, count: 0 };
    s.sales += o.total;
    s.refunds += o.refunds.reduce((a, r) => a + r.amount, 0);
    s.discounts += o.discountTotal;
    s.count += 1;
    byStaff.set(o.staffId, s);
  }
  for (const [id, s] of byStaff) {
    const name = staff.find((x) => x.id === id)?.name ?? "Unknown";
    if (s.sales > 0 && s.refunds / s.sales > 0.08)
      out.push({
        severity: "warn",
        title: `High refund rate · ${name}`,
        detail: `${Math.round((s.refunds / s.sales) * 100)}% of ${name}'s sales were refunded in the last 7 days (store norm < 3%).`,
      });
    if (s.sales > 0 && s.discounts / (s.sales + s.discounts) > 0.12)
      out.push({
        severity: "warn",
        title: `Discount-heavy · ${name}`,
        detail: `${name} discounted ${Math.round((s.discounts / (s.sales + s.discounts)) * 100)}% of gross over the last 7 days.`,
      });
  }
  const today = summarize(orders, [], "today", now);
  const prior = ordersInRange(orders, "7d", now).filter(
    (o) => new Date(o.closedAt ?? o.createdAt).toDateString() !== now.toDateString(),
  );
  const avgDay = prior.reduce((s, o) => s + o.total, 0) / 6;
  if (avgDay > 0 && now.getHours() >= 15 && today.net < avgDay * 0.6)
    out.push({
      severity: "info",
      title: "Quiet day",
      detail: `Today's sales are tracking ${Math.round((1 - today.net / avgDay) * 100)}% below the 6-day average.`,
    });
  return out;
}
