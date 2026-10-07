"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { percentOf, quickCashOptions, splitEvenly, toCents } from "@/lib/domain/money";
import type { Customer } from "@/lib/domain/types";
import { callTool, haptic, newKey } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Button, Input, Sheet, cx } from "../ui";
import type { PayInfo } from "./use-register";

type Method = "card" | "cash" | "split" | "gift" | "points";
type Tender = "card" | "cash" | "gift_card" | "points";

interface PaymentView {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  balance_cents: number;
  payment: { method: string; amount: string; change_cents?: number; reference: string };
}

interface Done {
  change: number;
  method: string;
  tips: number;
}

interface Props {
  info: PayInfo;
  customer: Customer | null;
  onClose: () => void;
  onNewOrder: () => void;
  onPayment: () => void;
}

/** Keep the latest value in a ref so stable callbacks can read it. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function PaySheet(props: Props) {
  const { info, customer, onClose, onNewOrder, onPayment } = props;
  const { snapshot, money, toast } = usePos();
  const settings = snapshot?.settings;
  const presets = settings?.tipPresets ?? [0, 10, 15, 20];

  const [balance, setBalance] = useState(info.balanceCents);
  const [method, setMethod] = useState<Method>("card");
  const [tipMode, setTipMode] = useState<number | "custom">(presets[0] ?? 0);
  const [customTip, setCustomTip] = useState("");
  const [tendered, setTendered] = useState<number | null>(null);
  const [keypad, setKeypad] = useState(false);
  const [keys, setKeys] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [splitN, setSplitN] = useState(2);
  const [split, setSplit] = useState<{ n: number; parts: number[]; guest: number } | null>(null);
  const [splitMethod, setSplitMethod] = useState<"card" | "cash">("card");
  const [reading, setReading] = useState<null | { amount?: number; tip: number; splitPart: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [pointsUsed, setPointsUsed] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [paidLines, setPaidLines] = useState<string[]>([]);
  const idemKey = useRef(newKey());
  const tipsRef = useRef(0);

  const doneRef = useLatest(done);
  const onCloseRef = useLatest(onClose);
  const onNewRef = useLatest(onNewOrder);
  const handleClose = useCallback(() => (doneRef.current ? onNewRef.current() : onCloseRef.current()), [doneRef, onCloseRef, onNewRef]);

  // What this individual payment is worth (a split part, or the whole balance).
  const splitting = method === "split" && split !== null;
  const amount = splitting && split ? (split.guest === split.n - 1 ? balance : Math.min(split.parts[split.guest], balance)) : balance;
  const tip = tipMode === "custom" ? toCents(customTip || "0") : percentOf(amount, tipMode);
  const tipApplies = method === "card" || method === "cash" || splitting;
  const effectiveTip = tipApplies ? tip : 0;
  const payingMethod: "card" | "cash" | null = method === "card" || method === "cash" ? method : splitting ? splitMethod : null;

  const pointsAvailable = !!customer && customer.points > 0 && !pointsUsed;
  const pointsValue = customer ? customer.points * (settings?.pointValue ?? 1) : 0;

  const due = amount + effectiveTip;
  const cashOptions = useMemo(() => quickCashOptions(due), [due]);
  const cashGiven = keypad ? (keys ? toCents(keys) : null) : (tendered ?? due);
  const cashShort = cashGiven === null || cashGiven < due;

  // ---- take payment ----------------------------------------------------------------------------
  const takePayment = useCallback(
    async (m: Tender, o: { amount?: number; tip: number; tendered?: number; giftCode?: string; splitPart?: boolean }) => {
      setBusy(true);
      const r = await callTool<PaymentView>("take_payment", {
        order: info.id,
        method: m,
        amount_cents: o.amount,
        tip_cents: o.tip,
        tendered_cents: o.tendered,
        gift_card_code: o.giftCode,
        idempotency_key: idemKey.current,
      });
      setBusy(false);
      if (!r.ok) {
        toast({ title: "Payment didn't go through", body: r.error, tone: "bad" });
        return false;
      }
      idemKey.current = newKey();
      const v = r.data as PaymentView;
      tipsRef.current += o.tip;
      haptic(25);
      onPayment();
      if (m === "points") setPointsUsed(true);
      const label = `${v.payment.amount} by ${m === "gift_card" ? "gift card" : m}`;
      setPaidLines((l) => [...l, label]);
      setBalance(v.balance_cents);
      setKeypad(false);
      setKeys("");
      setTendered(null);
      if (v.balance_cents <= 0 || v.status === "paid") {
        setDone({ change: v.payment.change_cents ?? 0, method: m, tips: tipsRef.current });
        return true;
      }
      if (o.splitPart) setSplit((s) => (s ? { ...s, guest: Math.min(s.n - 1, s.guest + 1) } : s));
      toast({ title: `${v.payment.amount} paid by ${m === "gift_card" ? "gift card" : m}`, body: `${money(v.balance_cents)} still to pay`, tone: "ok" });
      return true;
    },
    [info.id, onPayment, toast, money],
  );
  const takeRef = useLatest(takePayment);

  // Simulated card reader: ~1.2s of "tap, insert or swipe", then the real (simulated) tool call.
  useEffect(() => {
    if (!reading) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      await takeRef.current("card", { amount: reading.amount, tip: reading.tip, splitPart: reading.splitPart });
      if (!cancelled) setReading(null);
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [reading, takeRef]);

  // ---- main action per method ------------------------------------------------------------------
  const partAmount = splitting ? amount : undefined;
  const action = (() => {
    if (method === "card" || (splitting && splitMethod === "card")) {
      return { label: splitting ? `Guest ${split!.guest + 1} pays ${money(due)} by card` : `Pay ${money(due)} by card`, disabled: false, run: () => { haptic(15); setReading({ amount: partAmount, tip: effectiveTip, splitPart: splitting }); } };
    }
    if (method === "cash" || (splitting && splitMethod === "cash")) {
      return {
        label: cashShort ? (cashGiven === null ? "Enter the amount received" : `Short by ${money(due - cashGiven)}`) : `Take cash${cashGiven! > due ? ` · change ${money(cashGiven! - due)}` : ""}`,
        disabled: cashShort,
        run: () => takePayment("cash", { amount: partAmount, tip: effectiveTip, tendered: cashGiven ?? undefined, splitPart: splitting }),
      };
    }
    if (method === "split" && !split) {
      return {
        label: `Start split · ${splitN} × ${money(Math.round(balance / splitN))}`,
        disabled: false,
        run: () => {
          haptic(10);
          setSplit({ n: splitN, parts: splitEvenly(balance, splitN), guest: 0 });
        },
      };
    }
    if (method === "gift") {
      return { label: "Redeem gift card", disabled: giftCode.trim().length < 4, run: () => takePayment("gift_card", { tip: 0, giftCode: giftCode.trim().toUpperCase() }) };
    }
    if (method === "points") {
      return { label: `Redeem ${customer?.name ?? "customer"}'s points`, disabled: !pointsAvailable, run: () => takePayment("points", { tip: 0 }) };
    }
    return { label: "Pay", disabled: true, run: () => {} };
  })();

  // ---- success ---------------------------------------------------------------------------------
  if (done) {
    return (
      <Sheet open onClose={handleClose} title="Payment complete" footer={<Button variant="primary" size="xl" className="w-full" onClick={onNewOrder}>New order</Button>}>
        <Success info={info} customer={customer} done={done} lines={paidLines} />
      </Sheet>
    );
  }

  const methods: { id: Method; icon: string; label: string }[] = [
    { id: "card", icon: "💳", label: "Card" },
    { id: "cash", icon: "💶", label: "Cash" },
    { id: "split", icon: "➗", label: "Split" },
    { id: "gift", icon: "🎁", label: "Gift card" },
    ...(pointsAvailable ? [{ id: "points" as Method, icon: "⭐", label: "Points" }] : []),
  ];

  return (
    <Sheet
      open
      onClose={handleClose}
      title={
        <span>
          Charge · Order #{info.number}
          {info.table ? <span className="font-medium text-muted"> · Table {info.table}</span> : null}
        </span>
      }
      footer={
        reading ? (
          <Button size="lg" variant="secondary" className="w-full" onClick={() => setReading(null)} disabled={busy}>
            Cancel
          </Button>
        ) : (
          <Button size="xl" variant={method === "cash" || (splitting && splitMethod === "cash") ? "ok" : "primary"} className="w-full" disabled={action.disabled} loading={busy} onClick={action.run}>
            {action.label}
          </Button>
        )
      }
    >
      <style>{KEYFRAMES}</style>
      <div className="space-y-5">
        {/* Hero amount */}
        <div className="rounded-3xl bg-surface-2 px-4 py-5 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">{splitting ? `Guest ${split!.guest + 1} of ${split!.n}` : balance < info.totalCents ? "Balance due" : "Amount due"}</div>
          <div key={due} className="mt-1 text-5xl font-black tabular tracking-tight animate-pop sm:text-6xl">
            {money(due)}
          </div>
          <div className="mt-1 text-sm text-muted">
            {effectiveTip > 0 ? `${money(amount)} + ${money(effectiveTip)} tip` : splitting ? `of ${money(balance)} remaining` : `Total ${money(info.totalCents)}`}
            {balance < info.totalCents && !splitting ? ` · ${money(info.totalCents - balance)} paid` : ""}
          </div>
          {splitting ? (
            <div className="mx-auto mt-3 flex max-w-xs gap-1.5" aria-hidden>
              {Array.from({ length: split!.n }, (_, i) => (
                <span key={i} className={cx("h-1.5 flex-1 rounded-full transition", i < split!.guest ? "bg-ok" : i === split!.guest ? "bg-accent" : "bg-surface-3")} />
              ))}
            </div>
          ) : null}
        </div>

        {reading ? (
          <CardReader amount={due} busy={busy} />
        ) : (
          <>
            {/* Method tiles */}
            <div className={cx("grid gap-2", methods.length === 5 ? "grid-cols-5" : "grid-cols-4")} role="tablist">
              {methods.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={method === m.id}
                  onClick={() => {
                    haptic(6);
                    setMethod(m.id);
                    setKeypad(false);
                  }}
                  className={cx(
                    "flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-bold transition active:scale-95",
                    method === m.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3",
                  )}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {m.icon}
                  </span>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Tip */}
            {tipApplies ? (
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Tip</div>
                <div className="grid grid-cols-5 gap-2">
                  {presets.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        haptic(4);
                        setTipMode(p);
                      }}
                      className={cx("flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-bold leading-tight transition", tipMode === p ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2")}
                    >
                      {p === 0 ? "None" : `${p}%`}
                      {p > 0 ? <span className="text-[11px] font-medium tabular opacity-80">{money(percentOf(amount, p))}</span> : null}
                    </button>
                  ))}
                  <button
                    onClick={() => setTipMode("custom")}
                    className={cx("flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-bold transition", tipMode === "custom" ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2")}
                  >
                    Custom
                  </button>
                </div>
                {tipMode === "custom" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-bold text-muted">€</span>
                    <Input value={customTip} onChange={(e) => setCustomTip(e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))} inputMode="decimal" placeholder="0.00" aria-label="Custom tip in euros" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Method panel */}
            {method === "card" ? <p className="text-center text-sm text-muted">The card reader wakes up when you tap the button below.</p> : null}

            {payingMethod === "cash" ? (
              <CashPanel due={due} options={cashOptions} tendered={cashGiven} selected={keypad ? null : (tendered ?? due)} keypad={keypad} keys={keys} onPick={(c) => { haptic(4); setKeypad(false); setTendered(c); }} onKeypad={() => { setKeypad(true); setKeys(""); }} onKeys={setKeys} />
            ) : null}

            {method === "split" ? (
              <SplitPanel
                balance={balance}
                n={splitN}
                onN={setSplitN}
                split={split}
                splitMethod={splitMethod}
                onMethod={(m) => { setSplitMethod(m); setKeypad(false); }}
                onReset={() => setSplit(null)}
                paidCount={paidLines.length}
              />
            ) : null}

            {method === "gift" ? (
              <div className="space-y-3">
                <Input value={giftCode} onChange={(e) => setGiftCode(e.target.value.toUpperCase())} placeholder="Gift card code" autoCapitalize="characters" autoComplete="off" className="text-center font-mono tracking-wider" aria-label="Gift card code" />
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
                  Demo codes
                  {["TILDA-GIFT-2500", "TILDA-GIFT-5000"].map((c) => (
                    <button key={c} onClick={() => setGiftCode(c)} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 font-mono font-semibold text-ink-2 hover:bg-surface-3">
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-muted">The card pays as much of the balance as it holds. Pay the rest with another method.</p>
              </div>
            ) : null}

            {method === "points" && customer ? (
              <div className="rounded-2xl border border-line bg-surface-2 p-4 text-center">
                <div className="text-3xl font-black tabular text-accent">{customer.points} pts</div>
                <div className="mt-1 text-sm text-muted">
                  {customer.name} can redeem up to <span className="font-semibold text-ink">{money(Math.min(pointsValue, balance))}</span> on this order.
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

const KEYFRAMES = `
@keyframes reg-draw { to { stroke-dashoffset: 0; } }
@keyframes reg-ring { 0% { transform: scale(0.55); opacity: 0.7; } 100% { transform: scale(1.5); opacity: 0; } }
@keyframes reg-float { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-8px) rotate(-6deg); } }
@keyframes reg-confetti { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(0.6); opacity: 0; } }
@keyframes reg-scan { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(54px); opacity: 0; } }
`;

function CardReader({ amount, busy }: { amount: number; busy: boolean }) {
  const { money } = usePos();
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
      <div className="relative grid size-40 place-items-center">
        {[0, 0.4, 0.8].map((d) => (
          <span key={d} className="absolute inset-0 rounded-full border-2 border-accent/60" style={{ animation: `reg-ring 1.6s ${d}s ease-out infinite` }} />
        ))}
        <div className="relative grid h-24 w-36 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-card" style={{ animation: "reg-float 1.6s ease-in-out infinite" }}>
          <span className="absolute inset-x-0 top-4 h-1.5 bg-ink/80" aria-hidden />
          <span className="mt-3 text-4xl" aria-hidden>
            💳
          </span>
          <span className="absolute inset-x-3 top-2 h-0.5 rounded bg-accent" style={{ animation: "reg-scan 1.2s ease-in-out infinite" }} aria-hidden />
        </div>
      </div>
      <div>
        <div className="text-xl font-bold">{busy ? "Approving…" : "Tap, insert or swipe"}</div>
        <div className="mt-1 text-sm text-muted">Waiting for the card reader · {money(amount)}</div>
      </div>
    </div>
  );
}

function CashPanel({
  due,
  options,
  tendered,
  selected,
  keypad,
  keys,
  onPick,
  onKeypad,
  onKeys,
}: {
  due: number;
  options: number[];
  tendered: number | null;
  selected: number | null;
  keypad: boolean;
  keys: string;
  onPick: (cents: number) => void;
  onKeypad: () => void;
  onKeys: (k: string) => void;
}) {
  const { money } = usePos();
  const change = tendered !== null && tendered >= due ? tendered - due : null;

  const press = (k: string) => {
    haptic(4);
    if (k === "⌫") return onKeys(keys.slice(0, -1));
    if (k === ".") return keys.includes(".") ? undefined : onKeys((keys || "0") + ".");
    const next = keys + k;
    if (/^\d{0,5}(\.\d{0,2})?$/.test(next)) onKeys(next.replace(/^0+(\d)/, "$1"));
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">Cash received</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {options.map((c, i) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            className={cx("h-14 rounded-xl border text-lg font-bold tabular transition active:scale-95", selected === c ? "border-ok bg-ok-soft text-ok" : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3")}
          >
            {i === 0 && c === due ? "Exact" : money(c)}
          </button>
        ))}
        <button onClick={onKeypad} className={cx("h-14 rounded-xl border text-base font-bold transition active:scale-95", keypad ? "border-ok bg-ok-soft text-ok" : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3")}>
          Other…
        </button>
      </div>

      {keypad ? (
        <div className="rounded-2xl border border-line bg-surface-2 p-3">
          <div className="mb-2 text-center text-3xl font-black tabular">{keys ? `€${keys}` : <span className="text-muted">€0.00</span>}</div>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
              <button key={k} onClick={() => press(k)} className="h-14 rounded-xl bg-surface text-xl font-bold shadow-sm transition active:scale-95 active:bg-surface-3" aria-label={k === "⌫" ? "Backspace" : k}>
                {k}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cx("rounded-2xl px-4 py-3 text-center", change !== null ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted")}>
        {change !== null ? (
          <>
            <div className="text-xs font-bold uppercase tracking-wide">Change to give</div>
            <div key={change} className="text-3xl font-black tabular animate-pop">
              {money(change)}
            </div>
          </>
        ) : (
          <div className="text-sm font-medium">{tendered === null ? "Pick or enter the amount handed over" : `Needs ${money(due - tendered)} more`}</div>
        )}
      </div>
    </div>
  );
}

function SplitPanel({
  balance,
  n,
  onN,
  split,
  splitMethod,
  onMethod,
  onReset,
  paidCount,
}: {
  balance: number;
  n: number;
  onN: (n: number) => void;
  split: { n: number; parts: number[]; guest: number } | null;
  splitMethod: "card" | "cash";
  onMethod: (m: "card" | "cash") => void;
  onReset: () => void;
  paidCount: number;
}) {
  const { money } = usePos();
  if (!split) {
    const parts = splitEvenly(balance, n);
    return (
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">Split equally between</div>
        <div className="grid grid-cols-5 gap-2">
          {[2, 3, 4, 5, 6].map((k) => (
            <button key={k} onClick={() => { haptic(4); onN(k); }} className={cx("h-14 rounded-xl border text-xl font-bold transition active:scale-95", n === k ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2")}>
              {k}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {parts.map((p, i) => (
            <span key={i} className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold tabular text-ink-2">
              Guest {i + 1} · {money(p)}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">Guest {split.guest + 1} pays with</div>
      <div className="grid grid-cols-2 gap-2">
        {(["card", "cash"] as const).map((m) => (
          <button key={m} onClick={() => onMethod(m)} className={cx("h-14 rounded-xl border text-base font-bold transition active:scale-95", splitMethod === m ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-2")}>
            {m === "card" ? "💳 Card" : "💶 Cash"}
          </button>
        ))}
      </div>
      {paidCount === 0 ? (
        <button onClick={onReset} className="text-xs font-semibold text-muted underline underline-offset-2">
          Change number of guests
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------------------------

function Success({ info, customer, done, lines }: { info: PayInfo; customer: Customer | null; done: Done; lines: string[] }) {
  const { snapshot, money, toast } = usePos();
  const [qr, setQr] = useState<string | null>(null);
  const [email, setEmail] = useState(customer?.email ?? "");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    const text = [
      snapshot?.settings.businessName ?? "Tilda",
      `Order #${info.number} · ${new Date().toLocaleString(snapshot?.settings.locale ?? "en-IE", { dateStyle: "medium", timeStyle: "short" })}`,
      "",
      ...info.items.map((i) => `${i.qty}x ${i.name}  ${i.total}`),
      "",
      `TOTAL ${money(info.totalCents)}`,
      "Thank you!",
    ].join("\n");
    import("qrcode")
      .then((m) => m.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: "M" }))
      .then((url) => alive && setQr(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.number]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
        const d = 70 + ((i * 37) % 50);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - 10, r: (i * 53) % 360, c: ["var(--accent)", "var(--ok)", "var(--ai)", "var(--warn)"][i % 4], dly: (i % 5) * 0.03 };
      }),
    [],
  );

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <style>{KEYFRAMES}</style>
      <div className="relative grid size-28 place-items-center">
        {confetti.map((p, i) => (
          <span key={i} className="absolute left-1/2 top-1/2 size-2 rounded-sm" style={{ background: p.c, ["--x" as string]: `${p.x}px`, ["--y" as string]: `${p.y}px`, ["--r" as string]: `${p.r}deg`, animation: `reg-confetti 0.9s ${0.25 + p.dly}s ease-out forwards`, opacity: 0 }} aria-hidden />
        ))}
        <svg viewBox="0 0 52 52" className="size-28 animate-pop" aria-hidden>
          <circle cx="26" cy="26" r="24" fill="var(--ok-soft)" stroke="var(--ok)" strokeWidth="2.5" />
          <path d="M15 27.5l8 8 15-17" fill="none" stroke="var(--ok)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" strokeDashoffset="40" style={{ animation: "reg-draw 0.45s 0.25s ease-out forwards" }} />
        </svg>
      </div>

      <div>
        <div className="text-2xl font-black">Paid in full</div>
        <div className="mt-0.5 text-sm text-muted">
          Order #{info.number} · {money(info.totalCents)}
          {done.tips > 0 ? ` + ${money(done.tips)} tip` : ""}
        </div>
        {lines.length > 1 ? <div className="mt-1 text-xs text-muted">{lines.join(" · ")}</div> : null}
      </div>

      {done.change > 0 ? (
        <div className="w-full rounded-3xl bg-ok-soft px-4 py-5 text-ok">
          <div className="text-xs font-bold uppercase tracking-widest">Change due</div>
          <div className="text-6xl font-black tabular tracking-tight animate-pop">{money(done.change)}</div>
        </div>
      ) : null}

      <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:text-left">
        <div className="grid size-[148px] shrink-0 place-items-center rounded-2xl bg-white p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Receipt QR code" className="size-full" />
          ) : (
            <span className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-r-transparent" />
          )}
        </div>
        <div className="w-full min-w-0 flex-1 space-y-2">
          <div className="text-sm font-semibold">Scan for a digital receipt</div>
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); }} type="email" placeholder="customer@email.com" aria-label="Receipt email" />
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() => {
                haptic(10);
                setSent(true);
                toast({ title: "Receipt emailed", body: email ? `Sent to ${email}` : "Sent to the customer", tone: "ok" });
              }}
            >
              {sent ? "Sent ✓" : "Email"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
