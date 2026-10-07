"use client";

import { useState } from "react";
import { tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { Shift } from "@/lib/domain/types";
import { Empty, PageHeader, Spinner } from "@/components/ui";
import type { ShiftReport, ZReport } from "@/components/shifts/act";
import { CloseSheet } from "@/components/shifts/close-sheet";
import { ShiftHistory } from "@/components/shifts/history";
import { MovementSheet, type MovementType } from "@/components/shifts/movement-sheet";
import { OpenDrawer } from "@/components/shifts/open-drawer";
import { EventsTimeline, ShiftSummary } from "@/components/shifts/summary";
import { ZReportCard, type ZReportData } from "@/components/shifts/z-report";

export default function ShiftsPage() {
  const { session, snapshot } = usePos();
  const canClose = session.role !== "cashier";

  const summary = useLiveData(() => tool<ShiftReport>("shift_summary", {}));
  const history = useLiveData(() => tool<Shift[]>("list_shifts", { limit: 10 }));

  const [movement, setMovement] = useState<MovementType | null>(null);
  const [closing, setClosing] = useState(false);
  const [z, setZ] = useState<ZReportData | null>(null);

  const report = summary.data;
  const shift = snapshot?.shift ?? null;
  const loading = summary.loading && !report;

  const reload = () => {
    summary.reload();
    history.reload();
  };

  return (
    <div className="mx-auto max-w-5xl pb-6">
      <div className="print:hidden">
        <PageHeader title="Cash drawer" subtitle={report?.open ? "Shift in progress. Everything updates live." : "Open the drawer to start taking cash."} />
      </div>

      <div className="space-y-5 px-4 sm:px-6">
        {z ? (
          <ZReportCard
            data={z}
            businessName={snapshot?.settings.businessName ?? "Tilda"}
            onDismiss={() => {
              setZ(null);
              reload();
            }}
          />
        ) : null}

        {summary.error && !report ? <Empty icon="⚠️" title="Couldn't load the drawer">{summary.error}</Empty> : null}

        {loading ? (
          <div className="grid place-items-center py-16">
            <Spinner className="size-6 text-accent" />
          </div>
        ) : null}

        {!z && report && !report.open ? <OpenDrawer onOpened={reload} /> : null}

        {report?.open && !z ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ShiftSummary report={report} canClose={canClose} onMove={setMovement} onClose={() => setClosing(true)} />
            {shift ? <EventsTimeline shift={shift} /> : null}
          </div>
        ) : null}

        <div className="print:hidden">{history.data ? <ShiftHistory shifts={history.data} /> : null}</div>
      </div>

      <MovementSheet type={movement} onClose={() => setMovement(null)} />
      <CloseSheet
        open={closing}
        expectedCents={report?.open ? report.expected_cash_cents : 0}
        onClose={() => setClosing(false)}
        onClosed={(r: ZReport) => {
          setClosing(false);
          setZ({ report: r, closedAt: new Date().toISOString(), closedBy: session.name });
          reload();
        }}
      />
    </div>
  );
}
