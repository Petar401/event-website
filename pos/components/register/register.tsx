"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/domain/types";
import { haptic } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Sheet, Spinner } from "../ui";
import { Catalog } from "./catalog";
import { CartBody, CartFooter } from "./cart";
import { ModifierSheet } from "./modifier-sheet";
import { PaySheet } from "./pay-sheet";
import { CustomerPicker, DiscountSheet, TablePicker } from "./pickers";
import { useRegister } from "./use-register";

export function Register() {
  const { money } = usePos();
  const r = useRegister();
  const { snapshot, addToCart, setPayInfo, payInfo } = r;

  const [modProduct, setModProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  const closeMods = useCallback(() => setModProduct(null), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeTables = useCallback(() => setTablesOpen(false), []);
  const closeCustomers = useCallback(() => setCustomersOpen(false), []);
  const closeDiscount = useCallback(() => setDiscountOpen(false), []);
  const closePay = useCallback(() => setPayInfo(null), [setPayInfo]);

  const onPick = useCallback(
    (p: Product) => {
      if (!p.available) return;
      if (p.modifierGroupIds.length > 0) {
        haptic(6);
        setModProduct(p);
      } else addToCart(p.id);
    },
    [addToCart],
  );
  const onScan = useCallback((p: Product) => addToCart(p.id), [addToCart]);

  // The pay sheet takes over from the phone cart sheet.
  useEffect(() => {
    if (payInfo) setCartOpen(false);
  }, [payInfo]);

  const modGroups = useMemo(() => snapshot?.modifierGroups ?? [], [snapshot?.modifierGroups]);

  if (!snapshot) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }

  const handlers = {
    onTable: () => setTablesOpen(true),
    onCustomer: () => setCustomersOpen(true),
    onDiscount: () => setDiscountOpen(true),
  };

  return (
    <div className="md:flex md:h-dvh">
      {/* Catalog */}
      <div className="min-w-0 pb-20 md:flex-1 md:overflow-y-auto md:pb-0">
        <Catalog products={snapshot.products} categories={snapshot.categories} cartQty={r.draftQtyByProduct} onPick={onPick} onScan={onScan} />
      </div>

      {/* Cart panel (tablet / desktop) */}
      <aside className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-surface md:flex lg:w-[400px]">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <CartBody r={r} onTable={handlers.onTable} onCustomer={handlers.onCustomer} />
        </div>
        <div className="border-t border-line bg-surface px-4 py-3">
          <CartFooter r={r} onDiscount={handlers.onDiscount} />
        </div>
      </aside>

      {/* Order bar (phone) */}
      {r.itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 px-4 pb-2 pr-[84px] md:hidden">
          <button
            onClick={() => {
              haptic(8);
              setCartOpen(true);
            }}
            className="flex h-14 w-full items-center justify-between gap-2 rounded-2xl bg-accent px-4 text-accent-ink shadow-card animate-pop active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="grid size-7 place-items-center rounded-full bg-black/15 text-xs tabular">{r.itemCount}</span>
              Order · {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
            </span>
            <span className="text-base font-black tabular">{money(r.totals.paid > 0 ? r.totals.balance : r.totals.total)}</span>
          </button>
        </div>
      ) : null}

      {/* Phone cart sheet */}
      <Sheet open={cartOpen} onClose={closeCart} title="Order" footer={<CartFooter r={r} onDiscount={handlers.onDiscount} />}>
        <CartBody r={r} onTable={handlers.onTable} onCustomer={handlers.onCustomer} />
      </Sheet>

      <ModifierSheet product={modProduct} groups={modGroups} onClose={closeMods} onAdd={addToCart} />
      <TablePicker open={tablesOpen} onClose={closeTables} tables={snapshot.tables} openOrders={snapshot.openOrders} currentTableId={r.table?.id ?? null} onPick={r.selectTable} />
      <CustomerPicker open={customersOpen} onClose={closeCustomers} onPick={r.selectCustomer} />
      <DiscountSheet open={discountOpen} onClose={closeDiscount} current={r.discount} onApply={r.applyDiscount} />

      {payInfo ? <PaySheet info={payInfo} customer={r.customer} onClose={closePay} onNewOrder={r.finishPayment} onPayment={() => { r.refreshCustomer(); }} /> : null}
    </div>
  );
}
