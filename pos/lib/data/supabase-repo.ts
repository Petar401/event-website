import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  ApiKeyRecord,
  Approval,
  AuditEntry,
  Category,
  Customer,
  DiningTable,
  GiftCard,
  ModifierGroup,
  Order,
  Product,
  PurchaseOrder,
  Settings,
  Shift,
  Staff,
} from "../domain/types";
import type { OrderQuery, Repo } from "./repo";
import { DEFAULT_SETTINGS, type SeedState } from "./seed";

type Row = { data: unknown };

/** Supabase-backed repository. Server-only: uses the service-role key. */
export class SupabaseRepo implements Repo {
  readonly mode = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private async all<T>(table: string, build?: (q: any) => any): Promise<T[]> {
    let q = this.db.from(table).select("data");
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data as Row[]).map((r) => r.data as T);
  }

  private async one<T>(table: string, column: string, value: string): Promise<T | null> {
    const { data, error } = await this.db.from(table).select("data").eq(column, value).maybeSingle();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ? ((data as Row).data as T) : null;
  }

  private async put(table: string, rows: Record<string, unknown> | Record<string, unknown>[], onConflict = "id") {
    const { error } = await this.db.from(table).upsert(rows, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  async getSettings() {
    return (await this.one<Settings>("settings", "id", "default")) ?? structuredClone(DEFAULT_SETTINGS);
  }
  async saveSettings(s: Settings) {
    await this.put("settings", { id: "default", data: s, updated_at: new Date().toISOString() });
  }

  async listStaff() {
    return this.all<Staff>("staff", (q) => q.order("name"));
  }
  async saveStaff(s: Staff) {
    await this.put("staff", staffRow(s));
  }

  async getCatalog() {
    const [categories, modifierGroups, products] = await Promise.all([
      this.all<Category>("categories", (q) => q.order("sort")),
      this.all<ModifierGroup>("modifier_groups"),
      this.all<Product>("products", (q) => q.order("name")),
    ]);
    return { categories, modifierGroups, products };
  }
  async saveProduct(p: Product) {
    await this.put("products", productRow(p));
  }

  async listTables() {
    return this.all<DiningTable>("dining_tables", (q) => q.order("id"));
  }

  async listOrders(q: OrderQuery = {}) {
    return this.all<Order>("orders", (b) => {
      let x = b.order("created_at", { ascending: false });
      if (q.status) x = x.in("status", q.status);
      if (q.since) x = x.gte("created_at", q.since);
      if (q.tableId) x = x.eq("table_id", q.tableId);
      if (q.customerId) x = x.eq("customer_id", q.customerId);
      return x.limit(q.limit ?? 5000);
    });
  }
  async getOrder(idOrNumber: string) {
    const n = Number(idOrNumber.replace(/^#/, ""));
    if (Number.isInteger(n) && n > 0) return this.one<Order>("orders", "number", String(n));
    return this.one<Order>("orders", "id", idOrNumber);
  }
  async saveOrder(o: Order) {
    await this.put("orders", orderRow(o));
  }
  async nextOrderNumber() {
    const { data, error } = await this.db.from("orders").select("number").order("number", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    return Math.max(1000, (data?.[0]?.number as number) ?? 1000) + 1;
  }

  async listCustomers(search?: string) {
    const s = search?.trim().replace(/[%,()]/g, "");
    return this.all<Customer>("customers", (q) => {
      let x = q.order("last_visit_at", { ascending: false, nullsFirst: false });
      if (s) x = x.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
      return x.limit(200);
    });
  }
  async getCustomer(id: string) {
    return this.one<Customer>("customers", "id", id);
  }
  async saveCustomer(c: Customer) {
    await this.put("customers", customerRow(c));
  }

  async getGiftCard(code: string) {
    return this.one<GiftCard>("gift_cards", "code", code.toUpperCase());
  }
  async saveGiftCard(g: GiftCard) {
    await this.put("gift_cards", { code: g.code.toUpperCase(), balance: g.balance, data: g, updated_at: new Date().toISOString() }, "code");
  }

  async currentShift() {
    const rows = await this.all<Shift>("shifts", (q) => q.is("closed_at", null).order("opened_at", { ascending: false }).limit(1));
    return rows[0] ?? null;
  }
  async listShifts(limit = 20) {
    return this.all<Shift>("shifts", (q) => q.order("opened_at", { ascending: false }).limit(limit));
  }
  async saveShift(s: Shift) {
    await this.put("shifts", shiftRow(s));
  }

  async listPurchaseOrders() {
    return this.all<PurchaseOrder>("purchase_orders", (q) => q.order("created_at", { ascending: false }).limit(200));
  }
  async savePurchaseOrder(po: PurchaseOrder) {
    await this.put("purchase_orders", poRow(po));
  }
  async nextPurchaseOrderNumber() {
    const { data, error } = await this.db.from("purchase_orders").select("number").order("number", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    return Math.max(40, (data?.[0]?.number as number) ?? 40) + 1;
  }

  async listApprovals(status?: Approval["status"]) {
    return this.all<Approval>("approvals", (q) => {
      let x = q.order("created_at", { ascending: false }).limit(200);
      if (status) x = x.eq("status", status);
      return x;
    });
  }
  async getApproval(id: string) {
    return this.one<Approval>("approvals", "id", id);
  }
  async saveApproval(a: Approval) {
    await this.put("approvals", approvalRow(a));
  }

  async appendAudit(e: AuditEntry) {
    await this.put("audit_log", auditRow(e));
  }
  async listAudit(limit = 100) {
    return this.all<AuditEntry>("audit_log", (q) => q.order("at", { ascending: false }).limit(limit));
  }

  async listApiKeys() {
    return this.all<ApiKeyRecord>("api_keys", (q) => q.order("created_at", { ascending: false }));
  }
  async getApiKey(id: string) {
    return this.one<ApiKeyRecord>("api_keys", "id", id);
  }
  async saveApiKey(k: ApiKeyRecord) {
    await this.put("api_keys", { id: k.id, kind: k.kind, revoked: k.revoked, created_at: k.createdAt, data: k, updated_at: new Date().toISOString() });
  }

  async getIdempotent(key: string) {
    const { data, error } = await this.db.from("idempotency_keys").select("result").eq("key", key).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? (data as { result: unknown }).result : undefined;
  }
  async setIdempotent(key: string, value: unknown) {
    await this.put("idempotency_keys", { key, result: value }, "key");
  }

  async isEmpty() {
    const { count, error } = await this.db.from("products").select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return (count ?? 0) === 0;
  }

  async importSeed(seed: SeedState) {
    const ts = new Date().toISOString();
    await this.saveSettings(seed.settings);
    await this.put("staff", seed.staff.map(staffRow));
    await this.put("categories", seed.categories.map((c) => ({ id: c.id, sort: c.sort, data: c, updated_at: ts })));
    await this.put("modifier_groups", seed.modifierGroups.map((g) => ({ id: g.id, data: g, updated_at: ts })));
    await this.put("products", seed.products.map(productRow));
    await this.put("dining_tables", seed.tables.map((t) => ({ id: t.id, data: t })));
    await this.put("customers", seed.customers.map(customerRow));
    for (const g of seed.giftCards) await this.saveGiftCard(g);
    for (let i = 0; i < seed.orders.length; i += 400) await this.put("orders", seed.orders.slice(i, i + 400).map(orderRow));
    if (seed.shifts.length) await this.put("shifts", seed.shifts.map(shiftRow));
    if (seed.purchaseOrders.length) await this.put("purchase_orders", seed.purchaseOrders.map(poRow));
    if (seed.approvals.length) await this.put("approvals", seed.approvals.map(approvalRow));
    if (seed.audit.length) await this.put("audit_log", seed.audit.map(auditRow));
  }
}

const now = () => new Date().toISOString();
const staffRow = (s: Staff) => ({ id: s.id, name: s.name, role: s.role, active: s.active, data: s, updated_at: now() });
const productRow = (p: Product) => ({
  id: p.id,
  category_id: p.categoryId,
  name: p.name,
  price: p.price,
  stock: p.stock,
  available: p.available,
  data: p,
  updated_at: now(),
});
const customerRow = (c: Customer) => ({
  id: c.id,
  name: c.name,
  email: c.email ?? null,
  phone: c.phone ?? null,
  points: c.points,
  last_visit_at: c.lastVisitAt ?? null,
  data: c,
  updated_at: now(),
});
const orderRow = (o: Order) => ({
  id: o.id,
  number: o.number,
  status: o.status,
  channel: o.channel,
  staff_id: o.staffId,
  table_id: o.tableId ?? null,
  customer_id: o.customerId ?? null,
  total: o.total,
  created_at: o.createdAt,
  closed_at: o.closedAt ?? null,
  data: o,
  updated_at: now(),
});
const shiftRow = (s: Shift) => ({ id: s.id, opened_at: s.openedAt, closed_at: s.closedAt ?? null, data: s, updated_at: now() });
const poRow = (po: PurchaseOrder) => ({
  id: po.id,
  number: po.number,
  status: po.status,
  supplier: po.supplier,
  created_at: po.createdAt,
  data: po,
  updated_at: now(),
});
const approvalRow = (a: Approval) => ({ id: a.id, status: a.status, tool: a.tool, created_at: a.createdAt, data: a, updated_at: now() });
const auditRow = (e: AuditEntry) => ({
  id: e.id,
  at: e.at,
  tool: e.tool,
  actor_type: e.actor.type,
  agent: e.actor.agent ?? null,
  outcome: e.outcome,
  data: e,
});
