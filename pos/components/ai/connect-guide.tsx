"use client";

import { useEffect, useState } from "react";
import { cx } from "../ui";

export function useOrigin() {
  const [origin, setOrigin] = useState("https://your-tilda.vercel.app");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

export function CopyField({ value, label, mono = true }: { value: string; label?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-line bg-surface-2">
      {label ? <span className="hidden shrink-0 items-center border-r border-line px-3 text-xs font-semibold text-muted sm:flex">{label}</span> : null}
      <code className={cx("min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-3 py-2.5 text-sm no-scrollbar", mono ? "font-mono" : "")}>{value}</code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
        className="shrink-0 border-l border-line px-3 text-sm font-semibold text-accent hover:bg-surface-3"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-3 pr-16 font-mono text-xs leading-relaxed">{children}</pre>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        className="absolute right-2 top-2 rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-accent shadow-sm"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

type ClientKey = "claude" | "chatgpt" | "perplexity" | "claude-code" | "cursor" | "gemini" | "copilot";

const CLIENTS: { key: ClientKey; name: string; color: string; auth: "OAuth" | "API key" }[] = [
  { key: "claude", name: "Claude", color: "#d97757", auth: "OAuth" },
  { key: "chatgpt", name: "ChatGPT", color: "#10a37f", auth: "OAuth" },
  { key: "perplexity", name: "Perplexity", color: "#20808d", auth: "OAuth" },
  { key: "copilot", name: "Copilot Studio", color: "#0078d4", auth: "OAuth" },
  { key: "claude-code", name: "Claude Code", color: "#c15f3c", auth: "API key" },
  { key: "cursor", name: "Cursor", color: "#555", auth: "API key" },
  { key: "gemini", name: "Gemini CLI", color: "#4285f4", auth: "API key" },
];

export function ConnectGuide({ apiKey }: { apiKey?: string | null }) {
  const origin = useOrigin();
  const url = `${origin}/api/mcp`;
  const key = apiKey ?? "tilda_YOUR_API_KEY";
  const [active, setActive] = useState<ClientKey>("claude");

  const steps: Record<ClientKey, React.ReactNode> = {
    claude: (
      <Steps
        items={[
          <>In Claude (web or desktop) open <b>Settings → Connectors</b> and choose <b>Add custom connector</b>.</>,
          <>Name it <b>Tilda</b> and paste the server URL above.</>,
          <>Click <b>Connect</b> — Tilda opens; sign in with your staff PIN and press <b>Allow</b>.</>,
          <>In a chat, enable the Tilda connector and ask: <i>“How are sales today vs last week?”</i> Connectors added on the web also work in the Claude mobile apps.</>,
        ]}
      />
    ),
    chatgpt: (
      <Steps
        items={[
          <>In ChatGPT open <b>Settings → Apps &amp; Connectors → Advanced</b> and turn on <b>Developer mode</b> (Plus, Pro, Business, Enterprise or Edu).</>,
          <>Create a connector, name it <b>Tilda</b>, paste the server URL and pick <b>OAuth</b> authentication.</>,
          <>Approve the Tilda consent screen with your staff PIN.</>,
          <>In a new chat, add Tilda from the tools menu and say: <i>“Ring up two lattes for table 5.”</i></>,
        ]}
      />
    ),
    perplexity: (
      <Steps
        items={[
          <>In Perplexity open <b>Settings → Connectors</b> and add a <b>custom remote connector</b> (Pro / Max / Enterprise).</>,
          <>Paste the server URL; Tilda supports Streamable HTTP and OAuth with dynamic client registration.</>,
          <>Sign in with your staff PIN and allow access, then ask: <i>“What should I reorder this week?”</i></>,
        ]}
      />
    ),
    copilot: (
      <Steps
        items={[
          <>In Copilot Studio open your agent → <b>Tools → Add a tool → Model Context Protocol</b>.</>,
          <>Use the server URL above, transport <b>Streamable HTTP</b>, authentication <b>OAuth 2.0 (dynamic discovery)</b>.</>,
          <>Sign in with your staff PIN when prompted. Generative orchestration must be on.</>,
        ]}
      />
    ),
    "claude-code": (
      <div className="space-y-3">
        <p className="text-sm text-muted">Create an API key below, then run:</p>
        <Code>{`claude mcp add --transport http tilda ${url} \\\n  --header "Authorization: Bearer ${key}"`}</Code>
      </div>
    ),
    cursor: (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Add to <code>~/.cursor/mcp.json</code> (or the project&apos;s <code>.cursor/mcp.json</code>):
        </p>
        <Code>{JSON.stringify({ mcpServers: { tilda: { url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)}</Code>
      </div>
    ),
    gemini: (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Add to <code>~/.gemini/settings.json</code>:
        </p>
        <Code>{JSON.stringify({ mcpServers: { tilda: { httpUrl: url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)}</Code>
      </div>
    ),
  };

  const current = CLIENTS.find((c) => c.key === active)!;

  return (
    <div className="space-y-4">
      <CopyField label="MCP server URL" value={url} />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        {CLIENTS.map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={cx("flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition", active === c.key ? "border-transparent bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}
          >
            <span className="size-2.5 rounded-full" style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Connect {current.name}</div>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{current.auth}</span>
        </div>
        {steps[active]}
      </div>
      <p className="text-xs text-muted">
        Client menus change often — if a label differs, look for “custom connector”, “MCP server” or “developer mode”. Tilda speaks MCP over Streamable HTTP with OAuth 2.1 (PKCE, dynamic client registration and client metadata documents).
      </p>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
          <span className="pt-0.5">{it}</span>
        </li>
      ))}
    </ol>
  );
}

export const TRY_PROMPTS = [
  "Ring up two oat flat whites and a warm croissant for table 4, on Maria Georgieva's loyalty.",
  "How did we do yesterday vs. the same day last week? Break it down by hour.",
  "What's running low? Draft purchase orders for anything we'll run out of before Friday.",
  "Table 5 wants the bill — split it 3 ways, card, 10% tip.",
  "86 the almond croissants and tell me which orders today included one.",
  "Refund order #1042 — the customer's drink was wrong.",
];
