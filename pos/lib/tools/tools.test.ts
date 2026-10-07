import { describe, expect, it } from "vitest";
import { DemoRepo } from "../data/demo-repo";
import type { Actor, Scope } from "../domain/types";
import { executeTool, type ToolResult } from "./registry";

const code = (r: ToolResult) => (r.ok ? "ok" : r.code);
import { PUBLIC_TOOLS, TOOLS } from "./pos-tools";

const ALL: Scope[] = ["pos:read", "pos:write", "pos:manage"];
const owner: Actor = { type: "staff", staffId: "st_petar", name: "Petar", role: "owner" };
const cashier: Actor = { type: "staff", staffId: "st_sam", name: "Sam", role: "cashier" };
const claude: Actor = { type: "agent", staffId: "st_petar", name: "Petar", role: "owner", agent: "claude", agentLabel: "Claude" };

function setup() {
  const repo = new DemoRepo();
  const run = (name: string, input: unknown, actor: Actor = owner, scopes: Scope[] = ALL) => executeTool(TOOLS, name, input, { repo, actor, scopes });
  return { repo, run };
}

async function paidOrder(run: ReturnType<typeof setup>["run"], items: unknown[]) {
  const created = await run("create_order", { items });
  const number = (created as { data: { number: number } }).data.number;
  await run("take_payment", { order: String(number), method: "card" });
  return String(number);
}

describe("tool registry", () => {
  it("creates orders from fuzzy names and tags agent provenance", async () => {
    const { run, repo } = setup();
    const r = await run("create_order", { items: [{ product: "flat white", modifiers: ["oat"] }], table: "7", customer: "Maria Georgieva" }, claude);
    expect(r.ok).toBe(true);
    const view = (r as { data: { number: number } }).data;
    const order = await repo.getOrder(String(view.number));
    expect(order?.channel).toBe("agent:claude");
    expect(order?.createdBy).toBe("Claude (for Petar)");
    expect(order?.lines[0].modifiers.map((m) => m.name)).toContain("Oat milk");
    expect((await repo.listAudit(5))[0].actor.agent).toBe("claude");
  });

  it("is idempotent per key", async () => {
    const { run, repo } = setup();
    const before = (await repo.listOrders()).length;
    const a = await run("create_order", { items: [{ product: "espresso" }], idempotency_key: "k1" }, claude);
    const b = await run("create_order", { items: [{ product: "espresso" }], idempotency_key: "k1" }, claude);
    expect(a).toEqual(b);
    expect((await repo.listOrders()).length).toBe(before + 1);
  });

  it("gates big agent refunds behind approval, then executes on approve", async () => {
    const { run, repo } = setup();
    const number = await paidOrder(run, [{ product: "eggs benedict", qty: 2 }]);
    const r = await run("refund_order", { order: number, reason: "cold food" }, claude);
    expect(r.ok).toBe(false);
    expect(code(r)).toBe("approval_required");
    expect((await repo.getOrder(number))?.status).toBe("paid");
    const approvalId = (r as { approval: { id: string } }).approval.id;
    const decided = await run("decide_approval", { id: approvalId, decision: "approve" });
    expect(decided.ok).toBe(true);
    expect((await repo.getOrder(number))?.status).toBe("refunded");
  });

  it("lets small agent refunds through and supports dry runs", async () => {
    const { run, repo } = setup();
    const number = await paidOrder(run, [{ product: "espresso" }]);
    const dry = await run("refund_order", { order: number, reason: "test", dry_run: true }, claude);
    expect(dry.ok && (dry.data as { dry_run: boolean }).dry_run).toBe(true);
    expect((await repo.getOrder(number))?.status).toBe("paid");
    const real = await run("refund_order", { order: number, reason: "test" }, claude);
    expect(real.ok).toBe(true);
  });

  it("requires approval for cashier refunds and blocks cashiers from deciding", async () => {
    const { run } = setup();
    const number = await paidOrder(run, [{ product: "espresso" }]);
    const r = await run("refund_order", { order: number, reason: "oops" }, cashier, ["pos:read", "pos:write"]);
    expect(code(r)).toBe("approval_required");
    const id = (r as { approval: { id: string } }).approval.id;
    const denied = await run("decide_approval", { id, decision: "approve" }, cashier, ["pos:read", "pos:write"]);
    expect(code(denied)).toBe("forbidden");
  });

  it("enforces scopes and hides internal tools from agents", async () => {
    const { run } = setup();
    expect(code(await run("create_order", { items: [{ product: "espresso" }] }, claude, ["pos:read"]))).toBe("forbidden");
    expect(code(await run("pos_snapshot", {}, claude))).toBe("forbidden");
    expect(PUBLIC_TOOLS.some((t) => t.internal)).toBe(false);
  });

  it("decrements stock on payment and auto-86s at zero", async () => {
    const { run, repo } = setup();
    const before = (await repo.getCatalog()).products.find((p) => p.id === "pr_almondcr")!;
    await paidOrder(run, [{ product: "almond croissant", qty: before.stock }]);
    const after = (await repo.getCatalog()).products.find((p) => p.id === "pr_almondcr")!;
    expect(after.stock).toBe(0);
    expect(after.available).toBe(false);
    const blocked = await run("create_order", { items: [{ product: "almond croissant" }] });
    expect(code(blocked)).toBe("unavailable");
  });

  it("returns helpful errors for unknown products", async () => {
    const { run } = setup();
    const r = await run("create_order", { items: [{ product: "unicorn latte xyz" }] });
    expect(r.ok).toBe(false);
  });
});
