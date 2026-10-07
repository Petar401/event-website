"use client";

import { useState } from "react";
import { newKey, tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { PurchaseOrder } from "@/lib/domain/types";
import { AgentBadge, Badge, Button, Card, Empty, Segmented, Spinner, timeAgo } from "@/components/ui";
import { act, agentFrom, isAgentMade } from "./act";

type View = "open" | "received" | "all";

const statusTone: Record<PurchaseOrder["status"], "neutral" | "accent" | "ok" | "bad"> = {
  draft: "neutral",
  sent: "accent",
  received: "ok",
  cancelled: "bad",
};

export function PurchaseOrdersTab({ canManage }: { canManage: boolean }) {
  const { data, loading, error, reload } = useLiveData(() => tool<PurchaseOrder[]>("list_purchase_orders", {}));
  const [view, setView] = useState<View>("open");

  if (!canManage) return <Empty icon="🔒" title="Managers only">Purchase orders are managed by owners and managers.</Empty>;
  if (loading && !data) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }
  if (error && !data) return <Empty icon="⚠️" title="Couldn't load purchase orders">{error}</Empty>;

  const all = data ?? [];
  const openCount = all.filter((p) => p.status === "draft" || p.status === "sent").length;
  const list = all.filter((p) => (view === "all" ? true : view === "open" ? p.status === "draft" || p.status === "sent" : p.status === "received"));

  return (
    <div className="space-y-4">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "open", label: `Open${openCount ? ` (${openCount})` : ""}` },
          { value: "received", label: "Received" },
          { value: "all", label: "All" },
        ]}
      />
      {list.length === 0 ? (
        <Card>
          <Empty icon="🧾" title={view === "open" ? "No open purchase orders" : "Nothing here yet"}>
            Draft one from the Stock tab. Tilda fills it from items below par.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((po) => (
            <PoCard key={po.id} po={po} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoCard({ po, onChanged }: { po: PurchaseOrder; onChanged: () => void }) {
  const { money, toast, refreshSnapshot } = usePos();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const agent = isAgentMade(po.createdBy);
  const units = po.lines.reduce((s, l) => s + l.qty, 0);

  const update = async (status: "sent" | "received" | "cancelled") => {
    setBusy(status);
    const r = await act(
      toast,
      "update_purchase_order",
      { id: po.id, status, idempotency_key: newKey() },
      {
        success: () => ({
          title: status === "received" ? `PO #${po.number} received` : status === "sent" ? `PO #${po.number} marked sent` : `PO #${po.number} cancelled`,
          body: status === "received" ? `${units} units added to stock.` : undefined,
        }),
      },
    );
    setBusy(null);
    setConfirmCancel(false);
    if (r) {
      onChanged();
      if (status === "received") void refreshSnapshot();
    }
  };

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">PO #{po.number}</div>
          <h3 className="truncate text-lg font-bold">{po.supplier}</h3>
        </div>
        <Badge tone={statusTone[po.status]} className="capitalize">
          {po.status}
        </Badge>
      </div>

      <ul className="mt-3 divide-y divide-line rounded-xl bg-surface-2 text-sm">
        {po.lines.map((l) => (
          <li key={l.productId} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 truncate">
              <span className="font-semibold tabular">{l.qty}×</span> {l.name}
            </span>
            <span className="shrink-0 text-muted tabular">{money(l.qty * l.cost)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-muted">
          {po.lines.length} line{po.lines.length === 1 ? "" : "s"} · {units} units
        </span>
        <span className="text-lg font-bold tabular">{money(po.total)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {agent ? <AgentBadge agent={agentFrom(po.createdBy).agent} label={po.createdBy} /> : <span>By {po.createdBy}</span>}
        <span>· {timeAgo(po.createdAt)}</span>
      </div>
      {po.note ? <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">{po.note}</p> : null}

      {po.status === "draft" || po.status === "sent" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {po.status === "draft" ? (
            <>
              <Button variant="primary" className="flex-1" loading={busy === "sent"} disabled={busy !== null} onClick={() => update("sent")}>
                Mark sent
              </Button>
              {confirmCancel ? (
                <Button variant="danger" loading={busy === "cancelled"} disabled={busy !== null} onClick={() => update("cancelled")}>
                  Confirm cancel
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmCancel(true)} disabled={busy !== null}>
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ok" className="flex-1" loading={busy === "received"} disabled={busy !== null} onClick={() => update("received")}>
                Receive · add {units} to stock
              </Button>
              {confirmCancel ? (
                <Button variant="danger" loading={busy === "cancelled"} disabled={busy !== null} onClick={() => update("cancelled")}>
                  Confirm cancel
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmCancel(true)} disabled={busy !== null}>
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}
