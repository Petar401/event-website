import type { Order, OrderLine, OrderStatus, TenderMethod } from "@/lib/domain/types";

const AGENT_NAMES: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  cursor: "Cursor",
  tilda: "Tilda",
};

export function isAgentChannel(channel: string): boolean {
  return channel.startsWith("agent:");
}

/** "agent:claude" -> { kind: "claude", name: "Claude" }; null for staff-created orders. */
export function agentOf(channel: string): { kind: string; name: string } | null {
  if (!isAgentChannel(channel)) return null;
  const kind = channel.slice(6);
  return { kind, name: AGENT_NAMES[kind] ?? (kind ? kind[0].toUpperCase() + kind.slice(1) : "AI") };
}

export const STATUS_META: Record<OrderStatus, { label: string; tone: "neutral" | "accent" | "ok" | "warn" | "bad" }> = {
  open: { label: "Open", tone: "warn" },
  paid: { label: "Paid", tone: "ok" },
  refunded: { label: "Refunded", tone: "bad" },
  partially_refunded: { label: "Part refunded", tone: "warn" },
  void: { label: "Void", tone: "neutral" },
};

export const TENDER_LABEL: Record<TenderMethod, string> = {
  cash: "Cash",
  card: "Card (simulated)",
  gift_card: "Gift card",
  points: "Loyalty points",
};

/** "Flat White, Croissant +1" */
export function itemSummary(lines: Pick<OrderLine, "name">[], max = 2): string {
  if (lines.length === 0) return "No items";
  const names = lines.slice(0, max).map((l) => l.name);
  return names.join(", ") + (lines.length > max ? ` +${lines.length - max}` : "");
}

export function itemCount(order: Pick<Order, "lines">): number {
  return order.lines.reduce((n, l) => n + l.qty, 0);
}

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Today / Yesterday / "Mon, 3 Oct" */
export function dayLabel(iso: string, locale: string, now = new Date()): string {
  const d = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
