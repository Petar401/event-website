"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { computeTotals, lineTotal } from "@/lib/domain/order";
import type { Order } from "@/lib/domain/types";
import { formatMoney } from "@/lib/domain/money";

/** Short plain-text receipt, small enough for a QR code. */
export function receiptText(order: Order, opts: { business: string; currency: string; locale: string }): string {
  const m = (c: number) => formatMoney(c, opts.currency, opts.locale);
  const t = computeTotals(order);
  const rows = order.lines.slice(0, 12).map((l) => `${l.qty}x ${l.name}  ${m(lineTotal(l))}`);
  if (order.lines.length > 12) rows.push(`+${order.lines.length - 12} more`);
  return [
    opts.business,
    `Order #${order.number} · ${new Date(order.createdAt).toLocaleString(opts.locale, { dateStyle: "medium", timeStyle: "short" })}`,
    ...rows,
    t.discountTotal ? `Discount -${m(t.discountTotal)}` : null,
    `TOTAL ${m(t.total)} (VAT incl. ${m(t.tax)})`,
    t.refunded ? `Refunded ${m(t.refunded)}` : null,
    "Thank you!",
  ]
    .filter(Boolean)
    .join("\n");
}

export function ReceiptQr({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 192, errorCorrectionLevel: "L" })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [text]);
  return (
    <div className="flex items-center gap-4">
      {/* QR codes need a light background in every theme to stay scannable */}
      <div className="grid size-28 shrink-0 place-items-center rounded-xl bg-white p-1">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Receipt QR code" className="size-full" />
        ) : (
          <span className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-r-transparent" />
        )}
      </div>
      <div className="min-w-0 text-sm text-muted">
        <div className="font-semibold text-ink">Digital receipt</div>
        Scan to see a plain-text copy of this receipt on the customer&apos;s phone.
      </div>
    </div>
  );
}
