import { allocate, inclusiveTax, percentOf } from "./money";
import type {
  Category,
  Discount,
  ModifierGroup,
  Order,
  OrderLine,
  Payment,
  Product,
  Refund,
  Settings,
  TenderMethod,
} from "./types";

export class DomainError extends Error {
  constructor(
    message: string,
    public code = "invalid_request",
  ) {
    super(message);
  }
}

export const uid = (prefix = "") =>
  prefix + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 16);

export const nowIso = () => new Date().toISOString();

export function lineUnitTotal(line: Pick<OrderLine, "unitPrice" | "modifiers">): number {
  return line.unitPrice + line.modifiers.reduce((s, m) => s + m.price, 0);
}

export function lineTotal(line: Pick<OrderLine, "unitPrice" | "modifiers" | "qty">): number {
  return lineUnitTotal(line) * line.qty;
}

export function discountAmount(subtotal: number, discount?: Discount): number {
  if (!discount) return 0;
  const raw = discount.kind === "percent" ? percentOf(subtotal, Math.min(100, Math.max(0, discount.value))) : discount.value;
  return Math.max(0, Math.min(subtotal, raw));
}

export interface Totals {
  subtotal: number;
  discountTotal: number;
  total: number;
  tax: number;
  taxByRate: { rate: number; amount: number }[];
  paid: number;
  tipTotal: number;
  balance: number;
  refunded: number;
  net: number;
}

export function computeTotals(order: Pick<Order, "lines" | "discount" | "payments" | "refunds">): Totals {
  const grosses = order.lines.map(lineTotal);
  const subtotal = grosses.reduce((a, b) => a + b, 0);
  const discountTotal = discountAmount(subtotal, order.discount);
  const total = subtotal - discountTotal;
  const lineDiscounts = allocate(discountTotal, grosses);
  const taxMap = new Map<number, number>();
  order.lines.forEach((line, i) => {
    const t = inclusiveTax(grosses[i] - lineDiscounts[i], line.taxRate);
    taxMap.set(line.taxRate, (taxMap.get(line.taxRate) ?? 0) + t);
  });
  const taxByRate = [...taxMap.entries()].filter(([r]) => r > 0).map(([rate, amount]) => ({ rate, amount }));
  const tax = taxByRate.reduce((s, t) => s + t.amount, 0);
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  const tipTotal = order.payments.reduce((s, p) => s + p.tip, 0);
  const refunded = order.refunds.reduce((s, r) => s + r.amount, 0);
  return {
    subtotal,
    discountTotal,
    total,
    tax,
    taxByRate,
    paid,
    tipTotal,
    balance: Math.max(0, total - paid),
    refunded,
    net: total - refunded,
  };
}

/** Recompute denormalised totals and status. Returns a new order. */
export function recompute(order: Order): Order {
  const t = computeTotals(order);
  let status = order.status;
  if (status !== "void") {
    if (t.refunded > 0) status = t.refunded >= t.paid ? "refunded" : "partially_refunded";
    else if (order.lines.length > 0 && t.paid >= t.total && order.payments.length > 0) status = "paid";
    else status = "open";
  }
  return {
    ...order,
    status,
    subtotal: t.subtotal,
    discountTotal: t.discountTotal,
    total: t.total,
    tax: t.tax,
    tipTotal: t.tipTotal,
    paid: t.paid,
    closedAt: status === "open" ? undefined : (order.closedAt ?? nowIso()),
    updatedAt: nowIso(),
  };
}

export interface LineRequest {
  productId: string;
  qty: number;
  modifierIds?: string[];
  note?: string;
}

export function buildLine(
  req: LineRequest,
  products: Product[],
  categories: Category[],
  groups: ModifierGroup[],
): OrderLine {
  const product = products.find((p) => p.id === req.productId);
  if (!product) throw new DomainError(`Unknown product ${req.productId}`, "not_found");
  if (!product.available) throw new DomainError(`${product.name} is 86'd (unavailable) right now`, "unavailable");
  const qty = Math.floor(req.qty);
  if (qty < 1 || qty > 999) throw new DomainError("Quantity must be between 1 and 999");
  const category = categories.find((c) => c.id === product.categoryId);
  const productGroups = groups.filter((g) => product.modifierGroupIds.includes(g.id));
  const chosen = req.modifierIds ?? [];
  const modifiers = productGroups.flatMap((g) => {
    const picked = g.modifiers.filter((m) => chosen.includes(m.id));
    if (picked.length < g.min) {
      // default to first option for required groups so agents and quick taps never fail
      return g.modifiers.slice(0, g.min).map((m) => ({ id: m.id, name: m.name, price: m.price }));
    }
    if (picked.length > g.max) throw new DomainError(`Choose at most ${g.max} for ${g.name}`);
    return picked.map((m) => ({ id: m.id, name: m.name, price: m.price }));
  });
  return {
    id: uid("ln_"),
    productId: product.id,
    name: product.name,
    emoji: product.emoji,
    qty,
    unitPrice: product.price,
    modifiers,
    note: req.note?.slice(0, 140) || undefined,
    station: category?.station ?? "none",
    taxRate: category?.taxRate ?? 0,
    refundedQty: 0,
  };
}

/** Merge identical lines (same product, modifiers and note) instead of stacking duplicates. */
export function mergeLines(lines: OrderLine[], add: OrderLine): OrderLine[] {
  const key = (l: OrderLine) => `${l.productId}|${l.modifiers.map((m) => m.id).sort().join(",")}|${l.note ?? ""}`;
  const k = key(add);
  const existing = lines.find((l) => key(l) === k && l.refundedQty === 0);
  if (!existing) return [...lines, add];
  return lines.map((l) => (l === existing ? { ...l, qty: l.qty + add.qty } : l));
}

export function emptyOrder(partial: Partial<Order> & Pick<Order, "number" | "staffId" | "createdBy">): Order {
  const ts = nowIso();
  const defined = Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined)) as typeof partial;
  return recompute({
    id: uid("ord_"),
    status: "open",
    channel: "pos",
    lines: [],
    payments: [],
    refunds: [],
    tickets: [],
    subtotal: 0,
    discountTotal: 0,
    total: 0,
    tax: 0,
    tipTotal: 0,
    paid: 0,
    createdAt: ts,
    updatedAt: ts,
    ...defined,
  });
}

export interface TenderRequest {
  method: TenderMethod;
  amount?: number; // defaults to remaining balance
  tip?: number;
  tendered?: number; // cash handed over
  reference?: string;
}

export function applyTender(order: Order, req: TenderRequest): { order: Order; payment: Payment } {
  if (order.status !== "open") throw new DomainError(`Order #${order.number} is ${order.status}`);
  if (order.lines.length === 0) throw new DomainError("Order has no items");
  const { balance } = computeTotals(order);
  if (balance <= 0) throw new DomainError("Order is already fully paid");
  const amount = Math.min(req.amount ?? balance, balance);
  if (amount <= 0) throw new DomainError("Payment amount must be positive");
  const tip = Math.max(0, Math.round(req.tip ?? 0));
  let tendered: number | undefined;
  let change: number | undefined;
  if (req.method === "cash") {
    tendered = req.tendered ?? amount + tip;
    if (tendered < amount + tip) throw new DomainError("Cash tendered is less than the amount due");
    change = tendered - amount - tip;
  }
  const payment: Payment = {
    id: uid("pay_"),
    method: req.method,
    amount,
    tip,
    tendered,
    change,
    reference: req.reference ?? simulatedReference(req.method),
    at: nowIso(),
  };
  return { order: recompute({ ...order, payments: [...order.payments, payment] }), payment };
}

function simulatedReference(method: TenderMethod): string {
  const n = Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0");
  if (method === "card") return `SIM-CARD-${n}`;
  if (method === "cash") return `CASH-${n}`;
  return `${method.toUpperCase()}-${n}`;
}

export interface RefundRequest {
  lines?: { lineId: string; qty: number }[];
  amount?: number; // custom amount; defaults to full remaining or the value of selected lines
  reason: string;
  restock?: boolean;
}

export function refundableAmount(order: Order): number {
  const t = computeTotals(order);
  return Math.max(0, t.paid - t.refunded);
}

/** Price of returning the given line quantities, after the order-level discount. */
export function linesRefundValue(order: Order, lines: { lineId: string; qty: number }[]): number {
  const t = computeTotals(order);
  const ratio = t.subtotal > 0 ? t.total / t.subtotal : 0;
  return lines.reduce((sum, req) => {
    const line = order.lines.find((l) => l.id === req.lineId);
    if (!line) throw new DomainError(`Unknown line ${req.lineId}`, "not_found");
    const qty = Math.min(req.qty, line.qty - line.refundedQty);
    return sum + Math.round(lineUnitTotal(line) * qty * ratio);
  }, 0);
}

export function applyRefund(order: Order, req: RefundRequest, by: string): { order: Order; refund: Refund } {
  if (order.status === "open" || order.status === "void") throw new DomainError("Only paid orders can be refunded");
  const max = refundableAmount(order);
  if (max <= 0) throw new DomainError("Nothing left to refund on this order");
  const lines = (req.lines ?? []).filter((l) => l.qty > 0);
  let amount = req.amount ?? (lines.length ? linesRefundValue(order, lines) : max);
  amount = Math.min(Math.round(amount), max);
  if (amount <= 0) throw new DomainError("Refund amount must be positive");
  const method = order.payments.find((p) => p.method === "card")?.method ?? order.payments[0]?.method ?? "cash";
  const refund: Refund = {
    id: uid("rf_"),
    amount,
    reason: req.reason.slice(0, 200) || "No reason given",
    lines,
    restock: req.restock ?? false,
    method,
    at: nowIso(),
    by,
  };
  const updatedLines = order.lines.map((l) => {
    const r = lines.find((x) => x.lineId === l.id);
    return r ? { ...l, refundedQty: Math.min(l.qty, l.refundedQty + r.qty) } : l;
  });
  return { order: recompute({ ...order, lines: updatedLines, refunds: [...order.refunds, refund] }), refund };
}

export function pointsEarned(paidCents: number, settings: Settings): number {
  return Math.floor((paidCents / 100) * settings.pointsPerCurrencyUnit);
}

/** Group unsent lines into kitchen tickets per station. */
export function makeTickets(order: Order): Order {
  const sent = new Set(order.tickets.flatMap((t) => t.lineIds));
  const pending = order.lines.filter((l) => l.station !== "none" && !sent.has(l.id));
  if (pending.length === 0) return order;
  const ts = nowIso();
  const byStation = new Map<string, string[]>();
  for (const l of pending) byStation.set(l.station, [...(byStation.get(l.station) ?? []), l.id]);
  const tickets = [...byStation.entries()].map(([station, lineIds]) => ({
    id: uid("tk_"),
    station: station as OrderLine["station"],
    lineIds,
    status: "new" as const,
    sentAt: ts,
    updatedAt: ts,
  }));
  return { ...order, tickets: [...order.tickets, ...tickets], updatedAt: ts };
}

export const TICKET_FLOW = ["new", "preparing", "ready", "served"] as const;
