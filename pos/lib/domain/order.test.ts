import { describe, expect, it } from "vitest";
import { allocate, inclusiveTax, quickCashOptions, splitEvenly, toCents } from "./money";
import { applyRefund, applyTender, buildLine, computeTotals, emptyOrder, makeTickets, mergeLines, recompute } from "./order";
import { buildSeed } from "../data/seed";

const seed = buildSeed(new Date("2026-10-07T12:00:00Z"));
const { products, categories, modifierGroups } = seed;
const flatWhite = products.find((p) => p.name === "Flat White")!;
const croissant = products.find((p) => p.name === "Butter Croissant")!;
const beans = products.find((p) => p.categoryId === "cat_retail")!;

function orderWith(...reqs: { productId: string; qty: number; modifierIds?: string[] }[]) {
  let o = emptyOrder({ number: 1, staffId: "st_maria", createdBy: "Maria" });
  for (const r of reqs) o = { ...o, lines: mergeLines(o.lines, buildLine(r, products, categories, modifierGroups)) };
  return recompute(o);
}

describe("money", () => {
  it("parses and splits exactly", () => {
    expect(toCents("4,50")).toBe(450);
    expect(toCents("€12.3")).toBe(1230);
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b)).toBe(100);
  });
  it("computes inclusive VAT", () => {
    expect(inclusiveTax(1100, 0.1)).toBe(100);
    expect(inclusiveTax(1200, 0.2)).toBe(200);
  });
  it("offers sensible quick cash", () => {
    expect(quickCashOptions(730)).toEqual([730, 800, 1000, 2000]);
  });
});

describe("orders", () => {
  it("applies required modifiers by default and merges identical lines", () => {
    const o = orderWith({ productId: flatWhite.id, qty: 1 }, { productId: flatWhite.id, qty: 1 });
    expect(o.lines).toHaveLength(1);
    expect(o.lines[0].qty).toBe(2);
    expect(o.lines[0].modifiers.length).toBeGreaterThan(0);
  });

  it("totals with discount and mixed VAT rates", () => {
    const o = recompute({
      ...orderWith({ productId: croissant.id, qty: 2 }, { productId: beans.id, qty: 1 }),
      discount: { kind: "percent", value: 10, reason: "staff" },
    });
    const t = computeTotals(o);
    expect(t.subtotal).toBe(croissant.price * 2 + beans.price);
    expect(t.discountTotal).toBe(Math.round(t.subtotal * 0.1));
    expect(t.total).toBe(t.subtotal - t.discountTotal);
    expect(t.taxByRate.length).toBe(2);
  });

  it("takes split tender with tip and cash change", () => {
    let o = orderWith({ productId: croissant.id, qty: 3 });
    const half = Math.floor(o.total / 2);
    o = applyTender(o, { method: "card", amount: half, tip: 100 }).order;
    expect(o.status).toBe("open");
    const res = applyTender(o, { method: "cash", tendered: 5000 });
    expect(res.order.status).toBe("paid");
    expect(res.payment.change).toBe(5000 - (o.total - half));
    expect(res.order.tipTotal).toBe(100);
  });

  it("rejects card overpayment beyond balance by capping", () => {
    const o = orderWith({ productId: croissant.id, qty: 1 });
    const { payment } = applyTender(o, { method: "card", amount: 999999 });
    expect(payment.amount).toBe(o.total);
  });

  it("refunds a line and caps at paid amount", () => {
    let o = orderWith({ productId: croissant.id, qty: 2 }, { productId: flatWhite.id, qty: 1 });
    o = applyTender(o, { method: "card" }).order;
    const line = o.lines.find((l) => l.productId === croissant.id)!;
    const { order, refund } = applyRefund(o, { lines: [{ lineId: line.id, qty: 1 }], reason: "dropped", restock: false }, "Maria");
    expect(refund.amount).toBe(croissant.price);
    expect(order.status).toBe("partially_refunded");
    const full = applyRefund(order, { reason: "rest", amount: 10_000_000 }, "Maria");
    expect(full.order.status).toBe("refunded");
    expect(computeTotals(full.order).refunded).toBe(o.total);
  });

  it("creates kitchen tickets per station only once", () => {
    let o = orderWith({ productId: croissant.id, qty: 1 }, { productId: flatWhite.id, qty: 1 }, { productId: beans.id, qty: 1 });
    o = makeTickets(o);
    const stations = o.tickets.map((t) => t.station).sort();
    expect(stations).toEqual(["bar", "kitchen"]);
    expect(makeTickets(o).tickets).toHaveLength(2);
  });
});

describe("emptyOrder", () => {
  it("keeps generated id when optional fields are undefined", () => {
    const o = emptyOrder({ id: undefined, number: 5, staffId: "s", createdBy: "S", tableId: undefined });
    expect(o.id).toMatch(/^ord_/);
    expect("tableId" in o).toBe(false);
  });
});
