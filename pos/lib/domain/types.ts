// Core domain types. All money is integer minor units (cents). Prices are VAT-inclusive.

export type Role = "owner" | "manager" | "cashier";
export type Station = "bar" | "kitchen" | "none";
export type AgentKind = "claude" | "chatgpt" | "perplexity" | "gemini" | "copilot" | "cursor" | "tilda" | "other";

export interface Staff {
  id: string;
  name: string;
  role: Role;
  pinHash: string;
  color: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  sort: number;
  station: Station;
  taxRate: number; // e.g. 0.1 for 10% VAT
}

export interface Modifier {
  id: string;
  name: string;
  price: number; // cents, may be 0
}

export interface ModifierGroup {
  id: string;
  name: string;
  min: number; // 0 = optional, 1 = required
  max: number; // 1 = single choice
  modifiers: Modifier[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  emoji: string;
  price: number;
  cost: number;
  sku: string;
  barcode?: string;
  available: boolean; // false = 86'd
  trackStock: boolean;
  stock: number;
  parLevel: number;
  reorderQty: number;
  supplier?: string;
  modifierGroupIds: string[];
  color: string; // tile accent
}

export interface Actor {
  type: "staff" | "agent";
  staffId: string; // the human the action is attributed to (agent acts on behalf of)
  name: string;
  role: Role;
  agent?: AgentKind;
  agentLabel?: string; // e.g. "Claude", "ChatGPT"
}

export interface LineModifier {
  id: string;
  name: string;
  price: number;
}

export interface OrderLine {
  id: string;
  productId: string;
  name: string;
  emoji: string;
  qty: number;
  unitPrice: number; // base product price
  modifiers: LineModifier[];
  note?: string;
  station: Station;
  taxRate: number;
  refundedQty: number;
}

export type TenderMethod = "cash" | "card" | "gift_card" | "points";

export interface Payment {
  id: string;
  method: TenderMethod;
  amount: number; // applied to the order (excludes change)
  tip: number;
  tendered?: number; // cash handed over
  change?: number;
  reference: string; // simulated processor ref / gift card code
  at: string;
}

export interface Refund {
  id: string;
  amount: number;
  reason: string;
  lines: { lineId: string; qty: number }[];
  restock: boolean;
  method: TenderMethod;
  at: string;
  by: string;
}

export type OrderStatus = "open" | "paid" | "refunded" | "partially_refunded" | "void";
export type TicketStatus = "new" | "preparing" | "ready" | "served";

export interface KitchenTicket {
  id: string;
  station: Station;
  lineIds: string[];
  status: TicketStatus;
  sentAt: string;
  updatedAt: string;
}

export interface Discount {
  kind: "percent" | "amount";
  value: number; // percent 0-100 or cents
  reason: string;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  channel: string; // "pos" | "agent:claude" | ...
  createdBy: string; // display name, e.g. "Maria" or "Claude (for Maria)"
  staffId: string;
  tableId?: string;
  customerId?: string;
  note?: string;
  lines: OrderLine[];
  discount?: Discount;
  payments: Payment[];
  refunds: Refund[];
  tickets: KitchenTicket[];
  // denormalised totals (recomputed on every save)
  subtotal: number;
  discountTotal: number;
  total: number;
  tax: number;
  tipTotal: number;
  paid: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  points: number;
  visits: number;
  totalSpent: number;
  tags: string[];
  note?: string;
  createdAt: string;
  lastVisitAt?: string;
}

export interface GiftCard {
  code: string;
  balance: number;
  initial: number;
  createdAt: string;
}

export interface DiningTable {
  id: string;
  name: string;
  seats: number;
  zone: string;
  x: number; // floor-plan grid position (0-11)
  y: number;
  shape: "round" | "square" | "long";
}

export interface CashEvent {
  id: string;
  type: "paid_in" | "paid_out" | "no_sale" | "cash_sale" | "cash_refund";
  amount: number;
  reason: string;
  at: string;
  by: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  openedBy: string;
  openingFloat: number;
  closedAt?: string;
  closedBy?: string;
  countedCash?: number;
  expectedCash?: number;
  events: CashEvent[];
}

export interface PurchaseOrderLine {
  productId: string;
  name: string;
  qty: number;
  cost: number;
}

export interface PurchaseOrder {
  id: string;
  number: number;
  supplier: string;
  status: "draft" | "sent" | "received" | "cancelled";
  lines: PurchaseOrderLine[];
  total: number;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  summary: string;
  reason: string;
  requestedBy: Actor;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
  result?: unknown;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: Actor;
  tool: string;
  summary: string;
  input: Record<string, unknown>;
  outcome: "ok" | "error" | "approval_required" | "dry_run";
  error?: string;
}

export interface ApiKeyRecord {
  id: string;
  kind: "api_key" | "oauth";
  name: string;
  prefix: string; // first chars shown in UI
  staffId: string;
  scopes: Scope[];
  agent: AgentKind;
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export type Scope = "pos:read" | "pos:write" | "pos:manage";

export interface Settings {
  businessName: string;
  currency: string; // ISO code
  locale: string;
  pointsPerCurrencyUnit: number; // points earned per 1.00 paid
  pointValue: number; // cents per point when redeemed
  approval: {
    refundOver: number; // cents; agent refunds above this need approval
    discountPercentOver: number;
    stockAdjustOver: number; // units
    priceChange: boolean; // agent price changes always need approval
    voidPaid: boolean;
  };
  tipPresets: number[]; // percents
}

export interface Snapshot {
  settings: Settings;
  categories: Category[];
  products: Product[];
  modifierGroups: ModifierGroup[];
  tables: DiningTable[];
  openOrders: Order[];
  staff: Pick<Staff, "id" | "name" | "role" | "color">[];
  pendingApprovals: number;
  shift: Shift | null;
  mode: "demo" | "supabase";
  serverTime: string;
}
