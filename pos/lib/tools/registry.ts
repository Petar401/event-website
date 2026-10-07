import { z } from "zod";
import type { Actor, Approval, Scope, Settings } from "../domain/types";
import type { Repo } from "../data/repo";
import { DomainError, nowIso, uid } from "../domain/order";
import { broadcast, type ChangeKind } from "../server/realtime";

export interface ToolContext {
  repo: Repo;
  actor: Actor;
  scopes: Scope[];
  settings: Settings;
  /** Set when executing a previously approved request. */
  approvedBy?: string;
  changed: Set<ChangeKind>;
}

export interface ToolDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  scope: Scope;
  input: S;
  /** Hidden from MCP/copilot — used only by the Tilda UI. */
  internal?: boolean;
  readOnly?: boolean;
  destructive?: boolean;
  /** Supports `dry_run: true` to preview without writing. */
  dryRun?: boolean;
  /** Return a reason string when this call must be approved by a manager first (agents and cashiers only). */
  needsApproval?: (input: z.infer<S>, ctx: ToolContext) => Promise<string | null> | string | null;
  /** One-line human summary for audit/approvals. */
  summarize: (input: z.infer<S>, ctx: ToolContext) => Promise<string> | string;
  run: (input: z.infer<S>, ctx: ToolContext & { dryRun: boolean }) => Promise<unknown>;
}

export function defineTool<S extends z.ZodObject>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; code: string }
  | { ok: false; code: "approval_required"; error: string; approval: Pick<Approval, "id" | "summary" | "reason" | "status"> };

const writeTools = (t: ToolDef) => !t.readOnly;

/**
 * Single choke point for every action in the system — register UI, MCP clients and the copilot
 * all go through here, so permissions, approvals, idempotency and audit are enforced once.
 */
export async function executeTool(
  tools: ToolDef[],
  name: string,
  rawInput: unknown,
  base: Omit<ToolContext, "changed" | "settings">,
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { ok: false, code: "unknown_tool", error: `Unknown tool: ${name}` };
  if (tool.internal && base.actor.type === "agent") return { ok: false, code: "forbidden", error: `${name} is not available to agents` };
  if (!base.scopes.includes(tool.scope)) {
    return { ok: false, code: "forbidden", error: `This connection lacks the ${tool.scope} scope required for ${name}` };
  }

  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { ok: false, code: "invalid_input", error: z.prettifyError(parsed.error) };
  }
  const input = parsed.data as Record<string, unknown>;
  const dryRun = Boolean(tool.dryRun && input.dry_run);
  const settings = await base.repo.getSettings();
  const ctx: ToolContext = { ...base, settings, changed: new Set() };

  const idemKey = typeof input.idempotency_key === "string" && input.idempotency_key ? `${base.actor.staffId}:${name}:${input.idempotency_key}` : null;
  if (idemKey && !dryRun) {
    const prior = await base.repo.getIdempotent(idemKey);
    if (prior !== undefined) return prior as ToolResult;
  }

  const summary = await safeSummary(tool, input, ctx);
  const audit = async (outcome: "ok" | "error" | "approval_required" | "dry_run", error?: string) => {
    if (tool.readOnly && base.actor.type === "staff") return; // don't log staff browsing
    await base.repo.appendAudit({
      id: uid("au_"),
      at: nowIso(),
      actor: base.actor,
      tool: name,
      summary: base.approvedBy ? `${summary} (approved by ${base.approvedBy})` : summary,
      input: redact(input),
      outcome,
      error,
    });
    ctx.changed.add("audit");
  };

  try {
    const gate = !dryRun && !base.approvedBy && (base.actor.type === "agent" || base.actor.role === "cashier") && tool.needsApproval;
    if (gate) {
      const reason = await tool.needsApproval!(input as never, ctx);
      if (reason) {
        const approval: Approval = {
          id: uid("ap_"),
          tool: name,
          input,
          summary,
          reason,
          requestedBy: base.actor,
          status: "pending",
          createdAt: nowIso(),
        };
        await base.repo.saveApproval(approval);
        await audit("approval_required");
        ctx.changed.add("approvals");
        await broadcast([...ctx.changed], { approval: summary, by: actorLabel(base.actor) });
        const result: ToolResult = {
          ok: false,
          code: "approval_required",
          error: `Needs approval: ${reason}. A manager has been notified in Tilda and can approve it from the Approvals inbox.`,
          approval: { id: approval.id, summary, reason, status: "pending" },
        };
        if (idemKey) await base.repo.setIdempotent(idemKey, result);
        return result;
      }
    }

    const data = await tool.run(input as never, { ...ctx, dryRun });
    const result: ToolResult = { ok: true, data: dryRun ? { dry_run: true, preview: data } : data };
    if (writeTools(tool)) {
      await audit(dryRun ? "dry_run" : "ok");
      if (idemKey && !dryRun) await base.repo.setIdempotent(idemKey, result);
    } else if (base.actor.type === "agent") {
      await audit("ok");
    }
    if (ctx.changed.size) await broadcast([...ctx.changed], { tool: name, summary, by: actorLabel(base.actor), agent: base.actor.agent });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code = e instanceof DomainError ? e.code : "internal_error";
    if (writeTools(tool)) await audit("error", message);
    if (!(e instanceof DomainError)) console.error(`[tool:${name}]`, e);
    return { ok: false, code, error: message };
  }
}

async function safeSummary(tool: ToolDef, input: Record<string, unknown>, ctx: ToolContext) {
  try {
    return await tool.summarize(input as never, ctx);
  } catch {
    return tool.title;
  }
}

export function actorLabel(a: Actor): string {
  return a.type === "agent" ? `${a.agentLabel ?? "AI agent"} (for ${a.name})` : a.name;
}

function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = /pin|secret|token|password/i.test(k) ? "•••" : v;
  return out;
}

/** JSON Schema for a tool's input (used by MCP tools/list and the copilot). */
export function toolJsonSchema(tool: ToolDef): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.input, { target: "draft-7", io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
