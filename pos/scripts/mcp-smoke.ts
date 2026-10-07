// End-to-end MCP check using the official SDK client.
//   BASE_URL=http://localhost:3000 TILDA_KEY=tilda_... npm run smoke:mcp
// Without TILDA_KEY it logs in with the demo owner PIN and mints a key first (demo mode only).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const base = process.env.BASE_URL ?? "http://localhost:3000";

async function demoKey(): Promise<string> {
  const login = await fetch(`${base}/api/auth/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: "st_petar", pin: "1234" }) });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  const res = await fetch(`${base}/api/tools/create_api_key`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ name: "Claude Code smoke test" }) });
  const body = (await res.json()) as { ok: boolean; data: { token: string } };
  if (!body.ok) throw new Error("Could not create API key: " + JSON.stringify(body));
  return body.data.token;
}

function text(r: unknown): string {
  return ((r as { content: { text: string }[] }).content ?? []).map((c) => c.text).join("\n");
}

async function main() {
  const unauth = await fetch(`${base}/api/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  console.log("unauthenticated →", unauth.status, unauth.headers.get("www-authenticate"));

  const key = process.env.TILDA_KEY ?? (await demoKey());
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { Authorization: `Bearer ${key}`, "User-Agent": "claude-code smoke" } } });
  const client = new Client({ name: "tilda-smoke", version: "1.0.0" });
  await client.connect(transport);
  console.log("server:", client.getServerVersion());

  const { tools } = await client.listTools();
  console.log(`tools (${tools.length}):`, tools.map((t) => t.name).join(", "));
  const { resources } = await client.listResources();
  console.log("resources:", resources.map((r) => r.uri).join(", "));
  const { prompts } = await client.listPrompts();
  console.log("prompts:", prompts.map((p) => p.name).join(", "));

  const order = await client.callTool({
    name: "create_order",
    arguments: { items: [{ product: "flat white", qty: 2, modifiers: ["oat"] }, { product: "croissant", qty: 1, modifiers: ["warmed"] }], table: "7", customer: "Maria Georgieva", idempotency_key: "smoke-1" },
  });
  const created = (order.structuredContent ?? {}) as { id: string; number: number; total: string; total_cents: number };
  console.log("create_order →", created.number, created.total, order.isError ? text(order) : "");
  const again = await client.callTool({ name: "create_order", arguments: { items: [{ product: "flat white" }], table: "7", customer: "Maria Georgieva", idempotency_key: "smoke-1" } });
  console.log("idempotent retry same order →", (again.structuredContent as { number: number }).number === created.number);

  const paid = await client.callTool({ name: "take_payment", arguments: { order: String(created.number), method: "card", tip_percent: 10, idempotency_key: "smoke-pay-1" } });
  console.log("take_payment →", (paid.structuredContent as { status: string }).status);

  const refund = await client.callTool({ name: "refund_order", arguments: { order: String(created.number), reason: "smoke test", dry_run: true } });
  console.log("refund dry run →", text(refund).replace(/\s+/g, " ").slice(0, 160));

  const big = await client.callTool({ name: "update_price", arguments: { product: "Espresso", price_cents: 290, idempotency_key: "smoke-price" } });
  console.log("update_price (needs approval) →", text(big).replace(/\s+/g, " ").slice(0, 160));

  const report = await client.callTool({ name: "sales_report", arguments: { range: "today", group_by: "channel" } });
  console.log("sales_report →", text(report).replace(/\s+/g, " ").slice(0, 300));

  const menu = await client.readResource({ uri: "tilda://policies" });
  console.log("resource policies →", String((menu.contents[0] as { text: string }).text).replace(/\s+/g, " ").slice(0, 120));

  const prompt = await client.getPrompt({ name: "daily_close" });
  console.log("prompt daily_close →", (prompt.messages[0].content as { text: string }).text.slice(0, 60) + "…");

  await client.close();
  console.log("✅ MCP smoke test passed");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
