// Fuzzy resolvers so agents can say "flat white", "table 4" or "Maria" instead of opaque IDs.
import { DomainError } from "../domain/order";
import type { Customer, DiningTable, ModifierGroup, Order, Product } from "../domain/types";
import type { Repo } from "../data/repo";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function score(query: string, candidate: string): number {
  const q = norm(query);
  const c = norm(candidate);
  if (!q) return 0;
  if (q === c) return 100;
  if (c.startsWith(q)) return 80;
  if (c.includes(q)) return 60;
  const qWords = q.split(" ");
  const hits = qWords.filter((w) => c.includes(w.replace(/s$/, ""))).length;
  return hits ? (hits / qWords.length) * 50 : 0;
}

export function resolveProduct(ref: string, products: Product[]): Product {
  const exact = products.find((p) => p.id === ref || p.sku.toLowerCase() === ref.toLowerCase() || p.barcode === ref);
  if (exact) return exact;
  const ranked = products.map((p) => ({ p, s: score(ref, p.name) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) throw new DomainError(`No product matches "${ref}". Use search_catalog to look it up.`, "not_found");
  if (ranked.length > 1 && ranked[0].s === ranked[1].s && ranked[0].s < 100) {
    throw new DomainError(`"${ref}" is ambiguous: ${ranked.slice(0, 4).map((x) => x.p.name).join(", ")}`, "ambiguous");
  }
  return ranked[0].p;
}

export function resolveModifiers(refs: string[] | undefined, product: Product, groups: ModifierGroup[]): string[] {
  if (!refs?.length) return [];
  const available = groups.filter((g) => product.modifierGroupIds.includes(g.id)).flatMap((g) => g.modifiers);
  return refs.map((ref) => {
    const m =
      available.find((x) => x.id === ref) ??
      available
        .map((x) => ({ x, s: Math.max(score(ref, x.name), score(ref.replace(/\bmilk\b/i, ""), x.name)) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)[0]?.x;
    if (!m) throw new DomainError(`"${ref}" isn't an option for ${product.name}. Options: ${available.map((a) => a.name).join(", ") || "none"}`, "invalid_modifier");
    return m.id;
  });
}

export function resolveTable(ref: string | undefined, tables: DiningTable[]): DiningTable | undefined {
  if (!ref) return undefined;
  const clean = ref.replace(/^table\s*/i, "").trim().toLowerCase();
  const t = tables.find((x) => x.id === ref || x.name.toLowerCase() === clean || x.id === `tb_${clean}`);
  if (!t) throw new DomainError(`No table "${ref}". Tables: ${tables.map((x) => x.name).join(", ")}`, "not_found");
  return t;
}

export async function resolveCustomer(ref: string | undefined, repo: Repo): Promise<Customer | undefined> {
  if (!ref) return undefined;
  const byId = await repo.getCustomer(ref);
  if (byId) return byId;
  const matches = await repo.listCustomers(ref);
  if (matches.length === 0) throw new DomainError(`No customer matches "${ref}". Use add_customer to create one.`, "not_found");
  const exact = matches.filter((c) => norm(c.name) === norm(ref) || c.email?.toLowerCase() === ref.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (matches.length > 1) throw new DomainError(`"${ref}" matches several customers: ${matches.slice(0, 5).map((c) => `${c.name} (${c.id})`).join(", ")}`, "ambiguous");
  return matches[0];
}

export async function requireOrder(ref: string, repo: Repo): Promise<Order> {
  const o = await repo.getOrder(ref);
  if (!o) throw new DomainError(`Order ${ref} not found`, "not_found");
  return o;
}

/** Customer/product free text is untrusted when shown to a model — mark it as data, never instructions. */
export const untrusted = (s: string | undefined) => (s ? `«${s.replace(/[«»]/g, "")}»` : undefined);
