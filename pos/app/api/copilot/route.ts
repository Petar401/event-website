import Anthropic from "@anthropic-ai/sdk";
import { getStaffSession, scopesForRole } from "@/lib/server/auth";
import { env, getRepo } from "@/lib/server/env";
import { INSTRUCTIONS } from "@/lib/server/mcp";
import { executeTool, toolJsonSchema } from "@/lib/tools/registry";
import { PUBLIC_TOOLS } from "@/lib/tools/pos-tools";
import type { Actor } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_STEPS = 8;

/** Tool definitions are deterministic so the prompt prefix caches across turns. */
const TOOL_DEFS: Anthropic.Tool[] = PUBLIC_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: toolJsonSchema(t) as Anthropic.Tool["input_schema"],
}));

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * "Ask Tilda": the in-app copilot. It drives the exact same tools as external MCP clients,
 * as an agent acting for the logged-in staff member — so approvals and the audit log apply.
 * Streams NDJSON events: {type:"text"|"tool"|"error"|"done"}.
 */
export async function POST(req: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: "Log in first" }, { status: 401 });
  if (!env.anthropicKey) return Response.json({ error: "copilot_disabled" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { messages?: ChatTurn[] };
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }) as Anthropic.MessageParam);
  if (!history.length || history[history.length - 1].role !== "user") return Response.json({ error: "Send a question" }, { status: 400 });

  const repo = getRepo();
  const settings = await repo.getSettings();
  const actor: Actor = { type: "agent", staffId: session.staffId, name: session.name, role: session.role, agent: "tilda", agentLabel: "Tilda AI" };
  const system = `${INSTRUCTIONS}

You are "Tilda", the copilot built into ${settings.businessName}'s POS. You're talking to ${session.name} (${session.role}) on the shop floor, often on a phone between customers.
- Be brief: lead with the answer, use short bullet lists, bold key numbers. No preamble.
- Use tools to get real data — never invent numbers. Prefer one well-chosen tool call over many.
- Confirm before anything irreversible (refunds, voids, price changes) unless ${session.name} was explicit.`;

  const client = new Anthropic({ apiKey: env.anthropicKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const messages: Anthropic.Beta.BetaMessageParam[] = [...history];
      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const response = await client.beta.messages.create({
            model: env.copilotModel,
            max_tokens: 16000,
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            tools: TOOL_DEFS,
            messages,
            output_config: { effort: "low" },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          } as Anthropic.Beta.MessageCreateParamsNonStreaming);

          for (const block of response.content) if (block.type === "text" && block.text) send({ type: "text", text: block.text });

          if (response.stop_reason === "refusal") {
            send({ type: "error", error: "I can't help with that one." });
            break;
          }
          if (response.stop_reason === "pause_turn") {
            messages.push({ role: "assistant", content: response.content });
            continue;
          }
          const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (response.stop_reason !== "tool_use" || calls.length === 0) break;

          messages.push({ role: "assistant", content: response.content });
          const results = await Promise.all(
            calls.map(async (call) => {
              const def = PUBLIC_TOOLS.find((t) => t.name === call.name);
              send({ type: "tool", id: call.id, name: call.name, title: def?.title ?? call.name, status: "running" });
              const r = await executeTool(PUBLIC_TOOLS, call.name, call.input, { repo, actor, scopes: scopesForRole(session.role) });
              const status = r.ok ? "ok" : "approval" in r ? "approval" : "error";
              send({ type: "tool", id: call.id, name: call.name, title: def?.title ?? call.name, status, error: r.ok ? undefined : r.error });
              const content = JSON.stringify(r.ok ? r.data : { error: r.code, message: r.error }).slice(0, 12000);
              return { type: "tool_result" as const, tool_use_id: call.id, content, is_error: !r.ok && status === "error" };
            }),
          );
          messages.push({ role: "user", content: results });
        }
      } catch (e) {
        const message =
          e instanceof Anthropic.RateLimitError
            ? "I'm a bit busy — try again in a moment."
            : e instanceof Anthropic.AuthenticationError
              ? "The Anthropic API key is invalid."
              : e instanceof Anthropic.APIError
                ? `AI service error (${e.status}).`
                : "Something went wrong.";
        console.error("[copilot]", e);
        send({ type: "error", error: message });
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET() {
  return Response.json({ enabled: Boolean(env.anthropicKey), model: env.anthropicKey ? env.copilotModel : null });
}
