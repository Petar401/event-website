import { z } from "zod";
import { formatMoney, percentOf } from "../domain/money";
import {
  DomainError,
  TICKET_FLOW,
  applyRefund,
  applyTender,
  buildLine,
  computeTotals,
  emptyOrder,
  linesRefundValue,
  makeTickets,
  mergeLines,
  nowIso,
  pointsEarned,
  recompute,
  refundableAmount,
  uid,
} from "../domain/order";
import { detectAnomalies, groupSales, rangeBounds, stockInsights, summarize } from "../domain/reports";
import type { Customer, Order, Product, PurchaseOrder, Settings, Snapshot } from "../domain/types";
import { buildSeed } from "../data/seed";
import { createApiKey, scopesForRole } from "../server/auth";
import { hashPin } from "../server/crypto";
import { defineTool, executeTool, type ToolContext, type ToolDef } from "./registry";
import { requireOrder, resolveCustomer, resolveModifiers, resolveProduct, resolveTable, untrusted } from "./resolve";

// ---------- shared schema bits ----------
const idem = z.string().min(1).max(100).optional().describe("Unique key for this write; retries with the same key won't double-apply.");
const dryRun = z.boolean().optional().describe("Preview the result without changing anything.");
const orderRef = z.string().min(1).describe("Order id (ord_…) or order number like 1042 / #1042.");
const itemSchema = z.object({
  product: z.string().min(1).describe("Product id, SKU, barcode or name (fuzzy), e.g. 'flat white'."),
  qty: z.number().int().min(1).max(999).default(1),
  modifiers: z.array(z.string()).optional().describe("Modifier ids or names, e.g. ['oat milk', 'large', 'extra shot']."),
  note: z.string().max(140).optional(),
});
const range = z.enum(["today", "yesterday", "7d", "30d"]).default("today");

// ---------- presentation helpers ----------
const money = (cents: number, s: Settings) => formatMoney(cents, s.currency, s.locale);

async function orderView(o: Order, ctx: ToolContext) {
  const s = ctx.settings;
  const t = computeTotals(o);
  const tables = await ctx.repo.listTables();
  const customer = o.customerId ? await ctx.repo.getCustomer(o.customerId) : null;
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    table: tables.find((x) => x.id === o.tableId)?.name ?? null,
    customer: customer ? { id: customer.id, name: customer.name, points: customer.points } : null,
    created_by: o.createdBy,
    channel: o.channel,
    note: untrusted(o.note),
    items: o.lines.map((l) => ({
      line_id: l.id,
      name: l.name,
      qty: l.qty,
      refunded_qty: l.refundedQty || undefined,
      modifiers: l.modifiers.map((m) => m.name),
      note: untrusted(l.note),
      line_total: money((l.unitPrice + l.modifiers.reduce((a, m) => a + m.price, 0)) * l.qty, s),
    })),
    subtotal: money(t.subtotal, s),
    discount: t.discountTotal ? `${money(t.discountTotal, s)} (${o.discount?.reason ?? ""})` : undefined,
    total: money(t.total, s),
    total_cents: t.total,
    vat_included: money(t.tax, s),
    paid: money(t.paid, s),
    balance_cents: t.balance,
    balance: money(t.balance, s),
    tips: t.tipTotal ? money(t.tipTotal, s) : undefined,
    refunded: t.refunded ? money(t.refunded, s) : undefined,
    payments: o.payments.map((p) => ({ method: p.method, amount: money(p.amount, s), tip: p.tip ? money(p.tip, s) : undefined, change: p.change ? money(p.change, s) : undefined, reference: p.reference })),
    kitchen: o.tickets.map((tk) => ({ station: tk.station, status: tk.status })),
    created_at: o.createdAt,
  };
}

function productView(p: Product, s: Settings) {
  return {
    id: p.id,
    name: p.name,
    price: money(p.price, s),
    price_cents: p.price,
    available: p.available,
    stock: p.trackStock ? p.stock : undefined,
    description: p.description || undefined,
  };
}

async function loadCatalog(ctx: ToolContext) {
  return ctx.repo.getCatalog();
}

async function linesFrom(items: z.infer<typeof itemSchema>[], ctx: ToolContext) {
  const { products, categories, modifierGroups } = await loadCatalog(ctx);
  return items.map((it) => {
    const p = resolveProduct(it.product, products);
    return buildLine({ productId: p.id, qty: it.qty, modifierIds: resolveModifiers(it.modifiers, p, modifierGroups), note: it.note }, products, categories, modifierGroups);
  });
}

async function saveOrder(o: Order, ctx: ToolContext) {
  await ctx.repo.saveOrder(o);
  ctx.changed.add("orders");
}

function channelFor(ctx: ToolContext) {
  return ctx.actor.type === "agent" ? `agent:${ctx.actor.agent ?? "other"}` : "pos";
}

function createdByLabel(ctx: ToolContext) {
  return ctx.actor.type === "agent" ? `${ctx.actor.agentLabel ?? "AI"} (for ${ctx.actor.name})` : ctx.actor.name;
}

/** Side effects when an order becomes fully paid: stock, auto-86, loyalty. */
async function onPaid(o: Order, ctx: ToolContext) {
  const { products } = await loadCatalog(ctx);
  for (const l of o.lines) {
    const p = products.find((x) => x.id === l.productId);
    if (!p?.trackStock) continue;
    const stock = p.stock - l.qty;
    await ctx.repo.saveProduct({ ...p, stock, available: stock > 0 ? p.available : false });
    ctx.changed.add("catalog");
  }
  if (o.customerId) {
    const c = await ctx.repo.getCustomer(o.customerId);
    if (c) {
      const pointsUsed = o.payments.filter((p) => p.method === "points").reduce((s, p) => s + Math.ceil(p.amount / ctx.settings.pointValue), 0);
      const earned = pointsEarned(o.total - o.payments.filter((p) => p.method === "points").reduce((s, p) => s + p.amount, 0), ctx.settings);
      await ctx.repo.saveCustomer({ ...c, points: Math.max(0, c.points - pointsUsed + earned), visits: c.visits + 1, totalSpent: c.totalSpent + o.total, lastVisitAt: nowIso() });
      ctx.changed.add("customers");
    }
  }
}

// ---------- tools ----------
export const TOOLS: ToolDef[] = [
  // ===== READ =====
  defineTool({
    name: "get_menu",
    title: "Get menu",
    description: "List the full menu/catalog grouped by category with prices, availability (86'd items) and stock for tracked items. Also lists modifier options per product.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({ include_unavailable: z.boolean().default(true) }),
    summarize: () => "Read the menu",
    run: async (input, ctx) => {
      const { categories, products, modifierGroups } = await loadCatalog(ctx);
      return categories.map((c) => ({
        category: `${c.emoji} ${c.name}`,
        items: products
          .filter((p) => p.categoryId === c.id && (input.include_unavailable || p.available))
          .map((p) => ({
            ...productView(p, ctx.settings),
            options: modifierGroups
              .filter((g) => p.modifierGroupIds.includes(g.id))
              .map((g) => ({ group: g.name, required: g.min > 0, choices: g.modifiers.map((m) => (m.price ? `${m.name} (+${money(m.price, ctx.settings)})` : m.name)) })),
          })),
      }));
    },
  }),
  defineTool({
    name: "search_catalog",
    title: "Search catalog",
    description: "Find products by name, SKU or barcode. Returns the best matches with ids and prices.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({ query: z.string().min(1) }),
    summarize: (i) => `Searched catalog for "${i.query}"`,
    run: async ({ query }, ctx) => {
      const { products } = await loadCatalog(ctx);
      const q = query.toLowerCase();
      const hits = products.filter((p) => [p.name, p.sku, p.barcode ?? "", p.description].some((v) => v.toLowerCase().includes(q)));
      if (hits.length) return hits.slice(0, 10).map((p) => productView(p, ctx.settings));
      try {
        return [productView(resolveProduct(query, products), ctx.settings)];
      } catch {
        return [];
      }
    },
  }),
  defineTool({
    name: "inventory_report",
    title: "Inventory report",
    description: "Stock levels for tracked items with 14-day sales velocity, days of cover and a suggested reorder quantity. Set low_only to see only items at or below par.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({ low_only: z.boolean().default(false) }),
    summarize: (i) => (i.low_only ? "Checked low stock" : "Read inventory report"),
    run: async ({ low_only }, ctx) => {
      const { products } = await loadCatalog(ctx);
      const orders = await ctx.repo.listOrders({ since: new Date(Date.now() - 15 * 86_400_000).toISOString() });
      const rows = stockInsights(products, orders);
      return rows.filter((r) => !low_only || r.status !== "ok");
    },
  }),
  defineTool({
    name: "list_orders",
    title: "List orders",
    description: "List recent orders, newest first. Filter by status (open, paid, refunded, partially_refunded, void) or table.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({
      status: z.enum(["open", "paid", "refunded", "partially_refunded", "void"]).optional(),
      table: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(15),
    }),
    summarize: (i) => `Listed ${i.status ?? "recent"} orders`,
    run: async (input, ctx) => {
      const table = resolveTable(input.table, await ctx.repo.listTables());
      const orders = await ctx.repo.listOrders({ status: input.status ? [input.status] : undefined, tableId: table?.id, limit: input.limit });
      const tables = await ctx.repo.listTables();
      return orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        table: tables.find((t) => t.id === o.tableId)?.name ?? null,
        items: o.lines.reduce((s, l) => s + l.qty, 0),
        total: money(o.total, ctx.settings),
        created_by: o.createdBy,
        created_at: o.createdAt,
      }));
    },
  }),
  defineTool({
    name: "get_order",
    title: "Get order",
    description: "Full detail of one order: items with line ids, modifiers, totals, payments, refunds and kitchen status.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({ order: orderRef }),
    summarize: (i) => `Viewed order ${i.order}`,
    run: async ({ order }, ctx) => orderView(await requireOrder(order, ctx.repo), ctx),
  }),
  defineTool({
    name: "sales_report",
    title: "Sales report",
    description: "Sales summary (orders, gross, discounts, refunds, net, VAT, tips, average ticket, gross margin, AI-agent share) for a period, plus a breakdown grouped by item, category, hour, day, staff, tender or channel.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({ range, group_by: z.enum(["item", "category", "hour", "day", "staff", "tender", "channel"]).default("item"), top: z.number().int().min(1).max(50).default(10) }),
    summarize: (i) => `Read sales report (${i.range}, by ${i.group_by})`,
    run: async (input, ctx) => {
      const s = ctx.settings;
      const { products, categories } = await loadCatalog(ctx);
      const staff = await ctx.repo.listStaff();
      const { from } = rangeBounds(input.range);
      const orders = await ctx.repo.listOrders({ since: new Date(from.getTime() - 86_400_000).toISOString() });
      const sum = summarize(orders, products, input.range);
      const rows = groupSales(orders, input.range, input.group_by, { products, categories, staff });
      return {
        period: sum.label,
        orders: sum.orders,
        gross: money(sum.gross, s),
        discounts: money(sum.discounts, s),
        refunds: money(sum.refunds, s),
        net_sales: money(sum.net, s),
        vat: money(sum.tax, s),
        tips: money(sum.tips, s),
        average_ticket: money(sum.avgTicket, s),
        items_sold: sum.items,
        gross_margin: money(sum.margin, s),
        ai_agent_orders: sum.agentOrders,
        breakdown: rows.slice(0, input.group_by === "hour" || input.group_by === "day" ? 50 : input.top).map((r) => ({ [input.group_by]: r.label, qty: r.qty, orders: r.orders, sales: money(r.amount, s) })),
      };
    },
  }),
  defineTool({
    name: "business_insights",
    title: "Business insights",
    description: "Proactive briefing: today vs. last 7 days, loss-prevention anomalies (refund/discount concentration), items running out and reorder suggestions. Great for 'how are we doing?'",
    scope: "pos:read",
    readOnly: true,
    input: z.object({}),
    summarize: () => "Read business insights",
    run: async (_i, ctx) => {
      const s = ctx.settings;
      const { products } = await loadCatalog(ctx);
      const orders = await ctx.repo.listOrders({ since: new Date(Date.now() - 31 * 86_400_000).toISOString() });
      const staff = await ctx.repo.listStaff();
      const today = summarize(orders, products, "today");
      const week = summarize(orders, products, "7d");
      const stock = stockInsights(products, orders).filter((x) => x.status !== "ok");
      const pending = await ctx.repo.listApprovals("pending");
      return {
        today: { orders: today.orders, net_sales: money(today.net, s), average_ticket: money(today.avgTicket, s) },
        last_7_days: { orders: week.orders, net_sales: money(week.net, s), daily_average: money(Math.round(week.net / 7), s) },
        anomalies: detectAnomalies(orders, staff),
        stock_alerts: stock.map((x) => ({ item: x.name, stock: x.stock, par: x.parLevel, days_of_cover: x.daysOfCover, suggested_reorder: x.suggestedQty, supplier: x.supplier })),
        pending_approvals: pending.map((a) => ({ id: a.id, summary: a.summary, requested_by: a.requestedBy.agentLabel ?? a.requestedBy.name })),
      };
    },
  }),
  defineTool({
    name: "find_customer",
    title: "Find customer",
    description: "Search customers by name, email or phone. Returns loyalty points, visits, lifetime spend and favourite items.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({ query: z.string().min(1) }),
    summarize: (i) => `Looked up customer "${i.query}"`,
    run: async ({ query }, ctx) => {
      const list = (await ctx.repo.listCustomers(query)).slice(0, 8);
      return Promise.all(
        list.map(async (c) => {
          const orders = await ctx.repo.listOrders({ customerId: c.id, limit: 30 });
          const fav = new Map<string, number>();
          for (const o of orders) for (const l of o.lines) fav.set(l.name, (fav.get(l.name) ?? 0) + l.qty);
          return {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            points: c.points,
            points_value: money(c.points * ctx.settings.pointValue, ctx.settings),
            visits: c.visits,
            lifetime_spend: money(c.totalSpent, ctx.settings),
            tags: c.tags,
            note: untrusted(c.note),
            favourites: [...fav.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
            last_visit: c.lastVisitAt,
          };
        }),
      );
    },
  }),
  defineTool({
    name: "list_tables",
    title: "List tables",
    description: "Floor plan: every table with seats, zone and its open order (if any).",
    scope: "pos:read",
    readOnly: true,
    input: z.object({}),
    summarize: () => "Viewed tables",
    run: async (_i, ctx) => {
      const tables = await ctx.repo.listTables();
      const open = await ctx.repo.listOrders({ status: ["open"] });
      return tables.map((t) => {
        const o = open.find((x) => x.tableId === t.id);
        return { table: t.name, seats: t.seats, zone: t.zone, status: o ? "occupied" : "free", order: o ? { number: o.number, total: money(o.total, ctx.settings), since: o.createdAt } : null };
      });
    },
  }),
  defineTool({
    name: "shift_summary",
    title: "Shift summary",
    description: "Current cash drawer shift: opening float, cash sales, paid in/out, expected cash in drawer, card totals, tips.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({}),
    summarize: () => "Read shift summary",
    run: async (_i, ctx) => shiftReport(ctx),
  }),
  defineTool({
    name: "get_policies",
    title: "Get policies",
    description: "Store policies: approval thresholds for AI agents, loyalty rules, tip presets, currency. Read this before refunds, discounts or price changes.",
    scope: "pos:read",
    readOnly: true,
    input: z.object({}),
    summarize: () => "Read store policies",
    run: async (_i, ctx) => {
      const s = ctx.settings;
      return {
        business: s.businessName,
        currency: s.currency,
        prices_include_vat: true,
        loyalty: `${s.pointsPerCurrencyUnit} point per ${money(100, s)} spent; each point is worth ${money(s.pointValue, s)} when redeemed`,
        approvals_required_for_agents: [
          `Refunds over ${money(s.approval.refundOver, s)}`,
          `Discounts over ${s.approval.discountPercentOver}%`,
          `Stock adjustments over ${s.approval.stockAdjustOver} units`,
          s.approval.priceChange ? "Any price change" : null,
          s.approval.voidPaid ? `Voiding orders over ${money(s.approval.refundOver, s)}` : null,
        ].filter(Boolean),
        tip_presets_percent: s.tipPresets,
        payments: "Card payments are simulated in this build (no real money moves). Cash, gift card and loyalty points are supported.",
      };
    },
  }),
  defineTool({
    name: "list_approvals",
    title: "List approvals",
    description: "Requests waiting for a manager's approval (and recent decisions).",
    scope: "pos:read",
    readOnly: true,
    input: z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }),
    summarize: () => "Listed approvals",
    run: async ({ status }, ctx) => (await ctx.repo.listApprovals(status)).slice(0, 30).map((a) => ({ id: a.id, status: a.status, summary: a.summary, reason: a.reason, requested_by: a.requestedBy.agentLabel ?? a.requestedBy.name, decided_by: a.decidedBy, created_at: a.createdAt })),
  }),

  // ===== WRITE: orders =====
  defineTool({
    name: "create_order",
    title: "Create order",
    description: "Ring up a new order. Items can reference products by name (fuzzy) and modifiers by name. Optionally assign a table and a customer (for loyalty), and send it straight to the kitchen/bar.",
    scope: "pos:write",
    input: z.object({
      items: z.array(itemSchema).min(1).max(50),
      table: z.string().optional().describe("Table name like '4', 'B1' or 'P2'."),
      customer: z.string().optional().describe("Customer id, exact name or email."),
      note: z.string().max(200).optional(),
      send_to_kitchen: z.boolean().default(true),
      client_order_id: z.string().max(64).optional().describe("Client-generated id for offline-safe creation."),
      idempotency_key: idem,
    }),
    summarize: async (i, ctx) => {
      const t = i.table ? ` for table ${i.table.replace(/^table\s*/i, "")}` : "";
      return `Created order with ${i.items.reduce((s, x) => s + x.qty, 0)} item(s)${t}` + (ctx.actor.type === "agent" ? "" : "");
    },
    run: async (input, ctx) => {
      if (input.client_order_id) {
        const existing = await ctx.repo.getOrder(input.client_order_id);
        if (existing) return orderView(existing, ctx);
      }
      const table = resolveTable(input.table, await ctx.repo.listTables());
      if (table) {
        const busy = (await ctx.repo.listOrders({ status: ["open"], tableId: table.id }))[0];
        if (busy) throw new DomainError(`Table ${table.name} already has open order #${busy.number}. Use add_items to add to it.`, "conflict");
      }
      const customer = await resolveCustomer(input.customer, ctx.repo);
      const lines = await linesFrom(input.items, ctx);
      let o = emptyOrder({
        id: input.client_order_id && /^ord_[a-z0-9]{6,40}$/i.test(input.client_order_id) ? input.client_order_id : undefined,
        number: await ctx.repo.nextOrderNumber(),
        staffId: ctx.actor.staffId,
        createdBy: createdByLabel(ctx),
        channel: channelFor(ctx),
        tableId: table?.id,
        customerId: customer?.id,
        note: input.note,
      } as Parameters<typeof emptyOrder>[0]);
      for (const l of lines) o = { ...o, lines: mergeLines(o.lines, l) };
      o = recompute(o);
      if (input.send_to_kitchen) o = makeTickets(o);
      await saveOrder(o, ctx);
      return orderView(o, ctx);
    },
  }),
  defineTool({
    name: "add_items",
    title: "Add items",
    description: "Add items to an open order (e.g. a second round for a table). New bar/kitchen items are sent automatically unless send_to_kitchen is false.",
    scope: "pos:write",
    input: z.object({ order: orderRef, items: z.array(itemSchema).min(1).max(50), send_to_kitchen: z.boolean().default(true), idempotency_key: idem }),
    summarize: (i) => `Added ${i.items.reduce((s, x) => s + x.qty, 0)} item(s) to order ${i.order}`,
    run: async (input, ctx) => {
      let o = await requireOrder(input.order, ctx.repo);
      if (o.status !== "open") throw new DomainError(`Order #${o.number} is ${o.status}`);
      for (const l of await linesFrom(input.items, ctx)) o = { ...o, lines: mergeLines(o.lines, l) };
      o = recompute(o);
      if (input.send_to_kitchen) o = makeTickets(o);
      await saveOrder(o, ctx);
      return orderView(o, ctx);
    },
  }),
  defineTool({
    name: "update_line",
    title: "Update line",
    description: "Change the quantity of a line on an open order, or remove it (qty 0). Lines already sent to the kitchen can still be changed.",
    scope: "pos:write",
    input: z.object({ order: orderRef, line_id: z.string(), qty: z.number().int().min(0).max(999), idempotency_key: idem }),
    summarize: (i) => (i.qty === 0 ? `Removed a line from order ${i.order}` : `Set line qty to ${i.qty} on order ${i.order}`),
    run: async (input, ctx) => {
      let o = await requireOrder(input.order, ctx.repo);
      if (o.status !== "open") throw new DomainError(`Order #${o.number} is ${o.status}`);
      if (!o.lines.some((l) => l.id === input.line_id)) throw new DomainError("Line not found", "not_found");
      const lines = input.qty === 0 ? o.lines.filter((l) => l.id !== input.line_id) : o.lines.map((l) => (l.id === input.line_id ? { ...l, qty: input.qty } : l));
      const tickets = o.tickets.map((t) => ({ ...t, lineIds: t.lineIds.filter((id) => lines.some((l) => l.id === id)) })).filter((t) => t.lineIds.length);
      o = recompute({ ...o, lines, tickets });
      await saveOrder(o, ctx);
      return orderView(o, ctx);
    },
  }),
  defineTool({
    name: "apply_discount",
    title: "Apply discount",
    description: "Apply an order-level discount as a percent (0-100) or fixed amount in cents. Replaces any existing discount; use percent 0 to remove.",
    scope: "pos:write",
    input: z.object({
      order: orderRef,
      percent: z.number().min(0).max(100).optional(),
      amount_cents: z.number().int().min(0).optional(),
      reason: z.string().min(1).max(120),
      idempotency_key: idem,
    }),
    needsApproval: async (i, ctx) => {
      const limit = ctx.settings.approval.discountPercentOver;
      if (i.percent !== undefined && i.percent > limit) return `Discounts over ${limit}% need a manager`;
      if (i.amount_cents !== undefined) {
        const o = await requireOrder(i.order, ctx.repo);
        if (o.subtotal > 0 && (i.amount_cents / o.subtotal) * 100 > limit) return `Discounts over ${limit}% need a manager`;
      }
      return null;
    },
    summarize: (i) => `Discount ${i.percent !== undefined ? `${i.percent}%` : `${((i.amount_cents ?? 0) / 100).toFixed(2)}`} on order ${i.order} — ${i.reason}`,
    run: async (input, ctx) => {
      let o = await requireOrder(input.order, ctx.repo);
      if (o.status !== "open") throw new DomainError(`Order #${o.number} is ${o.status}`);
      const discount = input.percent !== undefined ? (input.percent > 0 ? { kind: "percent" as const, value: input.percent, reason: input.reason } : undefined) : input.amount_cents ? { kind: "amount" as const, value: input.amount_cents, reason: input.reason } : undefined;
      o = recompute({ ...o, discount });
      await saveOrder(o, ctx);
      return orderView(o, ctx);
    },
  }),
  defineTool({
    name: "attach_customer",
    title: "Attach customer",
    description: "Link a customer to an order so they earn loyalty points, or move an order to a different table.",
    scope: "pos:write",
    input: z.object({ order: orderRef, customer: z.string().optional(), table: z.string().optional(), idempotency_key: idem }),
    summarize: (i) => `Updated order ${i.order}${i.customer ? ` → customer ${i.customer}` : ""}${i.table ? ` → table ${i.table}` : ""}`,
    run: async (input, ctx) => {
      let o = await requireOrder(input.order, ctx.repo);
      const customer = await resolveCustomer(input.customer, ctx.repo);
      const table = resolveTable(input.table, await ctx.repo.listTables());
      o = { ...o, customerId: customer?.id ?? o.customerId, tableId: table?.id ?? o.tableId, updatedAt: nowIso() };
      await saveOrder(o, ctx);
      return orderView(o, ctx);
    },
  }),
  defineTool({
    name: "send_to_kitchen",
    title: "Send to kitchen",
    description: "Fire any unsent bar/kitchen items on an order to the kitchen display.",
    scope: "pos:write",
    input: z.object({ order: orderRef }),
    summarize: (i) => `Sent order ${i.order} to the kitchen`,
    run: async ({ order }, ctx) => {
      const o = makeTickets(await requireOrder(order, ctx.repo));
      await saveOrder(o, ctx);
      return orderView(o, ctx);
    },
  }),
  defineTool({
    name: "update_ticket",
    title: "Update kitchen ticket",
    description: "Move a kitchen/bar ticket along new → preparing → ready → served. Without a status it advances one step.",
    scope: "pos:write",
    input: z.object({ order: orderRef, station: z.enum(["bar", "kitchen"]).optional(), status: z.enum(TICKET_FLOW).optional() }),
    summarize: (i) => `Kitchen: order ${i.order}${i.station ? ` (${i.station})` : ""} → ${i.status ?? "next step"}`,
    run: async (input, ctx) => {
      const o = await requireOrder(input.order, ctx.repo);
      const ts = nowIso();
      let touched = 0;
      const tickets = o.tickets.map((t) => {
        if (input.station && t.station !== input.station) return t;
        if (t.status === "served" && !input.status) return t;
        touched++;
        const next = input.status ?? TICKET_FLOW[Math.min(TICKET_FLOW.indexOf(t.status) + 1, TICKET_FLOW.length - 1)];
        return { ...t, status: next, updatedAt: ts };
      });
      if (!touched) throw new DomainError("No matching tickets to update");
      const updated = { ...o, tickets, updatedAt: ts };
      await saveOrder(updated, ctx);
      return { order: o.number, tickets: tickets.map((t) => ({ station: t.station, status: t.status })) };
    },
  }),
  defineTool({
    name: "take_payment",
    title: "Take payment",
    description:
      "Take payment on an order. Card is SIMULATED in this build. Cash supports tendered amount and returns change. gift_card needs gift_card_code; points redeems the attached customer's loyalty points. Omit amount_cents to pay the full remaining balance. Tip via tip_cents or tip_percent.",
    scope: "pos:write",
    input: z.object({
      order: orderRef,
      method: z.enum(["card", "cash", "gift_card", "points"]),
      amount_cents: z.number().int().positive().optional(),
      tip_cents: z.number().int().min(0).optional(),
      tip_percent: z.number().min(0).max(50).optional(),
      tendered_cents: z.number().int().positive().optional().describe("Cash handed over, for change calculation."),
      gift_card_code: z.string().optional(),
      idempotency_key: idem,
    }),
    summarize: (i) => `Took ${i.method} payment on order ${i.order}`,
    run: async (input, ctx) => {
      let o = await requireOrder(input.order, ctx.repo);
      const balance = computeTotals(o).balance;
      let amount = Math.min(input.amount_cents ?? balance, balance);
      const tip = input.tip_cents ?? (input.tip_percent ? percentOf(amount, input.tip_percent) : 0);
      let reference: string | undefined;
      if (input.method === "gift_card") {
        const card = input.gift_card_code ? await ctx.repo.getGiftCard(input.gift_card_code) : null;
        if (!card) throw new DomainError("Gift card not found", "not_found");
        if (card.balance <= 0) throw new DomainError("Gift card has no balance left");
        amount = Math.min(amount, card.balance);
        await ctx.repo.saveGiftCard({ ...card, balance: card.balance - amount });
        reference = card.code;
      }
      if (input.method === "points") {
        if (!o.customerId) throw new DomainError("Attach a customer to redeem points");
        const c = (await ctx.repo.getCustomer(o.customerId)) as Customer;
        const maxValue = c.points * ctx.settings.pointValue;
        if (maxValue <= 0) throw new DomainError(`${c.name} has no points to redeem`);
        amount = Math.min(amount, maxValue);
        reference = `${Math.ceil(amount / ctx.settings.pointValue)} pts`;
      }
      const res = applyTender(o, { method: input.method, amount, tip, tendered: input.tendered_cents, reference });
      o = res.order;
      if (o.status === "paid") await onPaid(o, ctx);
      await saveOrder(o, ctx);
      if (input.method === "cash") ctx.changed.add("shift");
      const view = await orderView(o, ctx);
      return { ...view, payment: { method: res.payment.method, amount: money(res.payment.amount, ctx.settings), tip: money(res.payment.tip, ctx.settings), change: res.payment.change !== undefined ? money(res.payment.change, ctx.settings) : undefined, change_cents: res.payment.change, reference: res.payment.reference, simulated: input.method === "card" } };
    },
  }),
  defineTool({
    name: "refund_order",
    title: "Refund order",
    description: "Refund a paid order — whole order, specific lines (line_id + qty), or a custom amount in cents. Optionally restock returned items. Large refunds by AI agents require manager approval (see get_policies).",
    scope: "pos:write",
    destructive: true,
    dryRun: true,
    input: z.object({
      order: orderRef,
      lines: z.array(z.object({ line_id: z.string(), qty: z.number().int().min(1) })).optional(),
      amount_cents: z.number().int().positive().optional(),
      reason: z.string().min(1).max(200),
      restock: z.boolean().default(false),
      dry_run: dryRun,
      idempotency_key: idem,
    }),
    needsApproval: async (i, ctx) => {
      const o = await requireOrder(i.order, ctx.repo);
      const amount = i.amount_cents ?? (i.lines?.length ? linesRefundValue(o, i.lines.map((l) => ({ lineId: l.line_id, qty: l.qty }))) : refundableAmount(o));
      if (ctx.actor.type === "staff") return `Cashier refunds need a manager`;
      return amount > ctx.settings.approval.refundOver ? `Refunds over ${money(ctx.settings.approval.refundOver, ctx.settings)} requested by an AI agent need a manager's OK` : null;
    },
    summarize: async (i, ctx) => {
      const o = await ctx.repo.getOrder(i.order);
      const amount = o ? (i.amount_cents ?? (i.lines?.length ? linesRefundValue(o, i.lines.map((l) => ({ lineId: l.line_id, qty: l.qty }))) : refundableAmount(o))) : (i.amount_cents ?? 0);
      return `Refund ${money(Math.min(amount, o ? refundableAmount(o) : amount), ctx.settings)} on order #${o?.number ?? i.order} — ${i.reason}`;
    },
    run: async (input, ctx) => {
      const o = await requireOrder(input.order, ctx.repo);
      const by = ctx.approvedBy ? `${createdByLabel(ctx)}, approved by ${ctx.approvedBy}` : createdByLabel(ctx);
      const res = applyRefund(o, { lines: input.lines?.map((l) => ({ lineId: l.line_id, qty: l.qty })), amount: input.amount_cents, reason: input.reason, restock: input.restock }, by);
      if (ctx.dryRun) return { would_refund: money(res.refund.amount, ctx.settings), new_status: res.order.status, method: res.refund.method };
      if (input.restock) {
        const { products } = await loadCatalog(ctx);
        for (const l of res.refund.lines) {
          const line = o.lines.find((x) => x.id === l.lineId);
          const p = products.find((x) => x.id === line?.productId);
          if (p?.trackStock) await ctx.repo.saveProduct({ ...p, stock: p.stock + l.qty, available: true });
        }
        ctx.changed.add("catalog");
      }
      await saveOrder(res.order, ctx);
      if (res.refund.method === "cash") ctx.changed.add("shift");
      return { refunded: money(res.refund.amount, ctx.settings), to: res.refund.method, order: await orderView(res.order, ctx) };
    },
  }),
  defineTool({
    name: "void_order",
    title: "Void order",
    description: "Cancel an open (unpaid) order entirely. Paid orders must be refunded instead.",
    scope: "pos:write",
    destructive: true,
    dryRun: true,
    input: z.object({ order: orderRef, reason: z.string().min(1).max(200), dry_run: dryRun, idempotency_key: idem }),
    needsApproval: async (i, ctx) => {
      const o = await requireOrder(i.order, ctx.repo);
      return ctx.settings.approval.voidPaid && o.total > ctx.settings.approval.refundOver ? `Voiding orders over ${money(ctx.settings.approval.refundOver, ctx.settings)} needs a manager` : null;
    },
    summarize: (i) => `Void order ${i.order} — ${i.reason}`,
    run: async (input, ctx) => {
      const o = await requireOrder(input.order, ctx.repo);
      if (o.status !== "open") throw new DomainError(`Order #${o.number} is ${o.status}; refund it instead`);
      if (o.payments.length) throw new DomainError("Order has partial payments; refund those first");
      if (ctx.dryRun) return { would_void: o.number, total: money(o.total, ctx.settings) };
      const v = { ...o, status: "void" as const, note: [o.note, `VOID: ${input.reason}`].filter(Boolean).join(" · "), closedAt: nowIso(), updatedAt: nowIso() };
      await saveOrder(v, ctx);
      return { voided: o.number };
    },
  }),

  // ===== WRITE: customers =====
  defineTool({
    name: "add_customer",
    title: "Add customer",
    description: "Create a customer profile for loyalty and receipts.",
    scope: "pos:write",
    input: z.object({ name: z.string().min(1).max(80), email: z.email().optional(), phone: z.string().max(30).optional(), note: z.string().max(200).optional(), idempotency_key: idem }),
    summarize: (i) => `Added customer ${i.name}`,
    run: async (input, ctx) => {
      if (input.email) {
        const dupe = (await ctx.repo.listCustomers(input.email)).find((c) => c.email?.toLowerCase() === input.email!.toLowerCase());
        if (dupe) throw new DomainError(`${dupe.name} already uses that email (${dupe.id})`, "conflict");
      }
      const c: Customer = { id: uid("cu_"), name: input.name, email: input.email, phone: input.phone, note: input.note, points: 0, visits: 0, totalSpent: 0, tags: [], createdAt: nowIso() };
      await ctx.repo.saveCustomer(c);
      ctx.changed.add("customers");
      return { id: c.id, name: c.name };
    },
  }),

  // ===== WRITE: cash drawer =====
  defineTool({
    name: "open_shift",
    title: "Open shift",
    description: "Open the cash drawer for a new shift with a counted opening float (cents).",
    scope: "pos:write",
    input: z.object({ opening_float_cents: z.number().int().min(0) }),
    summarize: (i) => `Opened shift with float ${(i.opening_float_cents / 100).toFixed(2)}`,
    run: async (input, ctx) => {
      if (await ctx.repo.currentShift()) throw new DomainError("A shift is already open", "conflict");
      const s = { id: uid("sh_"), openedAt: nowIso(), openedBy: createdByLabel(ctx), openingFloat: input.opening_float_cents, events: [] };
      await ctx.repo.saveShift(s);
      ctx.changed.add("shift");
      return shiftReport(ctx);
    },
  }),
  defineTool({
    name: "cash_movement",
    title: "Cash movement",
    description: "Record cash paid into or out of the drawer (e.g. petty cash for milk), or a no-sale drawer open.",
    scope: "pos:write",
    input: z.object({ type: z.enum(["paid_in", "paid_out", "no_sale"]), amount_cents: z.number().int().min(0).default(0), reason: z.string().min(1).max(120) }),
    summarize: (i) => `${i.type.replace("_", " ")} ${(i.amount_cents / 100).toFixed(2)} — ${i.reason}`,
    run: async (input, ctx) => {
      const s = await ctx.repo.currentShift();
      if (!s) throw new DomainError("No open shift. Open one first.");
      s.events.push({ id: uid("ce_"), type: input.type, amount: input.type === "no_sale" ? 0 : input.amount_cents, reason: input.reason, at: nowIso(), by: createdByLabel(ctx) });
      await ctx.repo.saveShift(s);
      ctx.changed.add("shift");
      return shiftReport(ctx);
    },
  }),
  defineTool({
    name: "close_shift",
    title: "Close shift",
    description: "Close the drawer with the counted cash (cents). Returns the Z-report with over/short.",
    scope: "pos:manage",
    input: z.object({ counted_cash_cents: z.number().int().min(0) }),
    summarize: (i) => `Closed shift, counted ${(i.counted_cash_cents / 100).toFixed(2)}`,
    run: async (input, ctx) => {
      const s = await ctx.repo.currentShift();
      if (!s) throw new DomainError("No open shift");
      const report = await shiftReport(ctx);
      const expected = report.expected_cash_cents;
      await ctx.repo.saveShift({ ...s, closedAt: nowIso(), closedBy: createdByLabel(ctx), countedCash: input.counted_cash_cents, expectedCash: expected });
      ctx.changed.add("shift");
      const diff = input.counted_cash_cents - expected;
      return { ...report, counted_cash: money(input.counted_cash_cents, ctx.settings), over_short: money(diff, ctx.settings), over_short_cents: diff, closed: true };
    },
  }),

  // ===== MANAGE: catalog & inventory =====
  defineTool({
    name: "set_availability",
    title: "86 / un-86 item",
    description: "Mark a product unavailable (86 it) or available again. Unavailable items can't be ordered.",
    scope: "pos:write",
    input: z.object({ product: z.string().min(1), available: z.boolean() }),
    summarize: (i) => `${i.available ? "Un-86'd" : "86'd"} ${i.product}`,
    run: async (input, ctx) => {
      const p = resolveProduct(input.product, (await loadCatalog(ctx)).products);
      await ctx.repo.saveProduct({ ...p, available: input.available });
      ctx.changed.add("catalog");
      return { product: p.name, available: input.available };
    },
  }),
  defineTool({
    name: "adjust_stock",
    title: "Adjust stock",
    description: "Change stock for a tracked product by a delta (e.g. +24 delivery, -2 waste) with a reason. Large adjustments by agents need approval.",
    scope: "pos:manage",
    dryRun: true,
    input: z.object({ product: z.string().min(1), delta: z.number().int().min(-10000).max(10000), reason: z.string().min(1).max(120), dry_run: dryRun, idempotency_key: idem }),
    needsApproval: (i, ctx) => (Math.abs(i.delta) > ctx.settings.approval.stockAdjustOver ? `Stock adjustments over ${ctx.settings.approval.stockAdjustOver} units need a manager` : null),
    summarize: (i) => `Stock ${i.delta > 0 ? "+" : ""}${i.delta} ${i.product} — ${i.reason}`,
    run: async (input, ctx) => {
      const p = resolveProduct(input.product, (await loadCatalog(ctx)).products);
      if (!p.trackStock) throw new DomainError(`${p.name} isn't stock-tracked`);
      const stock = Math.max(0, p.stock + input.delta);
      if (ctx.dryRun) return { product: p.name, from: p.stock, to: stock };
      await ctx.repo.saveProduct({ ...p, stock, available: stock > 0 ? (p.stock <= 0 ? true : p.available) : false });
      ctx.changed.add("catalog");
      return { product: p.name, from: p.stock, to: stock };
    },
  }),
  defineTool({
    name: "update_price",
    title: "Update price",
    description: "Change a product's price (cents, VAT-inclusive). AI agents always need manager approval for price changes.",
    scope: "pos:manage",
    dryRun: true,
    input: z.object({ product: z.string().min(1), price_cents: z.number().int().min(0).max(1_000_000), dry_run: dryRun, idempotency_key: idem }),
    needsApproval: (_i, ctx) => (ctx.settings.approval.priceChange && ctx.actor.type === "agent" ? "Price changes by AI agents need a manager's OK" : null),
    summarize: async (i, ctx) => {
      const p = resolveProduct(i.product, (await loadCatalog(ctx)).products);
      return `Change price of ${p.name}: ${money(p.price, ctx.settings)} → ${money(i.price_cents, ctx.settings)}`;
    },
    run: async (input, ctx) => {
      const p = resolveProduct(input.product, (await loadCatalog(ctx)).products);
      if (ctx.dryRun) return { product: p.name, from: money(p.price, ctx.settings), to: money(input.price_cents, ctx.settings) };
      await ctx.repo.saveProduct({ ...p, price: input.price_cents });
      ctx.changed.add("catalog");
      return { product: p.name, from: money(p.price, ctx.settings), to: money(input.price_cents, ctx.settings) };
    },
  }),
  defineTool({
    name: "draft_purchase_order",
    title: "Draft purchase order",
    description: "Draft a purchase order. With no lines, Tilda fills it from items at/below par for that supplier using sales velocity. Drafts are never sent automatically.",
    scope: "pos:write",
    input: z.object({
      supplier: z.string().min(1).describe("Supplier name, e.g. 'Hart Bakery' or 'Tilda Roastery'."),
      lines: z.array(z.object({ product: z.string(), qty: z.number().int().min(1) })).optional(),
      note: z.string().max(200).optional(),
      idempotency_key: idem,
    }),
    summarize: (i) => `Drafted PO for ${i.supplier}`,
    run: async (input, ctx) => {
      const { products } = await loadCatalog(ctx);
      let lines: PurchaseOrder["lines"];
      if (input.lines?.length) {
        lines = input.lines.map((l) => {
          const p = resolveProduct(l.product, products);
          return { productId: p.id, name: p.name, qty: l.qty, cost: p.cost };
        });
      } else {
        const orders = await ctx.repo.listOrders({ since: new Date(Date.now() - 15 * 86_400_000).toISOString() });
        const sup = input.supplier.toLowerCase();
        lines = stockInsights(products, orders)
          .filter((x) => x.suggestedQty > 0 && x.supplier?.toLowerCase().includes(sup))
          .map((x) => ({ productId: x.productId, name: x.name, qty: x.suggestedQty, cost: products.find((p) => p.id === x.productId)!.cost }));
        if (!lines.length) throw new DomainError(`Nothing from ${input.supplier} is below par right now`);
      }
      const supplierName = products.find((p) => p.supplier?.toLowerCase().includes(input.supplier.toLowerCase()))?.supplier ?? input.supplier;
      const po: PurchaseOrder = {
        id: uid("po_"),
        number: await ctx.repo.nextPurchaseOrderNumber(),
        supplier: supplierName,
        status: "draft",
        lines,
        total: lines.reduce((s, l) => s + l.qty * l.cost, 0),
        note: input.note,
        createdBy: createdByLabel(ctx),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await ctx.repo.savePurchaseOrder(po);
      ctx.changed.add("purchase_orders");
      return { id: po.id, number: po.number, supplier: po.supplier, lines: po.lines.map((l) => ({ item: l.name, qty: l.qty, unit_cost: money(l.cost, ctx.settings) })), total: money(po.total, ctx.settings), status: po.status };
    },
  }),
  defineTool({
    name: "update_purchase_order",
    title: "Update purchase order",
    description: "Mark a purchase order sent, received (adds stock) or cancelled.",
    scope: "pos:manage",
    input: z.object({ id: z.string(), status: z.enum(["sent", "received", "cancelled"]), idempotency_key: idem }),
    summarize: (i) => `PO ${i.id} → ${i.status}`,
    run: async (input, ctx) => {
      const po = (await ctx.repo.listPurchaseOrders()).find((p) => p.id === input.id || String(p.number) === input.id);
      if (!po) throw new DomainError("Purchase order not found", "not_found");
      if (po.status === "received") throw new DomainError("Already received");
      if (input.status === "received") {
        const { products } = await loadCatalog(ctx);
        for (const l of po.lines) {
          const p = products.find((x) => x.id === l.productId);
          if (p) await ctx.repo.saveProduct({ ...p, stock: p.stock + l.qty, available: true });
        }
        ctx.changed.add("catalog");
      }
      await ctx.repo.savePurchaseOrder({ ...po, status: input.status, updatedAt: nowIso() });
      ctx.changed.add("purchase_orders");
      return { number: po.number, status: input.status };
    },
  }),

  // ===== INTERNAL (Tilda UI only) =====
  defineTool({
    name: "pos_snapshot",
    title: "Snapshot",
    description: "Everything the register needs in one call.",
    scope: "pos:read",
    readOnly: true,
    internal: true,
    input: z.object({}),
    summarize: () => "Snapshot",
    run: async (_i, ctx): Promise<Snapshot> => {
      const [{ categories, products, modifierGroups }, tables, openOrders, staff, pending, shift] = await Promise.all([
        loadCatalog(ctx),
        ctx.repo.listTables(),
        ctx.repo.listOrders({ status: ["open"] }),
        ctx.repo.listStaff(),
        ctx.repo.listApprovals("pending"),
        ctx.repo.currentShift(),
      ]);
      return {
        settings: ctx.settings,
        categories,
        products,
        modifierGroups,
        tables,
        openOrders,
        staff: staff.filter((s) => s.active).map(({ id, name, role, color }) => ({ id, name, role, color })),
        pendingApprovals: pending.length,
        shift,
        mode: ctx.repo.mode,
        serverTime: nowIso(),
      };
    },
  }),
  defineTool({
    name: "decide_approval",
    title: "Approve / reject",
    description: "Approve (and execute) or reject a pending request.",
    scope: "pos:manage",
    internal: true,
    input: z.object({ id: z.string(), decision: z.enum(["approve", "reject"]) }),
    summarize: (i) => `${i.decision === "approve" ? "Approved" : "Rejected"} request ${i.id}`,
    run: async (input, ctx) => {
      if (ctx.actor.role === "cashier") throw new DomainError("Only managers can decide approvals", "forbidden");
      const a = await ctx.repo.getApproval(input.id);
      if (!a) throw new DomainError("Approval not found", "not_found");
      if (a.status !== "pending") throw new DomainError(`Already ${a.status}`);
      let result: unknown = null;
      if (input.decision === "approve") {
        const r = await executeTool(TOOLS, a.tool, a.input, { repo: ctx.repo, actor: a.requestedBy, scopes: ["pos:read", "pos:write", "pos:manage"], approvedBy: ctx.actor.name });
        if (!r.ok) throw new DomainError(`Approved, but it failed to run: ${r.error}`);
        result = r.data;
      }
      await ctx.repo.saveApproval({ ...a, status: input.decision === "approve" ? "approved" : "rejected", decidedBy: ctx.actor.name, decidedAt: nowIso(), result });
      ctx.changed.add("approvals");
      ctx.changed.add("orders");
      return { id: a.id, status: input.decision === "approve" ? "approved" : "rejected", result };
    },
  }),
  defineTool({
    name: "list_audit",
    title: "Agent activity",
    description: "Recent audited actions.",
    scope: "pos:read",
    readOnly: true,
    internal: true,
    input: z.object({ limit: z.number().int().min(1).max(500).default(100), agents_only: z.boolean().default(false) }),
    summarize: () => "Activity",
    run: async (i, ctx) => {
      const rows = await ctx.repo.listAudit(i.agents_only ? 500 : i.limit);
      return (i.agents_only ? rows.filter((r) => r.actor.type === "agent") : rows).slice(0, i.limit);
    },
  }),
  defineTool({
    name: "list_customers",
    title: "Customers",
    description: "Customer list for the UI.",
    scope: "pos:read",
    readOnly: true,
    internal: true,
    input: z.object({ search: z.string().optional() }),
    summarize: () => "Customers",
    run: async (i, ctx) => ctx.repo.listCustomers(i.search),
  }),
  defineTool({
    name: "list_orders_full",
    title: "Orders (full)",
    description: "Raw orders for the UI.",
    scope: "pos:read",
    readOnly: true,
    internal: true,
    input: z.object({ status: z.array(z.enum(["open", "paid", "refunded", "partially_refunded", "void"])).optional(), since: z.string().optional(), customer_id: z.string().optional(), limit: z.number().int().min(1).max(5000).default(100) }),
    summarize: () => "Orders",
    run: async (i, ctx) => ctx.repo.listOrders({ status: i.status, since: i.since, customerId: i.customer_id, limit: i.limit }),
  }),
  defineTool({
    name: "list_shifts",
    title: "Shifts",
    description: "Recent cash drawer shifts for the UI.",
    scope: "pos:read",
    readOnly: true,
    internal: true,
    input: z.object({ limit: z.number().int().min(1).max(100).default(20) }),
    summarize: () => "Shifts",
    run: async (i, ctx) => ctx.repo.listShifts(i.limit),
  }),
  defineTool({
    name: "list_purchase_orders",
    title: "Purchase orders",
    description: "Purchase orders for the UI.",
    scope: "pos:read",
    readOnly: true,
    internal: true,
    input: z.object({}),
    summarize: () => "Purchase orders",
    run: async (_i, ctx) => ctx.repo.listPurchaseOrders(),
  }),
  defineTool({
    name: "list_approvals_full",
    title: "Approvals (full)",
    description: "Approvals for the UI.",
    scope: "pos:read",
    readOnly: true,
    internal: true,
    input: z.object({}),
    summarize: () => "Approvals",
    run: async (_i, ctx) => ctx.repo.listApprovals(),
  }),
  defineTool({
    name: "list_api_keys",
    title: "Connections",
    description: "API keys and OAuth grants.",
    scope: "pos:manage",
    readOnly: true,
    internal: true,
    input: z.object({}),
    summarize: () => "Connections",
    run: async (_i, ctx) => ctx.repo.listApiKeys(),
  }),
  defineTool({
    name: "create_api_key",
    title: "Create API key",
    description: "Create an MCP API key for a client that doesn't support OAuth.",
    scope: "pos:manage",
    internal: true,
    input: z.object({ name: z.string().min(1).max(60), read_only: z.boolean().default(false) }),
    summarize: (i) => `Created API key "${i.name}"`,
    run: async (input, ctx) => {
      const scopes = input.read_only ? (["pos:read"] as const) : scopesForRole(ctx.actor.role);
      const { id, token } = await createApiKey({ name: input.name, staffId: ctx.actor.staffId, scopes: [...scopes], agent: "other" });
      ctx.changed.add("keys");
      return { id, token };
    },
  }),
  defineTool({
    name: "revoke_api_key",
    title: "Revoke connection",
    description: "Revoke an API key or OAuth grant.",
    scope: "pos:manage",
    internal: true,
    input: z.object({ id: z.string() }),
    summarize: (i) => `Revoked connection ${i.id}`,
    run: async ({ id }, ctx) => {
      const k = await ctx.repo.getApiKey(id);
      if (!k) throw new DomainError("Not found", "not_found");
      await ctx.repo.saveApiKey({ ...k, revoked: true });
      ctx.changed.add("keys");
      return { revoked: id };
    },
  }),
  defineTool({
    name: "update_settings",
    title: "Update settings",
    description: "Update store settings and AI approval policies.",
    scope: "pos:manage",
    internal: true,
    input: z.object({
      businessName: z.string().min(1).max(60).optional(),
      approval: z.object({ refundOver: z.number().int().min(0), discountPercentOver: z.number().min(0).max(100), stockAdjustOver: z.number().int().min(0), priceChange: z.boolean(), voidPaid: z.boolean() }).partial().optional(),
    }),
    summarize: () => "Updated settings",
    run: async (input, ctx) => {
      if (ctx.actor.role !== "owner") throw new DomainError("Only the owner can change settings", "forbidden");
      const next = { ...ctx.settings, ...(input.businessName ? { businessName: input.businessName } : {}), approval: { ...ctx.settings.approval, ...input.approval } };
      await ctx.repo.saveSettings(next);
      ctx.changed.add("settings");
      return next;
    },
  }),
  defineTool({
    name: "set_staff_pin",
    title: "Set staff PIN",
    description: "Change a staff member's 4-digit PIN (owner for anyone, everyone for themselves).",
    scope: "pos:read",
    internal: true,
    input: z.object({ staff_id: z.string(), pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits") }),
    summarize: (i) => `Changed PIN for ${i.staff_id}`,
    run: async (input, ctx) => {
      if (ctx.actor.type !== "staff") throw new DomainError("Agents can't change PINs", "forbidden");
      if (ctx.actor.role !== "owner" && ctx.actor.staffId !== input.staff_id) throw new DomainError("Only the owner can change other people's PINs", "forbidden");
      const staff = (await ctx.repo.listStaff()).find((s) => s.id === input.staff_id);
      if (!staff) throw new DomainError("Staff member not found", "not_found");
      await ctx.repo.saveStaff({ ...staff, pinHash: hashPin(input.pin) });
      return { ok: true, name: staff.name };
    },
  }),
  defineTool({
    name: "seed_demo_data",
    title: "Seed demo data",
    description: "Load the Tilda Café demo catalog and history into an empty database.",
    scope: "pos:manage",
    internal: true,
    input: z.object({}),
    summarize: () => "Seeded demo data",
    run: async (_i, ctx) => {
      if (!(await ctx.repo.isEmpty())) throw new DomainError("Database already has data", "conflict");
      await ctx.repo.importSeed(buildSeed());
      for (const k of ["orders", "catalog", "customers", "approvals", "audit", "shift", "purchase_orders"] as const) ctx.changed.add(k);
      return { seeded: true };
    },
  }),
];

async function shiftReport(ctx: ToolContext) {
  const s = ctx.settings;
  const shift = await ctx.repo.currentShift();
  if (!shift) return { open: false as const, message: "No shift is open.", expected_cash_cents: 0 };
  const orders = await ctx.repo.listOrders({ since: new Date(Date.parse(shift.openedAt) - 86_400_000).toISOString() });
  let cashSales = 0,
    card = 0,
    tips = 0,
    cashRefunds = 0,
    count = 0;
  for (const o of orders) {
    for (const p of o.payments) {
      if (p.at < shift.openedAt) continue;
      if (p.method === "cash") cashSales += p.amount + p.tip;
      if (p.method === "card") card += p.amount;
      tips += p.tip;
    }
    for (const r of o.refunds) if (r.at >= shift.openedAt && r.method === "cash") cashRefunds += r.amount;
    if (o.closedAt && o.closedAt >= shift.openedAt && o.status !== "void") count++;
  }
  const paidIn = shift.events.filter((e) => e.type === "paid_in").reduce((a, e) => a + e.amount, 0);
  const paidOut = shift.events.filter((e) => e.type === "paid_out").reduce((a, e) => a + e.amount, 0);
  const expected = shift.openingFloat + cashSales - cashRefunds + paidIn - paidOut;
  return {
    open: true as const,
    opened_at: shift.openedAt,
    opened_by: shift.openedBy,
    orders: count,
    opening_float: money(shift.openingFloat, s),
    cash_sales: money(cashSales, s),
    cash_refunds: money(cashRefunds, s),
    card_sales: money(card, s),
    tips: money(tips, s),
    paid_in: money(paidIn, s),
    paid_out: money(paidOut, s),
    expected_cash: money(expected, s),
    expected_cash_cents: expected,
    events: shift.events.map((e) => ({ type: e.type, amount: money(e.amount, s), reason: untrusted(e.reason), by: e.by, at: e.at })),
  };
}

export const PUBLIC_TOOLS = TOOLS.filter((t) => !t.internal);
