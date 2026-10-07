// Money helpers. Everything is integer cents; rounding happens once, at the edges.

export function formatMoney(cents: number, currency = "EUR", locale = "en-IE"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Parse "4.50", "4,50", "€4.50" or a number of euros into cents. */
export function toCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** VAT contained in a VAT-inclusive gross amount. */
export function inclusiveTax(gross: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round((gross * rate) / (1 + rate));
}

export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

/** Split an amount into n parts that sum exactly to the amount (remainder goes to the first parts). */
export function splitEvenly(amount: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const base = Math.floor(amount / n);
  let remainder = amount - base * n;
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

/** Allocate `total` across `weights` proportionally, with exact sum (largest remainder method). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/** Quick cash buttons: exact, then next round notes above the amount. */
export function quickCashOptions(amount: number): number[] {
  const notes = [500, 1000, 2000, 5000, 10000];
  const opts = new Set<number>([amount]);
  const roundUp = Math.ceil(amount / 100) * 100;
  if (roundUp > amount) opts.add(roundUp);
  for (const n of notes) if (n > amount) opts.add(Math.ceil(amount / n) * n);
  return [...opts].sort((a, b) => a - b).slice(0, 4);
}
