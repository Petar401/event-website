import { callTool, haptic } from "@/lib/client/api";
import type { Toast } from "@/lib/client/pos-context";

type Notify = (t: Omit<Toast, "id">) => void;

interface ActOptions<T> {
  /** Build the success toast from the tool's return value. */
  success?: (data: T) => { title: string; body?: string } | void;
}

/**
 * Run a write tool and translate the outcome into toasts.
 * `approval_required` is a warn (queued for a manager), never an error.
 * Resolves to the tool data on success, or `null` when it failed / was queued.
 */
export async function act<T = unknown>(toast: Notify, name: string, input: Record<string, unknown>, opts: ActOptions<T> = {}): Promise<T | null> {
  haptic();
  const r = await callTool<T>(name, input);
  if (r.ok) {
    const msg = opts.success?.(r.data as T);
    if (msg) toast({ tone: "ok", ...msg });
    return r.data as T;
  }
  if (r.code === "approval_required") toast({ tone: "warn", title: "Sent for approval", body: r.error });
  else toast({ tone: "bad", title: "That didn't work", body: r.error });
  return null;
}

export function isAgentMade(createdBy: string): boolean {
  return createdBy.startsWith("Claude") || createdBy.includes("(for ");
}

export function agentFrom(createdBy: string): { agent: string; label: string } {
  const label = createdBy.split(" (for ")[0] ?? createdBy;
  return { agent: label.toLowerCase().split(" ")[0] ?? "other", label };
}
