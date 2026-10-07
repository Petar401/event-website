// Deterministic demo data for "Tilda Café" — catalog, staff, tables and 30 days of realistic history.
import { hashPin } from "../server/crypto";
import { formatMoney } from "../domain/money";
import { applyRefund, applyTender, buildLine, emptyOrder, makeTickets, mergeLines, recompute } from "../domain/order";
import type {
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

export interface SeedState {
  settings: Settings;
  staff: Staff[];
  categories: Category[];
  modifierGroups: ModifierGroup[];
  products: Product[];
  tables: DiningTable[];
  customers: Customer[];
  giftCards: GiftCard[];
  orders: Order[];
  shifts: Shift[];
  purchaseOrders: PurchaseOrder[];
  approvals: Approval[];
  audit: AuditEntry[];
}

export const DEFAULT_SETTINGS: Settings = {
  businessName: "Tilda Café",
  currency: "EUR",
  locale: "en-IE",
  pointsPerCurrencyUnit: 1,
  pointValue: 5,
  approval: { refundOver: 2000, discountPercentOver: 20, stockAdjustOver: 50, priceChange: true, voidPaid: true },
  tipPresets: [0, 10, 15, 20],
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const staff: Staff[] = [
  { id: "st_petar", name: "Petar", role: "owner", pinHash: hashPin("1234"), color: "#ff6a3d", active: true },
  { id: "st_alex", name: "Alex", role: "manager", pinHash: hashPin("2580"), color: "#7c6cff", active: true },
  { id: "st_sam", name: "Sam", role: "cashier", pinHash: hashPin("0000"), color: "#16a34a", active: true },
  { id: "st_lena", name: "Lena", role: "cashier", pinHash: hashPin("1111"), color: "#0ea5e9", active: true },
];

const categories: Category[] = [
  { id: "cat_coffee", name: "Coffee", emoji: "☕", sort: 1, station: "bar", taxRate: 0.1 },
  { id: "cat_tea", name: "Tea & Co", emoji: "🍵", sort: 2, station: "bar", taxRate: 0.1 },
  { id: "cat_cold", name: "Cold", emoji: "🧊", sort: 3, station: "bar", taxRate: 0.1 },
  { id: "cat_bakery", name: "Bakery", emoji: "🥐", sort: 4, station: "kitchen", taxRate: 0.1 },
  { id: "cat_brunch", name: "Brunch", emoji: "🍳", sort: 5, station: "kitchen", taxRate: 0.1 },
  { id: "cat_retail", name: "Retail", emoji: "🛍️", sort: 6, station: "none", taxRate: 0.2 },
];

const modifierGroups: ModifierGroup[] = [
  {
    id: "mg_milk",
    name: "Milk",
    min: 1,
    max: 1,
    modifiers: [
      { id: "md_whole", name: "Whole milk", price: 0 },
      { id: "md_oat", name: "Oat milk", price: 40 },
      { id: "md_almond", name: "Almond milk", price: 40 },
      { id: "md_skim", name: "Skim milk", price: 0 },
    ],
  },
  {
    id: "mg_size",
    name: "Size",
    min: 1,
    max: 1,
    modifiers: [
      { id: "md_regular", name: "Regular", price: 0 },
      { id: "md_large", name: "Large", price: 60 },
    ],
  },
  {
    id: "mg_extras",
    name: "Extras",
    min: 0,
    max: 3,
    modifiers: [
      { id: "md_shot", name: "Extra shot", price: 70 },
      { id: "md_vanilla", name: "Vanilla syrup", price: 50 },
      { id: "md_caramel", name: "Caramel syrup", price: 50 },
      { id: "md_decaf", name: "Decaf", price: 0 },
    ],
  },
  { id: "mg_warm", name: "Serve", min: 0, max: 1, modifiers: [{ id: "md_warm", name: "Warmed", price: 0 }] },
  {
    id: "mg_eggs",
    name: "Eggs",
    min: 1,
    max: 1,
    modifiers: [
      { id: "md_poached", name: "Poached", price: 0 },
      { id: "md_scrambled", name: "Scrambled", price: 0 },
      { id: "md_fried", name: "Fried", price: 0 },
    ],
  },
  {
    id: "mg_addon",
    name: "Add-ons",
    min: 0,
    max: 3,
    modifiers: [
      { id: "md_bacon", name: "Bacon", price: 300 },
      { id: "md_salmon", name: "Smoked salmon", price: 400 },
      { id: "md_feta", name: "Feta", price: 200 },
    ],
  },
  {
    id: "mg_grind",
    name: "Grind",
    min: 1,
    max: 1,
    modifiers: [
      { id: "md_bean", name: "Whole bean", price: 0 },
      { id: "md_espresso", name: "Espresso grind", price: 0 },
      { id: "md_filter", name: "Filter grind", price: 0 },
    ],
  },
];

type P = Partial<Product> & Pick<Product, "id" | "categoryId" | "name" | "emoji" | "price">;
const COLORS: Record<string, string> = {
  cat_coffee: "#b45309",
  cat_tea: "#15803d",
  cat_cold: "#0284c7",
  cat_bakery: "#d97706",
  cat_brunch: "#dc2626",
  cat_retail: "#7c3aed",
};
const product = (p: P): Product => ({
  description: "",
  cost: Math.round(p.price * 0.28),
  sku: p.id.replace("pr_", "").toUpperCase(),
  available: true,
  trackStock: false,
  stock: 0,
  parLevel: 0,
  reorderQty: 0,
  modifierGroupIds: [],
  color: COLORS[p.categoryId],
  ...p,
});

const coffee = ["mg_size", "mg_milk", "mg_extras"];
const products: Product[] = [
  product({ id: "pr_espresso", categoryId: "cat_coffee", name: "Espresso", emoji: "☕", price: 250, modifierGroupIds: ["mg_extras"], description: "Double ristretto, house blend" }),
  product({ id: "pr_flatwhite", categoryId: "cat_coffee", name: "Flat White", emoji: "🥛", price: 380, modifierGroupIds: ["mg_milk", "mg_extras"], description: "Double shot, silky microfoam" }),
  product({ id: "pr_cappuccino", categoryId: "cat_coffee", name: "Cappuccino", emoji: "☁️", price: 370, modifierGroupIds: coffee }),
  product({ id: "pr_latte", categoryId: "cat_coffee", name: "Latte", emoji: "🍼", price: 390, modifierGroupIds: coffee }),
  product({ id: "pr_longblack", categoryId: "cat_coffee", name: "Long Black", emoji: "🖤", price: 320, modifierGroupIds: ["mg_size", "mg_extras"] }),
  product({ id: "pr_mocha", categoryId: "cat_coffee", name: "Mocha", emoji: "🍫", price: 440, modifierGroupIds: coffee }),
  product({ id: "pr_batch", categoryId: "cat_coffee", name: "Batch Brew", emoji: "⚗️", price: 300, modifierGroupIds: ["mg_size"], description: "Rotating single origin filter" }),
  product({ id: "pr_matcha", categoryId: "cat_tea", name: "Matcha Latte", emoji: "🍵", price: 450, modifierGroupIds: ["mg_size", "mg_milk"] }),
  product({ id: "pr_chai", categoryId: "cat_tea", name: "Chai Latte", emoji: "🫖", price: 420, modifierGroupIds: ["mg_size", "mg_milk"] }),
  product({ id: "pr_hotchoc", categoryId: "cat_tea", name: "Hot Chocolate", emoji: "🍫", price: 400, modifierGroupIds: ["mg_size", "mg_milk"] }),
  product({ id: "pr_tea", categoryId: "cat_tea", name: "English Breakfast", emoji: "🌿", price: 280 }),
  product({ id: "pr_icedlatte", categoryId: "cat_cold", name: "Iced Latte", emoji: "🧋", price: 450, modifierGroupIds: ["mg_milk", "mg_extras"] }),
  product({ id: "pr_coldbrew", categoryId: "cat_cold", name: "Cold Brew", emoji: "🧊", price: 420 }),
  product({ id: "pr_oj", categoryId: "cat_cold", name: "Fresh OJ", emoji: "🍊", price: 450, trackStock: true, stock: 40, parLevel: 12, reorderQty: 48, supplier: "Green Market Produce" }),
  product({ id: "pr_sparkling", categoryId: "cat_cold", name: "Sparkling Water", emoji: "💧", price: 250, trackStock: true, stock: 46, parLevel: 24, reorderQty: 48, supplier: "Alpine Beverages" }),
  product({ id: "pr_croissant", categoryId: "cat_bakery", name: "Butter Croissant", emoji: "🥐", price: 300, modifierGroupIds: ["mg_warm"], trackStock: true, stock: 22, parLevel: 8, reorderQty: 30, supplier: "Hart Bakery" }),
  product({ id: "pr_painchoc", categoryId: "cat_bakery", name: "Pain au Chocolat", emoji: "🍫", price: 340, modifierGroupIds: ["mg_warm"], trackStock: true, stock: 16, parLevel: 8, reorderQty: 24, supplier: "Hart Bakery" }),
  product({ id: "pr_cardamom", categoryId: "cat_bakery", name: "Cardamom Bun", emoji: "🌀", price: 380, modifierGroupIds: ["mg_warm"], trackStock: true, stock: 5, parLevel: 8, reorderQty: 24, supplier: "Hart Bakery", description: "Swedish-style, pearl sugar" }),
  product({ id: "pr_almondcr", categoryId: "cat_bakery", name: "Almond Croissant", emoji: "🌰", price: 420, modifierGroupIds: ["mg_warm"], trackStock: true, stock: 3, parLevel: 6, reorderQty: 18, supplier: "Hart Bakery" }),
  product({ id: "pr_banana", categoryId: "cat_bakery", name: "Banana Bread", emoji: "🍌", price: 360, modifierGroupIds: ["mg_warm"], trackStock: true, stock: 11, parLevel: 4, reorderQty: 12, supplier: "In-house" }),
  product({ id: "pr_avotoast", categoryId: "cat_brunch", name: "Avocado Toast", emoji: "🥑", price: 1250, modifierGroupIds: ["mg_eggs", "mg_addon"], description: "Sourdough, chilli, lime, egg" }),
  product({ id: "pr_shakshuka", categoryId: "cat_brunch", name: "Shakshuka", emoji: "🍳", price: 1350, modifierGroupIds: ["mg_addon"] }),
  product({ id: "pr_benedict", categoryId: "cat_brunch", name: "Eggs Benedict", emoji: "🥚", price: 1400, modifierGroupIds: ["mg_addon"] }),
  product({ id: "pr_granola", categoryId: "cat_brunch", name: "Granola Bowl", emoji: "🥣", price: 950, description: "Greek yoghurt, berries, honey" }),
  product({ id: "pr_bagel", categoryId: "cat_brunch", name: "Halloumi Bagel", emoji: "🥯", price: 1100, modifierGroupIds: ["mg_addon"] }),
  product({ id: "pr_house", categoryId: "cat_retail", name: "House Blend 250g", emoji: "🫘", price: 1400, cost: 520, modifierGroupIds: ["mg_grind"], trackStock: true, stock: 21, parLevel: 10, reorderQty: 30, supplier: "Tilda Roastery", barcode: "4006381333931" }),
  product({ id: "pr_guji", categoryId: "cat_retail", name: "Ethiopia Guji 250g", emoji: "🌺", price: 1800, cost: 760, modifierGroupIds: ["mg_grind"], trackStock: true, stock: 4, parLevel: 6, reorderQty: 20, supplier: "Tilda Roastery", barcode: "4006381333948" }),
  product({ id: "pr_drip", categoryId: "cat_retail", name: "Drip Bags ×10", emoji: "☕", price: 1200, cost: 450, trackStock: true, stock: 14, parLevel: 6, reorderQty: 20, supplier: "Tilda Roastery", barcode: "4006381333955" }),
  product({ id: "pr_keepcup", categoryId: "cat_retail", name: "KeepCup 12oz", emoji: "🥤", price: 2200, cost: 1100, trackStock: true, stock: 9, parLevel: 4, reorderQty: 12, supplier: "KeepCup EU", barcode: "9343127000123" }),
  product({ id: "pr_tote", categoryId: "cat_retail", name: "Tilda Tote", emoji: "👜", price: 1500, cost: 400, trackStock: true, stock: 28, parLevel: 5, reorderQty: 20, supplier: "Printworks", barcode: "4006381333979" }),
];

const tables: DiningTable[] = [
  { id: "tb_1", name: "1", seats: 2, zone: "Window", x: 0, y: 0, shape: "round" },
  { id: "tb_2", name: "2", seats: 2, zone: "Window", x: 3, y: 0, shape: "round" },
  { id: "tb_3", name: "3", seats: 4, zone: "Window", x: 6, y: 0, shape: "square" },
  { id: "tb_4", name: "4", seats: 4, zone: "Main", x: 0, y: 3, shape: "square" },
  { id: "tb_5", name: "5", seats: 6, zone: "Main", x: 3, y: 3, shape: "long" },
  { id: "tb_6", name: "6", seats: 4, zone: "Main", x: 7, y: 3, shape: "square" },
  { id: "tb_7", name: "7", seats: 2, zone: "Main", x: 0, y: 6, shape: "round" },
  { id: "tb_8", name: "8", seats: 8, zone: "Main", x: 3, y: 6, shape: "long" },
  { id: "tb_b1", name: "B1", seats: 1, zone: "Bar", x: 9, y: 0, shape: "round" },
  { id: "tb_b2", name: "B2", seats: 1, zone: "Bar", x: 10, y: 0, shape: "round" },
  { id: "tb_b3", name: "B3", seats: 1, zone: "Bar", x: 11, y: 0, shape: "round" },
  { id: "tb_p1", name: "P1", seats: 4, zone: "Patio", x: 9, y: 4, shape: "round" },
  { id: "tb_p2", name: "P2", seats: 4, zone: "Patio", x: 9, y: 7, shape: "round" },
];

const customerNames: [string, string, string[]][] = [
  ["Maria Georgieva", "maria.g@example.com", ["regular", "oat milk"]],
  ["Jonas Weber", "jonas@example.com", ["regular"]],
  ["Aiko Tanaka", "aiko@example.com", ["beans club"]],
  ["Lucas Silva", "lucas.s@example.com", []],
  ["Sofia Rossi", "sofia@example.com", ["regular", "vegan"]],
  ["Noah Kim", "noah.kim@example.com", []],
  ["Emma Dubois", "emma.d@example.com", ["beans club"]],
  ["Omar Haddad", "omar@example.com", ["regular"]],
  ["Ingrid Larsen", "ingrid@example.com", []],
  ["Diego Ramos", "diego@example.com", ["office orders"]],
  ["Chloe Martin", "chloe@example.com", []],
  ["Yusuf Demir", "yusuf@example.com", ["regular"]],
];

// Weighted basket templates: [productId, modifierIds][]
const BASKETS: { w: number; items: [string, string[]?][] }[] = [
  { w: 18, items: [["pr_flatwhite"]] },
  { w: 10, items: [["pr_flatwhite", ["md_oat"]], ["pr_croissant"]] },
  { w: 9, items: [["pr_cappuccino"], ["pr_painchoc"]] },
  { w: 8, items: [["pr_latte", ["md_large", "md_oat"]]] },
  { w: 6, items: [["pr_longblack"], ["pr_banana", ["md_warm"]]] },
  { w: 6, items: [["pr_espresso"]] },
  { w: 5, items: [["pr_batch"], ["pr_cardamom"]] },
  { w: 5, items: [["pr_matcha", ["md_oat"]]] },
  { w: 4, items: [["pr_chai"], ["pr_almondcr"]] },
  { w: 4, items: [["pr_avotoast", ["md_poached"]], ["pr_flatwhite"], ["pr_oj"]] },
  { w: 3, items: [["pr_shakshuka"], ["pr_latte"], ["pr_cappuccino"]] },
  { w: 3, items: [["pr_benedict", ["md_salmon"]], ["pr_longblack"]] },
  { w: 3, items: [["pr_granola"], ["pr_icedlatte"]] },
  { w: 3, items: [["pr_bagel"], ["pr_coldbrew"]] },
  { w: 3, items: [["pr_house", ["md_espresso"]]] },
  { w: 2, items: [["pr_guji", ["md_filter"]], ["pr_flatwhite"]] },
  { w: 2, items: [["pr_keepcup"], ["pr_latte"]] },
  { w: 2, items: [["pr_drip"]] },
  { w: 2, items: [["pr_hotchoc"], ["pr_croissant"], ["pr_sparkling"]] },
  { w: 1, items: [["pr_tote"], ["pr_house", ["md_bean"]]] },
];
const BASKET_TOTAL = BASKETS.reduce((s, b) => s + b.w, 0);

// Hourly demand curve, 07:00–17:00
const HOURLY = [0, 0, 0, 0, 0, 0, 0, 8, 14, 12, 9, 8, 11, 9, 6, 6, 5, 3, 0, 0, 0, 0, 0, 0];

export function buildSeed(now = new Date()): SeedState {
  const r = rng(20261007);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const customers: Customer[] = customerNames.map(([name, email, tags], i) => ({
    id: `cu_${i + 1}`,
    name,
    email,
    phone: `+359 88 ${String(100000 + i * 7919).slice(0, 3)} ${String(1000 + i * 37).slice(0, 4)}`,
    points: 0,
    visits: 0,
    totalSpent: 0,
    tags,
    note: i === 0 ? "Usually a flat white with oat milk. Likes the window seat." : undefined,
    createdAt: new Date(now.getTime() - (90 + i * 5) * 86_400_000).toISOString(),
  }));

  const orders: Order[] = [];
  let number = 1000;
  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);

  for (let d = 29; d >= 0; d--) {
    const day = new Date(today0.getTime() - d * 86_400_000);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const dayFactor = (weekend ? 1.35 : 1) * (0.85 + r() * 0.3);
    for (let h = 7; h < 18; h++) {
      const count = Math.round((HOURLY[h] * dayFactor * (0.7 + r() * 0.6)) / 1.6);
      for (let i = 0; i < count; i++) {
        const at = new Date(day.getTime() + h * 3_600_000 + Math.floor(r() * 3_600_000));
        if (at > now) continue;
        let roll = r() * BASKET_TOTAL;
        const basket = BASKETS.find((b) => (roll -= b.w) < 0) ?? BASKETS[0];
        const s = pick(staff);
        const cust = r() < 0.3 ? pick(customers) : undefined;
        let o = emptyOrder({ number: ++number, staffId: s.id, createdBy: s.name, customerId: cust?.id });
        for (const [pid, mods] of basket.items) {
          const line = buildLine({ productId: pid, qty: r() < 0.12 ? 2 : 1, modifierIds: mods }, products, categories, modifierGroups);
          o = { ...o, lines: mergeLines(o.lines, line) };
        }
        if (r() < 0.06) o.discount = { kind: "percent", value: 10, reason: "Staff / friends" };
        o = recompute(o);
        const card = r() < 0.78;
        const tip = card && r() < 0.35 ? Math.round(o.total * 0.1) : 0;
        o = applyTender(o, card ? { method: "card", tip } : { method: "cash", tendered: Math.ceil(o.total / 500) * 500 }).order;
        if (r() < 0.015) o = applyRefund(o, { reason: pick(["Wrong milk", "Customer changed mind", "Too cold"]), amount: Math.round(o.total * 0.5) }, s.name).order;
        if (d < 3 && r() < 0.05) {
          o.channel = "agent:claude";
          o.createdBy = `Claude (for ${s.name})`;
        }
        const iso = at.toISOString();
        o.createdAt = iso;
        o.updatedAt = iso;
        o.closedAt = new Date(at.getTime() + 60_000).toISOString();
        o.tickets = [];
        orders.push(o);
        if (cust) {
          cust.visits += 1;
          cust.totalSpent += o.total;
          cust.points += Math.floor(o.total / 100);
          cust.lastVisitAt = iso;
        }
      }
    }
  }

  // Live open orders so the floor and kitchen look busy.
  const live: { table?: string; items: [string, number, string[]?][]; status: "new" | "preparing" | "ready"; mins: number; channel?: string; customer?: string }[] = [
    { table: "tb_2", items: [["pr_flatwhite", 1, ["md_oat"]], ["pr_almondcr", 1, ["md_warm"]]], status: "preparing", mins: 4, customer: "cu_1" },
    { table: "tb_5", items: [["pr_avotoast", 2, ["md_poached"]], ["pr_shakshuka", 1], ["pr_latte", 2], ["pr_oj", 1]], status: "new", mins: 2 },
    { table: "tb_b1", items: [["pr_espresso", 1], ["pr_cardamom", 1]], status: "ready", mins: 7 },
    { items: [["pr_icedlatte", 2, ["md_oat", "md_vanilla"]], ["pr_banana", 1]], status: "new", mins: 1, channel: "agent:claude" },
  ];
  for (const l of live) {
    const s = staff[2];
    let o = emptyOrder({ number: ++number, staffId: s.id, createdBy: l.channel ? `Claude (for Petar)` : s.name, tableId: l.table, customerId: l.customer });
    for (const [pid, qty, mods] of l.items) o = { ...o, lines: mergeLines(o.lines, buildLine({ productId: pid, qty, modifierIds: mods }, products, categories, modifierGroups)) };
    o = makeTickets(recompute(o));
    const at = new Date(now.getTime() - l.mins * 60_000).toISOString();
    o.tickets = o.tickets.map((t) => ({ ...t, status: l.status, sentAt: at, updatedAt: at }));
    o.createdAt = at;
    if (l.channel) {
      o.channel = l.channel;
      o.note = "Pickup at 10 past — name: Daniel";
    }
    orders.push(o);
  }

  const lastPaid = [...orders].reverse().find((o) => o.status === "paid" && o.total > 2000) ?? orders[orders.length - 10];
  const claude = { type: "agent" as const, staffId: "st_petar", name: "Petar", role: "owner" as const, agent: "claude" as const, agentLabel: "Claude" };
  const approvals: Approval[] = [
    {
      id: "ap_seed1",
      tool: "refund_order",
      input: { order_id: lastPaid.id, reason: "Customer emailed: oat milk was missing, drink remade but charged twice", amount: lastPaid.total },
      summary: `Refund ${formatMoney(lastPaid.total)} on order #${lastPaid.number}`,
      reason: `Refunds over ${formatMoney(DEFAULT_SETTINGS.approval.refundOver)} requested by an AI agent need a manager's OK`,
      requestedBy: claude,
      status: "pending",
      createdAt: new Date(now.getTime() - 9 * 60_000).toISOString(),
    },
  ];
  const audit: AuditEntry[] = [
    { id: "au_s1", at: new Date(now.getTime() - 50 * 60_000).toISOString(), actor: claude, tool: "sales_report", summary: "Read sales report (yesterday, by item)", input: { range: "yesterday", group_by: "item" }, outcome: "ok" },
    { id: "au_s2", at: new Date(now.getTime() - 48 * 60_000).toISOString(), actor: claude, tool: "low_stock_report", summary: "Checked low stock", input: {}, outcome: "ok" },
    { id: "au_s3", at: new Date(now.getTime() - 47 * 60_000).toISOString(), actor: claude, tool: "draft_purchase_order", summary: "Drafted PO for Hart Bakery (3 lines)", input: { supplier: "Hart Bakery" }, outcome: "ok" },
    { id: "au_s4", at: new Date(now.getTime() - 9 * 60_000).toISOString(), actor: claude, tool: "refund_order", summary: approvals[0].summary, input: approvals[0].input, outcome: "approval_required" },
  ];

  const opened = new Date(today0.getTime() + 6.75 * 3_600_000);
  const shifts: Shift[] =
    now > opened
      ? [{ id: "sh_today", openedAt: opened.toISOString(), openedBy: "Petar", openingFloat: 15000, events: [{ id: "ce_1", type: "paid_out", amount: 1250, reason: "Milk top-up from corner shop", at: new Date(opened.getTime() + 3 * 3_600_000).toISOString(), by: "Alex" }] }]
      : [];

  const poLines = products.filter((p) => p.supplier === "Hart Bakery" && p.stock <= p.parLevel).map((p) => ({ productId: p.id, name: p.name, qty: p.reorderQty, cost: p.cost }));
  const purchaseOrders: PurchaseOrder[] = [
    { id: "po_1", number: 41, supplier: "Hart Bakery", status: "draft", lines: poLines, total: poLines.reduce((s, l) => s + l.qty * l.cost, 0), note: "Drafted by Claude from 14-day sales velocity", createdBy: "Claude (for Petar)", createdAt: audit[2].at, updatedAt: audit[2].at },
    { id: "po_0", number: 40, supplier: "Tilda Roastery", status: "received", lines: [{ productId: "pr_house", name: "House Blend 250g", qty: 30, cost: 520 }], total: 15600, createdBy: "Alex", createdAt: new Date(now.getTime() - 4 * 86_400_000).toISOString(), updatedAt: new Date(now.getTime() - 3 * 86_400_000).toISOString() },
  ];

  const giftCards: GiftCard[] = [
    { code: "TILDA-GIFT-2500", balance: 2500, initial: 2500, createdAt: new Date(now.getTime() - 20 * 86_400_000).toISOString() },
    { code: "TILDA-GIFT-5000", balance: 1830, initial: 5000, createdAt: new Date(now.getTime() - 60 * 86_400_000).toISOString() },
  ];

  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    staff: structuredClone(staff),
    categories: structuredClone(categories),
    modifierGroups: structuredClone(modifierGroups),
    products: structuredClone(products),
    tables: structuredClone(tables),
    customers,
    giftCards,
    orders,
    shifts,
    purchaseOrders,
    approvals,
    audit,
  };
}
