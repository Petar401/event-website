import type { Order } from "../domain/types";
import type { OrderQuery, Repo } from "./repo";
import { buildSeed, type SeedState } from "./seed";

const clone = <T,>(v: T): T => structuredClone(v);

/**
 * In-memory store used when Supabase isn't configured. Lives for the lifetime of the server
 * instance (on Vercel: until the function instance is recycled). Great for demos; not durable.
 */
export class DemoRepo implements Repo {
  readonly mode = "demo" as const;
  private s: SeedState;
  private idem = new Map<string, unknown>();
  private apiKeys = new Map<string, import("../domain/types").ApiKeyRecord>();

  constructor(seed: SeedState = buildSeed()) {
    this.s = seed;
  }

  async getSettings() {
    return clone(this.s.settings);
  }
  async saveSettings(v: SeedState["settings"]) {
    this.s.settings = clone(v);
  }
  async listStaff() {
    return clone(this.s.staff);
  }
  async saveStaff(v: SeedState["staff"][number]) {
    this.upsert(this.s.staff, v);
  }
  async getCatalog() {
    return clone({ categories: this.s.categories, modifierGroups: this.s.modifierGroups, products: this.s.products });
  }
  async saveProduct(p: SeedState["products"][number]) {
    this.upsert(this.s.products, p);
  }
  async listTables() {
    return clone(this.s.tables);
  }

  async listOrders(q: OrderQuery = {}) {
    let out = this.s.orders;
    if (q.status) out = out.filter((o) => q.status!.includes(o.status));
    if (q.since) out = out.filter((o) => o.createdAt >= q.since!);
    if (q.tableId) out = out.filter((o) => o.tableId === q.tableId);
    if (q.customerId) out = out.filter((o) => o.customerId === q.customerId);
    out = [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return clone(q.limit ? out.slice(0, q.limit) : out);
  }
  async getOrder(idOrNumber: string) {
    const n = Number(idOrNumber.replace(/^#/, ""));
    const o = this.s.orders.find((x) => x.id === idOrNumber || (Number.isFinite(n) && x.number === n));
    return o ? clone(o) : null;
  }
  async saveOrder(o: Order) {
    this.upsert(this.s.orders, o);
  }
  async nextOrderNumber() {
    return Math.max(1000, ...this.s.orders.map((o) => o.number)) + 1;
  }

  async listCustomers(search?: string) {
    const q = search?.toLowerCase().trim();
    const out = q
      ? this.s.customers.filter((c) => [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)))
      : this.s.customers;
    return clone([...out].sort((a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? "")));
  }
  async getCustomer(id: string) {
    return clone(this.s.customers.find((c) => c.id === id) ?? null);
  }
  async saveCustomer(c: SeedState["customers"][number]) {
    this.upsert(this.s.customers, c);
  }

  async getGiftCard(code: string) {
    return clone(this.s.giftCards.find((g) => g.code.toUpperCase() === code.toUpperCase()) ?? null);
  }
  async saveGiftCard(g: SeedState["giftCards"][number]) {
    const i = this.s.giftCards.findIndex((x) => x.code === g.code);
    if (i >= 0) this.s.giftCards[i] = clone(g);
    else this.s.giftCards.push(clone(g));
  }

  async currentShift() {
    return clone(this.s.shifts.find((s) => !s.closedAt) ?? null);
  }
  async listShifts(limit = 20) {
    return clone([...this.s.shifts].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, limit));
  }
  async saveShift(s: SeedState["shifts"][number]) {
    this.upsert(this.s.shifts, s);
  }

  async listPurchaseOrders() {
    return clone([...this.s.purchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  async savePurchaseOrder(po: SeedState["purchaseOrders"][number]) {
    this.upsert(this.s.purchaseOrders, po);
  }
  async nextPurchaseOrderNumber() {
    return Math.max(40, ...this.s.purchaseOrders.map((p) => p.number)) + 1;
  }

  async listApprovals(status?: SeedState["approvals"][number]["status"]) {
    const out = status ? this.s.approvals.filter((a) => a.status === status) : this.s.approvals;
    return clone([...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  async getApproval(id: string) {
    return clone(this.s.approvals.find((a) => a.id === id) ?? null);
  }
  async saveApproval(a: SeedState["approvals"][number]) {
    this.upsert(this.s.approvals, a);
  }

  async appendAudit(e: SeedState["audit"][number]) {
    this.s.audit.push(clone(e));
    if (this.s.audit.length > 2000) this.s.audit.splice(0, this.s.audit.length - 2000);
  }
  async listAudit(limit = 100) {
    return clone([...this.s.audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit));
  }

  async listApiKeys() {
    return clone([...this.apiKeys.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  async getApiKey(id: string) {
    return clone(this.apiKeys.get(id) ?? null);
  }
  async saveApiKey(k: import("../domain/types").ApiKeyRecord) {
    this.apiKeys.set(k.id, clone(k));
  }

  async getIdempotent(key: string) {
    return this.idem.get(key);
  }
  async setIdempotent(key: string, value: unknown) {
    this.idem.set(key, value);
    if (this.idem.size > 5000) this.idem.delete(this.idem.keys().next().value!);
  }

  async isEmpty() {
    return this.s.products.length === 0;
  }
  async importSeed(seed: SeedState) {
    this.s = seed;
  }

  private upsert<T extends { id: string }>(arr: T[], v: T) {
    const i = arr.findIndex((x) => x.id === v.id);
    if (i >= 0) arr[i] = clone(v);
    else arr.push(clone(v));
  }
}
