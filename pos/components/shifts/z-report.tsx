"use client";

import { Button, Card, cx } from "@/components/ui";
import type { ZReport } from "./act";

export interface ZReportData {
  report: ZReport;
  closedAt: string;
  closedBy: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Printable end-of-shift Z-report with a receipt look. */
export function ZReportCard({ data, businessName, onDismiss }: { data: ZReportData; businessName: string; onDismiss: () => void }) {
  const { report: r } = data;
  const diff = r.over_short_cents;
  const rows: [string, string][] = [
    ["Opening float", r.opening_float],
    ["Cash sales", r.cash_sales],
    ["Cash refunds", `−${r.cash_refunds.replace(/^-/, "")}`],
    ["Paid in", r.paid_in],
    ["Paid out", `−${r.paid_out.replace(/^-/, "")}`],
  ];
  return (
    <div className="mx-auto w-full max-w-md">
      {/* Print only the receipt: hide the app chrome and everything marked print:hidden. */}
      <style>{`@media print { aside, header, nav, .fixed { display: none !important; } div.min-h-dvh { padding-left: 0 !important; } body { background: #fff !important; } #z-report { box-shadow: none !important; border: 0 !important; } }`}</style>
      <Card id="z-report" className="animate-pop overflow-hidden font-mono text-[13px] leading-relaxed">
        <div className="px-5 py-5">
          <div className="text-center">
            <div className="text-lg font-bold">{businessName}</div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Z-report · end of shift</div>
          </div>
          <Rule />
          <dl className="space-y-0.5">
            <Line k="Opened" v={`${fmtDate(r.opened_at)} · ${r.opened_by}`} stack />
            <Line k="Closed" v={`${fmtDate(data.closedAt)} · ${data.closedBy}`} stack />
            <Line k="Orders" v={String(r.orders)} />
          </dl>
          <Rule />
          <dl className="space-y-0.5">
            {rows.map(([k, v]) => (
              <Line key={k} k={k} v={v} />
            ))}
            <Line k="Card sales (simulated)" v={r.card_sales} muted />
            <Line k="Tips" v={r.tips} muted />
          </dl>
          <Rule />
          <dl className="space-y-0.5">
            <Line k="Expected cash" v={r.expected_cash} bold />
            <Line k="Counted cash" v={r.counted_cash} bold />
          </dl>
          <div className={cx("mt-3 rounded-xl px-3 py-3 text-center", diff === 0 ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
            <div className="text-xs font-semibold uppercase tracking-widest">{diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short"}</div>
            <div className="text-2xl font-bold tabular">{diff === 0 ? r.over_short : `${diff > 0 ? "+" : ""}${r.over_short}`}</div>
          </div>
          <Rule />
          <div className="grid grid-cols-2 gap-6 pt-6 text-center text-[11px] text-muted">
            <div className="border-t border-line pt-1">Counted by</div>
            <div className="border-t border-line pt-1">Checked by</div>
          </div>
        </div>
      </Card>
      <div className="mt-3 flex gap-2 print:hidden">
        <Button variant="primary" className="flex-1" onClick={() => window.print()}>
          🖨 Print Z-report
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Rule() {
  return <div className="my-3 border-t border-dashed border-line" aria-hidden />;
}

function Line({ k, v, bold, muted, stack }: { k: string; v: string; bold?: boolean; muted?: boolean; stack?: boolean }) {
  return (
    <div className={cx("flex gap-3", stack ? "flex-col sm:flex-row sm:justify-between" : "justify-between", bold && "font-bold", muted && "text-muted")}>
      <dt>{k}</dt>
      <dd className="tabular sm:text-right">{v}</dd>
    </div>
  );
}
