import { describe, expect, it } from "vitest";
import { handleRpc } from "./mcp";
import type { BearerContext } from "./auth";

const auth = (scopes: BearerContext["scopes"]): BearerContext => ({
  kid: "k",
  scopes,
  actor: { type: "agent", staffId: "st_petar", name: "Petar", role: "owner", agent: "claude", agentLabel: "Claude" },
});

describe("MCP JSON-RPC", () => {
  it("negotiates protocol version", async () => {
    const r = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, auth(["pos:read"]))) as { result: { protocolVersion: string; serverInfo: { name: string } } };
    expect(r.result.protocolVersion).toBe("2025-06-18");
    expect(r.result.serverInfo.name).toBe("tilda-pos");
    const r2 = (await handleRpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, auth(["pos:read"]))) as { result: { protocolVersion: string } };
    expect(r2.result.protocolVersion).toBe("2025-11-25");
  });

  it("filters tools by scope and annotates them", async () => {
    const read = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, auth(["pos:read"]))) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean }; inputSchema: { type: string } }[] } };
    expect(read.result.tools.length).toBeGreaterThan(5);
    expect(read.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true);
    expect(read.result.tools.every((t) => t.inputSchema.type === "object")).toBe(true);
    const all = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, auth(["pos:read", "pos:write", "pos:manage"]))) as { result: { tools: { name: string }[] } };
    expect(all.result.tools.map((t) => t.name)).toContain("refund_order");
  });

  it("ignores notifications and rejects unknown methods", async () => {
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, auth(["pos:read"]))).toBeNull();
    const r = (await handleRpc({ jsonrpc: "2.0", id: 9, method: "nope" }, auth(["pos:read"]))) as { error: { code: number } };
    expect(r.error.code).toBe(-32601);
  });

  it("serves resources and prompts", async () => {
    const res = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "tilda://policies" } }, auth(["pos:read"]))) as { result: { contents: { text: string }[] } };
    expect(res.result.contents[0].text).toContain("approvals_required_for_agents");
    const p = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "prompts/get", params: { name: "daily_close" } }, auth(["pos:read"]))) as { result: { messages: unknown[] } };
    expect(p.result.messages).toHaveLength(1);
  });
});
