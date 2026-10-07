import type { DiningTable, Order } from "@/lib/domain/types";
import { minutesSince } from "../ui";

export type KitchenState = { label: string; tone: "neutral" | "warn" | "ok" } | null;

export interface TableInfo {
  table: DiningTable;
  order: Order | null;
  minutes: number;
  items: number;
  kitchen: KitchenState;
  agent: { agent: string; label: string } | null;
}

export function kitchenState(order: Order): KitchenState {
  const t = order.tickets;
  if (t.length === 0) return null;
  if (t.every((x) => x.status === "served")) return { label: "Served", tone: "neutral" };
  if (t.every((x) => x.status === "ready" || x.status === "served")) return { label: "Ready to serve", tone: "ok" };
  if (t.some((x) => x.status === "preparing")) return { label: "Preparing", tone: "warn" };
  return { label: "In queue", tone: "neutral" };
}

export function tableInfo(table: DiningTable, orders: Order[], now: number): TableInfo {
  const order = orders.find((o) => o.tableId === table.id) ?? null;
  return {
    table,
    order,
    minutes: order ? minutesSince(order.createdAt, now) : 0,
    items: order ? order.lines.reduce((s, l) => s + l.qty, 0) : 0,
    kitchen: order ? kitchenState(order) : null,
    agent: order?.channel.startsWith("agent:") ? { agent: order.channel.slice(6), label: order.createdBy.split(" (")[0] } : null,
  };
}

export function duration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
