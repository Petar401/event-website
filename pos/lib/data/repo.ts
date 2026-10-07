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
  OrderStatus,
  Product,
  PurchaseOrder,
  Settings,
  Shift,
  Staff,
} from "../domain/types";

export interface OrderQuery {
  status?: OrderStatus[];
  since?: string; // ISO; filters on createdAt
  tableId?: string;
  customerId?: string;
  limit?: number;
}

/** Storage boundary. Two implementations: in-memory demo and Supabase. Domain logic never lives here. */
export interface Repo {
  readonly mode: "demo" | "supabase";

  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;

  listStaff(): Promise<Staff[]>;
  saveStaff(s: Staff): Promise<void>;

  getCatalog(): Promise<{ categories: Category[]; modifierGroups: ModifierGroup[]; products: Product[] }>;
  saveProduct(p: Product): Promise<void>;

  listTables(): Promise<DiningTable[]>;

  listOrders(q?: OrderQuery): Promise<Order[]>; // newest first
  getOrder(idOrNumber: string): Promise<Order | null>;
  saveOrder(o: Order): Promise<void>;
  nextOrderNumber(): Promise<number>;

  listCustomers(search?: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  saveCustomer(c: Customer): Promise<void>;

  getGiftCard(code: string): Promise<GiftCard | null>;
  saveGiftCard(g: GiftCard): Promise<void>;

  currentShift(): Promise<Shift | null>;
  listShifts(limit?: number): Promise<Shift[]>;
  saveShift(s: Shift): Promise<void>;

  listPurchaseOrders(): Promise<PurchaseOrder[]>;
  savePurchaseOrder(po: PurchaseOrder): Promise<void>;
  nextPurchaseOrderNumber(): Promise<number>;

  listApprovals(status?: Approval["status"]): Promise<Approval[]>;
  getApproval(id: string): Promise<Approval | null>;
  saveApproval(a: Approval): Promise<void>;

  appendAudit(e: AuditEntry): Promise<void>;
  listAudit(limit?: number): Promise<AuditEntry[]>;

  listApiKeys(): Promise<ApiKeyRecord[]>;
  getApiKey(id: string): Promise<ApiKeyRecord | null>;
  saveApiKey(k: ApiKeyRecord): Promise<void>;

  getIdempotent(key: string): Promise<unknown | undefined>;
  setIdempotent(key: string, value: unknown): Promise<void>;

  /** True when the backing store has no catalog yet (fresh Supabase project). */
  isEmpty(): Promise<boolean>;
  /** Load the full seed (used by the "Seed demo data" button on a fresh Supabase project). */
  importSeed(seed: import("./seed").SeedState): Promise<void>;
}
