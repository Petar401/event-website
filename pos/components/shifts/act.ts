import { callTool, haptic } from "@/lib/client/api";
import type { Toast } from "@/lib/client/pos-context";

/**
 * Run a tool and translate failures into toasts. `approval_required` is a warn, not an error.
 * Resolves to the tool data on success, or `null` when it failed or was queued for approval.
 */
export async function act<T>(toast: (t: Omit<Toast, "id">) => void, name: string, input: Record<string, unknown>): Promise<T | null> {
  haptic();
  const r = await callTool<T>(name, input);
  if (r.ok) return r.data as T;
  if (r.code === "approval_required") toast({ tone: "warn", title: "Sent for approval", body: r.error });
  else toast({ tone: "bad", title: "That didn't work", body: r.error });
  return null;
}

/** Strip the «…» wrapper the server puts around untrusted free text. */
export function clean(text: string): string {
  return text.replace(/^«/, "").replace(/»$/, "");
}

export interface OpenReport {
  open: true;
  opened_at: string;
  opened_by: string;
  orders: number;
  opening_float: string;
  cash_sales: string;
  cash_refunds: string;
  card_sales: string;
  tips: string;
  paid_in: string;
  paid_out: string;
  expected_cash: string;
  expected_cash_cents: number;
}

export type ShiftReport = OpenReport | { open: false; message: string; expected_cash_cents: number };

/** The Z-report returned by close_shift. */
export type ZReport = OpenReport & {
  closed: true;
  counted_cash: string;
  over_short: string;
  over_short_cents: number;
};
