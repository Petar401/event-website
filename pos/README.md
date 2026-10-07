# Tilda — the point of sale your AI can run

Tilda is a next-generation café / restaurant / retail POS with a **built-in MCP server**. Connect it once to Claude, ChatGPT, Perplexity, Copilot Studio, Cursor or Gemini CLI and run the shop by chat — while staff keep using a fast, touch-first register on iPad, phone or desktop.

> “Ring up two oat flat whites and a warm croissant for table 4, on Maria's loyalty.”
> → the order appears live on the register and the kitchen display, tagged **via Claude**.
>
> “Refund order #2841, the drink was wrong.”
> → over the €20 guardrail, so it lands as an **approval card** on the manager's phone instead of executing.

## What's inside

| Area | Highlights |
|---|---|
| **Register** | Catalog grid with modifiers, barcode-scanner input, tables, customers & loyalty, discounts, tips, split / cash / simulated card / gift card / points tender, QR receipts |
| **Tables & kitchen** | Live floor plan, kitchen display (KDS) with bar/kitchen stations, bump flow, 86 board |
| **Back office** | Orders & refunds (line-level, restock), inventory with sales-velocity reorder suggestions, purchase orders, catalog & pricing, customers, cash drawer with Z-report |
| **Insights** | Sales by hour/day/item/category/staff/tender/channel, margin, anomaly detection (refund/discount concentration), AI-agent share |
| **AI Hub** | Approvals inbox, live agent activity feed, connection guides for every major AI client, API keys, OAuth grants, guardrail settings, team PINs |
| **Ask Tilda** | In-app copilot (Claude) that uses the very same tools as external agents — approvals apply to it too |

### The MCP server

- **Endpoint:** `https://<your-app>/api/mcp` — Streamable HTTP (stateless JSON responses, serverless-friendly).
- **Auth:** OAuth 2.1 with PKCE, dynamic client registration and client ID metadata documents (for Claude, ChatGPT, Perplexity, Copilot Studio), or bearer API keys (Claude Code, Cursor, Gemini CLI, scripts). Discovery at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`.
- **31 intent-level tools** (not a generic API wrapper), annotated `readOnlyHint` / `destructiveHint`: `get_menu`, `search_catalog`, `inventory_report`, `list_orders`, `get_order`, `sales_report`, `business_insights`, `find_customer`, `list_tables`, `shift_summary`, `get_policies`, `list_approvals`, `create_order`, `add_items`, `update_line`, `apply_discount`, `attach_customer`, `send_to_kitchen`, `update_ticket`, `take_payment`, `refund_order`, `void_order`, `add_customer`, `open_shift`, `cash_movement`, `close_shift`, `set_availability`, `adjust_stock`, `update_price`, `draft_purchase_order`, `update_purchase_order`.
- **Resources:** `tilda://menu`, `tilda://policies`, `tilda://reports/today`, `tilda://inventory/low`. **Prompts:** `daily_close`, `reorder_review`, `why_sales_down`.
- **Trust layer:** every write takes an `idempotency_key`; destructive tools support `dry_run`; policy thresholds turn risky agent actions into approvals; scopes (`pos:read` / `pos:write` / `pos:manage`) map to staff roles; everything is written to an audit log with the agent's name; customer/staff free text is wrapped as «data» to blunt prompt injection.

### Architecture

```
app/(pos)/*            Touch-first UI (Next.js App Router, React 19, Tailwind v4, PWA-installable)
app/api/tools/[name]   UI → tool calls as the logged-in staff member
app/api/mcp            MCP server (JSON-RPC over Streamable HTTP)
app/oauth/*, .well-known/*   OAuth 2.1 authorization server (stateless, signed with APP_SECRET)
app/api/copilot        "Ask Tilda" — Claude tool-use loop over the same registry
lib/domain/*           Pure POS logic: money in integer cents, VAT-inclusive tax, tips, split tender, refunds, reports
lib/tools/*            ONE tool registry → permissions, approvals, idempotency, audit, live broadcast
lib/data/*             Repo interface → SupabaseRepo | DemoRepo (in-memory, seeded "Tilda Café")
supabase/migrations    Postgres schema with RLS locked down to the service role
```

Every action — a tap on the register, a Claude tool call, a copilot step — goes through `executeTool()` in `lib/tools/registry.ts`, so rules are enforced exactly once.

Live updates: Supabase Realtime **Broadcast** pings (no business data in the payload) tell screens to refetch through the authenticated API; demo mode falls back to polling `/api/live`.

## Run it locally

```bash
cd pos
npm install
npm run dev          # http://localhost:3000 — demo mode, no setup needed
```

Demo PINs: **Petar** (owner) `1234`, **Alex** (manager) `2580`, **Sam** (cashier) `0000`, **Lena** (cashier) `1111`.

```bash
npm test             # domain unit tests
npm run typecheck
BASE_URL=http://localhost:3000 npm run smoke:mcp   # end-to-end MCP check with the official SDK client
```

## Deploy (Vercel + Supabase)

1. **Vercel:** import the repo, set **Root Directory = `pos`** (framework: Next.js). Add `APP_SECRET` (`openssl rand -base64 32`). With only that, it runs in demo mode (in-memory data per server instance — fine for a demo, not for real use).
2. **Supabase:** create a project, open **SQL Editor**, paste and run `supabase/migrations/20261007000000_tilda_pos.sql`.
3. Add to Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → redeploy. On first load Tilda seeds the demo café into the empty database (set `SEED_ON_EMPTY=false` to skip; or run `npm run seed:supabase`).
4. **Change the demo PINs** in AI Hub → Team PINs.
5. Optional: `ANTHROPIC_API_KEY` enables the in-app **Ask Tilda** copilot (`COPILOT_MODEL` defaults to `claude-opus-5-5`, low effort, with server-side refusal fallback).

Then open **AI Hub** and follow the guide for your AI client.

## Honest limits (v0.1)

- **Card payments are simulated.** `take_payment` records a `SIM-CARD-…` reference. The tool contract is shaped so a Stripe Terminal / SumUp provider can slot in behind it.
- Staff login is a 4-digit PIN with a per-instance rate limit — good for a shared counter device, not a substitute for SSO on the back office. Owner email login (Supabase Auth) is a natural next step.
- No offline queue yet (orders accept a `client_order_id` so one can be added safely), no multi-location, no printer/cash-drawer hardware drivers.
- Demo mode state lives in one server instance's memory and resets on cold start.
