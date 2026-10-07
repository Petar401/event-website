"use client";

import { useMemo, useState } from "react";
import type { ModifierGroup, Product } from "@/lib/domain/types";
import { haptic } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Button, Input, Sheet, cx } from "../ui";

interface Props {
  product: Product | null;
  groups: ModifierGroup[];
  onClose: () => void;
  onAdd: (productId: string, qty: number, modifierIds: string[], note?: string) => void;
}

export function ModifierSheet({ product, groups, onClose, onAdd }: Props) {
  if (!product) return null;
  return <Inner key={product.id} product={product} groups={groups.filter((g) => product.modifierGroupIds.includes(g.id))} onClose={onClose} onAdd={onAdd} />;
}

const isRadio = (g: ModifierGroup) => g.max === 1 && g.min >= 1;

function Inner({ product, groups, onClose, onAdd }: { product: Product; groups: ModifierGroup[]; onClose: () => void; onAdd: Props["onAdd"] }) {
  const { money } = usePos();
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.modifiers.slice(0, g.min).map((m) => m.id)])),
  );
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const toggle = (g: ModifierGroup, id: string) => {
    haptic(4);
    setPicked((cur) => {
      const sel = cur[g.id] ?? [];
      if (isRadio(g)) return { ...cur, [g.id]: [id] };
      if (sel.includes(id)) return { ...cur, [g.id]: sel.filter((x) => x !== id) };
      if (sel.length >= g.max) return g.max === 1 ? { ...cur, [g.id]: [id] } : cur;
      return { ...cur, [g.id]: [...sel, id] };
    });
  };

  const modifierIds = groups.flatMap((g) => picked[g.id] ?? []);
  const unit = useMemo(
    () => product.price + groups.flatMap((g) => g.modifiers).filter((m) => modifierIds.includes(m.id)).reduce((s, m) => s + m.price, 0),
    [product.price, groups, modifierIds],
  );
  const valid = groups.every((g) => (picked[g.id]?.length ?? 0) >= g.min);

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {product.emoji}
          </span>
          <span className="leading-tight">
            {product.name}
            <span className="block text-sm font-medium text-muted tabular">{money(product.price)}</span>
          </span>
        </span>
      }
      footer={
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            onAdd(product.id, qty, modifierIds, note);
            onClose();
          }}
        >
          Add to order · {money(unit * qty)}
        </Button>
      }
    >
      <div className="space-y-5">
        {product.description ? <p className="text-sm text-muted">{product.description}</p> : null}
        {groups.map((g) => {
          const sel = picked[g.id] ?? [];
          const radio = isRadio(g);
          return (
            <fieldset key={g.id}>
              <legend className="mb-2 flex w-full items-center justify-between">
                <span className="text-sm font-bold">{g.name}</span>
                <span className="text-xs font-medium text-muted">{g.min >= 1 ? "Required" : g.max > 1 ? `Optional · up to ${g.max}` : "Optional"}</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {g.modifiers.map((m) => {
                  const on = sel.includes(m.id);
                  const locked = !on && !radio && g.max > 1 && sel.length >= g.max;
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(g, m.id)}
                      disabled={locked}
                      role={radio ? "radio" : "checkbox"}
                      aria-checked={on}
                      className={cx(
                        "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition disabled:opacity-40",
                        on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3",
                      )}
                    >
                      <span className={cx("grid size-5 shrink-0 place-items-center border-2 text-[11px]", radio ? "rounded-full" : "rounded-md", on ? "border-accent bg-accent text-accent-ink" : "border-muted/50")}>{on ? "✓" : ""}</span>
                      <span className="min-w-0 flex-1 leading-tight">{m.name}</span>
                      {m.price ? <span className="shrink-0 text-xs tabular opacity-80">+{money(m.price)}</span> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold">Quantity</span>
          <Stepper value={qty} onChange={setQty} />
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the kitchen (e.g. no sugar)" maxLength={140} />
      </div>
    </Sheet>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 p-1">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid size-11 place-items-center rounded-full bg-surface text-xl font-bold shadow-sm transition active:scale-95 disabled:opacity-40" aria-label="Decrease">
        −
      </button>
      <span className="w-10 text-center text-lg font-bold tabular">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="grid size-11 place-items-center rounded-full bg-surface text-xl font-bold shadow-sm transition active:scale-95" aria-label="Increase">
        +
      </button>
    </div>
  );
}
