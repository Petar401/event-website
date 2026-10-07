"use client";

import { useState } from "react";
import { usePos } from "@/lib/client/pos-context";
import { PageHeader, Segmented } from "@/components/ui";
import { CatalogTab } from "@/components/inventory/catalog-tab";
import { PurchaseOrdersTab } from "@/components/inventory/po-tab";
import { StockTab } from "@/components/inventory/stock-tab";

type Tab = "stock" | "po" | "catalog";

export default function InventoryPage() {
  const { session } = usePos();
  const canManage = session.role !== "cashier";
  const [tab, setTab] = useState<Tab>("stock");

  const options: { value: Tab; label: string }[] = [
    { value: "stock", label: "Stock" },
    ...(canManage ? [{ value: "po" as const, label: "Purchase orders" }] : []),
    { value: "catalog", label: "Catalog" },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-6">
      <PageHeader title="Inventory" subtitle="Stock levels, reorders and your catalog. Updates live as items sell." />
      <div className="px-4 pb-4 sm:px-6">
        <Segmented value={tab} onChange={setTab} options={options} className="max-w-full overflow-x-auto no-scrollbar" />
      </div>
      <div className="px-4 sm:px-6">
        {tab === "stock" ? <StockTab canManage={canManage} /> : null}
        {tab === "po" ? <PurchaseOrdersTab canManage={canManage} /> : null}
        {tab === "catalog" ? <CatalogTab canManage={canManage} /> : null}
      </div>
    </div>
  );
}
