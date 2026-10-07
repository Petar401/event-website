"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildLine, computeTotals, lineTotal, type Totals } from "@/lib/domain/order";
import type { Customer, DiningTable, Discount, Order, OrderLine } from "@/lib/domain/types";
import { callTool, haptic, newKey } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";

/** A cart line that has not been sent yet. Prices are always derived from the catalog snapshot. */
export interface DraftLine {
  key: string;
  productId: string;
  qty: number;
  modifierIds: string[];
  note?: string;
}

export interface BuiltDraft {
  draft: DraftLine;
  line: OrderLine | null;
  error: string | null;
  total: number;
}

/** The slice of a tool's order view that the register and pay sheet need. */
export interface OrderView {
  id: string;
  number: number;
  table: string | null;
  customer: { id: string; name: string; points: number } | null;
  total_cents: number;
  balance_cents: number;
  items: { name: string; qty: number; modifiers: string[]; line_total: string }[];
}

export interface PayInfo {
  id: string;
  number: number;
  table: string | null;
  totalCents: number;
  balanceCents: number;
  items: { name: string; qty: number; total: string }[];
}

export type OrderMode = "takeaway" | "table";

const draftKey = (d: Pick<DraftLine, "productId" | "modifierIds" | "note">) =>
  `${d.productId}|${[...d.modifierIds].sort().join(",")}|${d.note ?? ""}`;

export function useRegister() {
  const { snapshot, toast, money, refreshSnapshot } = usePos();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState<OrderMode>("takeaway");
  const [tableId, setTableId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [note, setNote] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pendingDiscount, setPendingDiscount] = useState<{ percent: number; reason: string } | null>(null);
  const [busy, setBusy] = useState<null | "send" | "charge" | "discount">(null);
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null);

  const createKey = useRef(newKey());
  const orderSetAt = useRef(0);
  const lastOrder = useRef<Order | null>(null);

  // ---- derived data ------------------------------------------------------------------------
  const found = orderId ? snapshot?.openOrders.find((o) => o.id === orderId) : undefined;
  if (found) lastOrder.current = found;
  const order: Order | null = orderId ? (found ?? (lastOrder.current?.id === orderId ? lastOrder.current : null)) : null;
  const table: DiningTable | undefined = tableId ? snapshot?.tables.find((t) => t.id === tableId) : undefined;

  const built: BuiltDraft[] = useMemo(() => {
    if (!snapshot) return [];
    return draft.map((d) => {
      try {
        const line = buildLine(d, snapshot.products, snapshot.categories, snapshot.modifierGroups);
        return { draft: d, line, error: null, total: lineTotal(line) };
      } catch (e) {
        return { draft: d, line: null, error: e instanceof Error ? e.message : "Unavailable", total: 0 };
      }
    });
  }, [draft, snapshot]);

  const totals: Totals = useMemo(() => {
    const discount: Discount | undefined = order?.discount ?? (pendingDiscount ? { kind: "percent", value: pendingDiscount.percent, reason: pendingDiscount.reason } : undefined);
    const lines = [...(order?.lines ?? []), ...built.flatMap((b) => (b.line ? [b.line] : []))];
    return computeTotals({ lines, discount, payments: order?.payments ?? [], refunds: [] });
  }, [order, built, pendingDiscount]);

  const discount: Discount | undefined = order?.discount ?? (pendingDiscount ? { kind: "percent", value: pendingDiscount.percent, reason: pendingDiscount.reason } : undefined);
  const draftCount = draft.reduce((s, d) => s + d.qty, 0);
  const serverCount = order?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
  const itemCount = draftCount + serverCount;
  const draftQtyByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of draft) m.set(d.productId, (m.get(d.productId) ?? 0) + d.qty);
    return m;
  }, [draft]);

  // ---- state resets ------------------------------------------------------------------------
  const resetAll = useCallback(() => {
    setDraft([]);
    setMode("takeaway");
    setTableId(null);
    setCustomer(null);
    setNote("");
    setOrderId(null);
    setPendingDiscount(null);
    setPayInfo(null);
    setBusy(null);
    lastOrder.current = null;
    createKey.current = newKey();
  }, []);

  const loadOrder = useCallback((o: Order) => {
    orderSetAt.current = Date.now();
    lastOrder.current = o;
    setOrderId(o.id);
    setTableId(o.tableId ?? null);
    setMode(o.tableId ? "table" : "takeaway");
    setPendingDiscount(null);
    if (!o.customerId) setCustomer(null);
  }, []);

  // Resolve the customer of a loaded order.
  useEffect(() => {
    const cid = order?.customerId;
    if (!cid || customer?.id === cid) return;
    let alive = true;
    callTool<Customer[]>("list_customers", {}).then((r) => {
      if (!alive || !r.ok) return;
      const c = (r.data as Customer[]).find((x) => x.id === cid);
      if (c) setCustomer(c);
    });
    return () => {
      alive = false;
    };
  }, [order?.customerId, customer?.id]);

  const refreshCustomer = useCallback(async () => {
    const id = customer?.id;
    if (!id) return;
    const r = await callTool<Customer[]>("list_customers", {});
    if (r.ok) {
      const c = (r.data as Customer[]).find((x) => x.id === id);
      if (c) setCustomer(c);
    }
  }, [customer?.id]);

  // The loaded order vanished (paid or voided elsewhere): drop back to a fresh register.
  useEffect(() => {
    if (!orderId || !snapshot || found || payInfo) return;
    if (Date.now() - orderSetAt.current < 4000) return;
    toast({ title: "That order was closed", body: "It was paid or voided on another device.", tone: "warn" });
    setOrderId(null);
    setTableId(null);
    setMode("takeaway");
    lastOrder.current = null;
  }, [orderId, snapshot, found, payInfo, toast]);

  // ---- URL params: ?table=tb_4 / ?order=<id> ---------------------------------------------------
  const urlKey = `${params.get("order") ?? ""}|${params.get("table") ?? ""}`;
  const appliedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshot || urlKey === appliedKey.current) return;
    const prev = appliedKey.current;
    appliedKey.current = urlKey;
    const [oid, tid] = urlKey.split("|");
    if (oid) {
      const o = snapshot.openOrders.find((x) => x.id === oid || String(x.number) === oid);
      if (o) loadOrder(o);
      else toast({ title: "Order not found", body: "It may already be paid.", tone: "warn" });
    } else if (tid) {
      const t = snapshot.tables.find((x) => x.id === tid);
      if (!t) return;
      const existing = snapshot.openOrders.find((x) => x.tableId === t.id);
      if (existing) loadOrder(existing);
      else {
        setTableId(t.id);
        setMode("table");
      }
    } else if (prev && prev !== "|" && !payInfo) {
      resetAll();
    }
  }, [snapshot, urlKey, loadOrder, resetAll, toast, payInfo]);

  const clearUrl = useCallback(() => {
    if (params.get("order") || params.get("table")) router.replace(pathname);
  }, [params, router, pathname]);

  // ---- draft editing -----------------------------------------------------------------------
  const addToCart = useCallback((productId: string, qty = 1, modifierIds: string[] = [], lineNote?: string) => {
    haptic();
    setDraft((cur) => {
      const next: DraftLine = { key: newKey(), productId, qty, modifierIds, note: lineNote?.trim() || undefined };
      const k = draftKey(next);
      const hit = cur.find((d) => draftKey(d) === k);
      if (hit) return cur.map((d) => (d === hit ? { ...d, qty: Math.min(99, d.qty + qty) } : d));
      return [...cur, next];
    });
  }, []);

  const changeQty = useCallback((key: string, delta: number) => {
    haptic();
    setDraft((cur) => cur.flatMap((d) => (d.key !== key ? [d] : d.qty + delta <= 0 ? [] : [{ ...d, qty: Math.min(99, d.qty + delta) }])));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft([]);
    setPendingDiscount(null);
  }, []);

  // ---- order context -----------------------------------------------------------------------
  const selectTable = useCallback(
    async (t: DiningTable) => {
      const existing = snapshot?.openOrders.find((o) => o.tableId === t.id);
      if (existing) {
        if (existing.id !== orderId) loadOrder(existing);
        return;
      }
      setTableId(t.id);
      setMode("table");
      if (order) {
        const r = await callTool("attach_customer", { order: order.id, table: t.name, idempotency_key: newKey() });
        if (!r.ok) toast({ title: "Couldn't move the order", body: r.error, tone: "bad" });
        else {
          toast({ title: `Moved to table ${t.name}`, tone: "ok" });
          refreshSnapshot();
        }
      }
    },
    [snapshot, orderId, order, loadOrder, toast, refreshSnapshot],
  );

  const selectMode = useCallback(
    (m: OrderMode) => {
      if (m === "takeaway" && order?.tableId) {
        toast({ title: "This order is on a table", body: "Pick another table to move it.", tone: "warn" });
        return;
      }
      setMode(m);
      if (m === "takeaway") setTableId(null);
    },
    [order, toast],
  );

  const selectCustomer = useCallback(
    async (c: Customer | null) => {
      if (order) {
        if (!c) return;
        const r = await callTool("attach_customer", { order: order.id, customer: c.id, idempotency_key: newKey() });
        if (!r.ok) {
          toast({ title: "Couldn't attach customer", body: r.error, tone: "bad" });
          return;
        }
        refreshSnapshot();
      }
      setCustomer(c);
    },
    [order, toast, refreshSnapshot],
  );

  // ---- server sync -------------------------------------------------------------------------
  /** Creates the order or adds the draft to it, applies a pending discount, and returns the fresh view. */
  const syncOrder = useCallback(async (): Promise<{ view: OrderView; blocked: boolean } | null> => {
    const lines = built.filter((b) => b.line);
    const items = lines.map((b) => ({ product: b.draft.productId, qty: b.draft.qty, modifiers: b.draft.modifierIds, note: b.draft.note }));
    let view: OrderView | null = null;
    if (order) {
      if (items.length) {
        const r = await callTool<OrderView>("add_items", { order: order.id, items, idempotency_key: createKey.current });
        if (!r.ok) {
          toast({ title: "Couldn't send items", body: r.error, tone: "bad" });
          return null;
        }
        view = r.data as OrderView;
      }
    } else {
      if (!items.length) return null;
      const r = await callTool<OrderView>("create_order", {
        items,
        table: table?.name,
        customer: customer?.id,
        note: note.trim() || undefined,
        send_to_kitchen: true,
        idempotency_key: createKey.current,
      });
      if (!r.ok) {
        toast({ title: "Couldn't create the order", body: r.error, tone: "bad" });
        refreshSnapshot();
        return null;
      }
      view = r.data as OrderView;
    }
    createKey.current = newKey();
    let blocked = false;
    const targetId = view?.id ?? order?.id;
    if (pendingDiscount && targetId) {
      const d = await callTool<OrderView>("apply_discount", { order: targetId, percent: pendingDiscount.percent, reason: pendingDiscount.reason, idempotency_key: newKey() });
      if (d.ok) view = d.data as OrderView;
      else {
        blocked = true;
        toast({
          title: d.code === "approval_required" ? "Discount needs manager approval" : "Discount failed",
          body: d.code === "approval_required" ? "The order was created without it. Charge again once approved." : d.error,
          tone: d.code === "approval_required" ? "warn" : "bad",
        });
      }
      setPendingDiscount(null);
    }
    await refreshSnapshot();
    if (view) {
      orderSetAt.current = Date.now();
      setOrderId(view.id);
    }
    setDraft([]);
    setNote("");
    if (!view && order) return { view: viewFromOrder(order, money), blocked };
    return view ? { view, blocked } : null;
  }, [built, order, table, customer, note, pendingDiscount, toast, refreshSnapshot, money]);

  const send = useCallback(async () => {
    if (busy || draft.length === 0) return;
    setBusy("send");
    const res = await syncOrder();
    setBusy(null);
    if (res) {
      haptic(20);
      toast({ title: "Sent to kitchen", body: `Order #${res.view.number}${res.view.table ? ` · Table ${res.view.table}` : ""}`, tone: "ok" });
    }
  }, [busy, draft.length, syncOrder, toast]);

  const charge = useCallback(async () => {
    if (busy) return;
    if (itemCount === 0) return;
    setBusy("charge");
    let info: PayInfo | null = null;
    if (draft.length > 0 || !order || pendingDiscount) {
      const res = await syncOrder();
      if (res && !res.blocked) info = payInfoFromView(res.view);
    } else {
      info = payInfoFromOrder(order, money, snapshot?.tables.find((t) => t.id === order.tableId)?.name ?? null);
    }
    setBusy(null);
    if (!info) return;
    if (info.balanceCents <= 0) {
      toast({ title: "Nothing left to pay", tone: "ok" });
      return;
    }
    haptic(15);
    setPayInfo(info);
  }, [busy, itemCount, draft.length, order, pendingDiscount, syncOrder, money, toast, snapshot]);

  const applyDiscount = useCallback(
    async (percent: number, reason: string) => {
      if (!order) {
        setPendingDiscount(percent > 0 ? { percent, reason } : null);
        return true;
      }
      setBusy("discount");
      const r = await callTool("apply_discount", { order: order.id, percent, reason, idempotency_key: newKey() });
      setBusy(null);
      if (r.ok) {
        toast({ title: percent > 0 ? `${percent}% discount applied` : "Discount removed", tone: "ok" });
        refreshSnapshot();
        return true;
      }
      if (r.code === "approval_required") {
        toast({ title: "Needs manager approval", body: "The discount was queued. A manager can approve it from the AI Hub.", tone: "warn" });
        return true;
      }
      toast({ title: "Couldn't apply discount", body: r.error, tone: "bad" });
      return false;
    },
    [order, toast, refreshSnapshot],
  );

  const finishPayment = useCallback(() => {
    resetAll();
    clearUrl();
    refreshSnapshot();
  }, [resetAll, clearUrl, refreshSnapshot]);

  const startNew = useCallback(() => {
    resetAll();
    clearUrl();
  }, [resetAll, clearUrl]);

  return {
    snapshot,
    draft,
    built,
    order,
    table,
    mode,
    customer,
    note,
    setNote,
    totals,
    discount,
    itemCount,
    draftCount,
    draftQtyByProduct,
    busy,
    payInfo,
    setPayInfo,
    addToCart,
    changeQty,
    clearDraft,
    selectTable,
    selectMode,
    selectCustomer,
    removeCustomer: () => setCustomer(null),
    refreshCustomer,
    send,
    charge,
    applyDiscount,
    finishPayment,
    startNew,
  };
}

export type RegisterState = ReturnType<typeof useRegister>;

export function payInfoFromView(v: OrderView): PayInfo {
  return {
    id: v.id,
    number: v.number,
    table: v.table,
    totalCents: v.total_cents,
    balanceCents: v.balance_cents,
    items: v.items.map((i) => ({ name: i.name, qty: i.qty, total: i.line_total })),
  };
}

export function payInfoFromOrder(o: Order, money: (c: number) => string, table: string | null): PayInfo {
  const t = computeTotals(o);
  return {
    id: o.id,
    number: o.number,
    table,
    totalCents: t.total,
    balanceCents: t.balance,
    items: o.lines.map((l) => ({ name: l.name, qty: l.qty, total: money(lineTotal(l)) })),
  };
}

function viewFromOrder(o: Order, money: (c: number) => string): OrderView {
  const t = computeTotals(o);
  return {
    id: o.id,
    number: o.number,
    table: null,
    customer: null,
    total_cents: t.total,
    balance_cents: t.balance,
    items: o.lines.map((l) => ({ name: l.name, qty: l.qty, modifiers: l.modifiers.map((m) => m.name), line_total: money(lineTotal(l)) })),
  };
}
