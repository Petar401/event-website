"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callTool, haptic, tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import { TICKET_FLOW } from "@/lib/domain/order";
import type { Order, Product, Station, TicketStatus } from "@/lib/domain/types";
import { Empty, PageHeader, cx } from "@/components/ui";
import { BigSegmented } from "@/components/kitchen/big-segmented";
import { EightySixBoard } from "@/components/kitchen/eighty-six-board";
import { TicketCard, type KdsTicket } from "@/components/kitchen/ticket-card";

type Column = Exclude<TicketStatus, "served">;
type StationFilter = "all" | Exclude<Station, "none">;

const COLUMNS: { id: Column; title: string; hint: string; dot: string }[] = [
  { id: "new", title: "New", hint: "Nothing waiting. New orders land here the moment they're sent.", dot: "bg-accent" },
  { id: "preparing", title: "Preparing", hint: "Nothing in progress.", dot: "bg-warn" },
  { id: "ready", title: "Ready", hint: "Nothing waiting to be served.", dot: "bg-ok" },
];

const HISTORY_MS = 12 * 3600 * 1000;
const TICK_MS = 15_000;
const OVERRIDE_TTL_MS = 8000;

interface Override {
  status: TicketStatus;
  at: number;
}

export default function KitchenPage() {
  const { snapshot, toast } = usePos();
  const { data: orders, loading, error, reload } = useLiveData(() =>
    tool<Order[]>("list_orders_full", { since: new Date(Date.now() - HISTORY_MS).toISOString(), limit: 300 }),
  );

  const [now, setNow] = useState(() => Date.now());
  const [station, setStation] = useState<StationFilter>("all");
  const [tab, setTab] = useState<Column>("new");
  const [boardOpen, setBoardOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [pending, setPending] = useState<Record<string, true>>({});
  const [availOverrides, setAvailOverrides] = useState<Record<string, boolean>>({});
  const timers = useRef<number[]>([]);

  // The 86 board starts expanded on tablets/desktops and collapsed on phones.
  useEffect(() => setBoardOpen(window.matchMedia("(min-width: 1024px)").matches), []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    const pendingTimers = timers.current;
    return () => {
      window.clearInterval(id);
      pendingTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Drop optimistic overrides once the server data has caught up (or the ticket is gone).
  useEffect(() => {
    if (!orders) return;
    const server = new Map<string, TicketStatus>();
    for (const o of orders) for (const t of o.tickets) server.set(t.id, t.status);
    setOverrides((prev) => {
      const keys = Object.keys(prev);
      const next = Object.fromEntries(keys.filter((k) => server.has(k) && server.get(k) !== prev[k].status).map((k) => [k, prev[k]]));
      return Object.keys(next).length === keys.length ? prev : next;
    });
  }, [orders]);

  const tableName = useCallback((o: Order) => (o.tableId ? (snapshot?.tables.find((t) => t.id === o.tableId)?.name ?? null) : null), [snapshot?.tables]);

  const tickets = useMemo<KdsTicket[]>(() => {
    const out: KdsTicket[] = [];
    for (const order of orders ?? []) {
      if (order.status === "void") continue;
      for (const ticket of order.tickets) {
        const o = overrides[ticket.id];
        const status = o && now - o.at < OVERRIDE_TTL_MS + TICK_MS ? o.status : ticket.status;
        if (status === "served") continue;
        out.push({ key: ticket.id, order, ticket, status });
      }
    }
    return out.sort((a, b) => a.ticket.sentAt.localeCompare(b.ticket.sentAt));
  }, [orders, overrides, now]);

  const visible = useMemo(() => tickets.filter((t) => station === "all" || t.ticket.station === station), [tickets, station]);
  const byColumn = (c: Column) => visible.filter((t) => t.status === c);
  const counts = { new: byColumn("new").length, preparing: byColumn("preparing").length, ready: byColumn("ready").length };

  const bump = async (entry: KdsTicket) => {
    const { order, ticket } = entry;
    const lockKey = `${order.id}:${ticket.station}`;
    if (pending[lockKey]) return;
    haptic(14);
    // The server advances every open ticket of this station on the order by one step; mirror that.
    const at = Date.now();
    const patch: Record<string, Override> = {};
    for (const t of order.tickets) {
      if (t.station !== ticket.station || t.status === "served") continue;
      patch[t.id] = { status: TICKET_FLOW[Math.min(TICKET_FLOW.indexOf(t.status) + 1, TICKET_FLOW.length - 1)], at };
    }
    setOverrides((p) => ({ ...p, ...patch }));
    setPending((p) => ({ ...p, [lockKey]: true }));
    const res = await callTool("update_ticket", { order: order.id, station: ticket.station });
    setPending((p) => {
      const { [lockKey]: _done, ...rest } = p;
      return rest;
    });
    if (!res.ok) {
      setOverrides((p) => {
        const next = { ...p };
        for (const id of Object.keys(patch)) delete next[id];
        return next;
      });
      toast({ title: `Couldn't update #${order.number}`, body: res.error, tone: "bad" });
      return;
    }
    reload();
  };

  const toggleProduct = async (p: Product, available: boolean) => {
    haptic();
    setAvailOverrides((m) => ({ ...m, [p.id]: available }));
    const res = await callTool("set_availability", { product: p.id, available });
    if (!res.ok) {
      setAvailOverrides((m) => {
        const { [p.id]: _undo, ...rest } = m;
        return rest;
      });
      toast({ title: `Couldn't update ${p.name}`, body: res.error, tone: "bad" });
      return;
    }
    toast({ title: available ? `${p.name} is back on` : `${p.name} is 86'd`, tone: available ? "ok" : "warn" });
    // Keep the optimistic value until the snapshot catches up, then let it go.
    timers.current.push(
      window.setTimeout(() => {
        setAvailOverrides((m) => {
          const { [p.id]: _gone, ...rest } = m;
          return rest;
        });
      }, OVERRIDE_TTL_MS),
    );
  };

  const products = useMemo(() => (snapshot?.products ?? []).map((p) => (p.id in availOverrides ? { ...p, available: availOverrides[p.id] } : p)), [snapshot?.products, availOverrides]);

  return (
    <div>
      <PageHeader
        title="Kitchen"
        subtitle={loading && !orders ? "Loading tickets…" : `${visible.length} open ticket${visible.length === 1 ? "" : "s"} · live`}
        actions={
          <BigSegmented
            value={station}
            onChange={setStation}
            options={[
              { value: "all", label: "All" },
              { value: "bar", label: "Bar" },
              { value: "kitchen", label: "Kitchen" },
            ]}
          />
        }
      />

      {error && !orders ? (
        <Empty icon="⚠️" title="Couldn't load tickets">
          {error}
        </Empty>
      ) : (
        <div className="px-4 pb-6 sm:px-6 2xl:flex 2xl:items-start 2xl:gap-5">
          <div className="min-w-0 flex-1">
            {/* Phone / small tablet: status tabs with counts (3 columns need ≥ 1024px beside the sidebar) */}
            <div className="sticky top-[57px] z-20 -mx-4 mb-3 grid grid-cols-3 gap-1.5 bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 lg:hidden" role="tablist">
              {COLUMNS.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={tab === c.id}
                  onClick={() => {
                    haptic();
                    setTab(c.id);
                  }}
                  className={cx("flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition", tab === c.id ? "border-transparent bg-ink text-bg" : "border-line bg-surface text-ink-2")}
                >
                  {c.title}
                  <span className={cx("grid min-w-6 place-items-center rounded-full px-1.5 text-xs font-black tabular", tab === c.id ? "bg-bg text-ink" : "bg-surface-3 text-ink")}>{counts[c.id]}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-3 lg:gap-4">
              {COLUMNS.map((c) => {
                const items = byColumn(c.id);
                return (
                  <section key={c.id} className={cx("min-w-0", tab !== c.id && "hidden lg:block")} aria-label={c.title}>
                    <h2 className="mb-3 hidden items-center gap-2 text-xl font-black tracking-tight lg:flex">
                      <span className={cx("size-3 rounded-full", c.dot)} aria-hidden />
                      {c.title}
                      <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-sm font-black tabular">{counts[c.id]}</span>
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 md:items-start lg:grid-cols-1">
                      {loading && !orders ? <div className="h-56 animate-pulse rounded-3xl bg-surface-2" /> : null}
                      {items.map((e) => (
                        <TicketCard key={e.key} entry={e} now={now} tableName={tableName(e.order)} pending={Boolean(pending[`${e.order.id}:${e.ticket.station}`])} onBump={bump} />
                      ))}
                      {!loading && items.length === 0 ? (
                        <div className="rounded-3xl border-2 border-dashed border-line px-4 py-10 text-center text-sm text-muted md:col-span-2 lg:col-span-1">{c.hint}</div>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <aside className="mt-6 2xl:sticky 2xl:top-6 2xl:mt-0 2xl:w-96 2xl:shrink-0">
            <EightySixBoard products={products} onToggle={toggleProduct} open={boardOpen} onOpenChange={setBoardOpen} />
          </aside>
        </div>
      )}
    </div>
  );
}
