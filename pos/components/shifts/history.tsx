"use client";

import { Badge, Card, Empty } from "@/components/ui";
import type { Shift } from "@/lib/domain/types";
import { usePos } from "@/lib/client/pos-context";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Past shifts with the over/short result. */
export function ShiftHistory({ shifts }: { shifts: Shift[] }) {
  const { money } = usePos();
  return (
    <section aria-label="Shift history">
      <h2 className="mb-2 px-1 text-sm font-bold">Recent shifts</h2>
      <Card className="divide-y divide-line overflow-hidden">
        {shifts.length === 0 ? (
          <Empty icon="🗂️" title="No shifts yet">Closed shifts show up here with their over/short.</Empty>
        ) : (
          shifts.map((s) => {
            const closed = s.closedAt !== undefined && s.countedCash !== undefined && s.expectedCash !== undefined;
            const diff = closed ? (s.countedCash ?? 0) - (s.expectedCash ?? 0) : 0;
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 sm:px-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg" aria-hidden>
                  {closed ? "🧾" : "🔓"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{when(s.openedAt)}</div>
                  <div className="truncate text-xs text-muted">
                    {s.openedBy}
                    {s.closedBy ? ` → ${s.closedBy}` : ""} · float {money(s.openingFloat)}
                    {closed ? ` · counted ${money(s.countedCash ?? 0)} of ${money(s.expectedCash ?? 0)}` : ""}
                  </div>
                </div>
                {closed ? (
                  <Badge tone={diff === 0 ? "ok" : "bad"} className="shrink-0 tabular">
                    {diff === 0 ? "Balanced" : `${diff > 0 ? "Over +" : "Short −"}${money(Math.abs(diff))}`}
                  </Badge>
                ) : (
                  <Badge tone="accent">Open</Badge>
                )}
              </div>
            );
          })
        )}
      </Card>
    </section>
  );
}
