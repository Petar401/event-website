"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PinLogin } from "@/components/shell";
import { Button, cx } from "@/components/ui";

interface Props {
  session: { staffId: string; name: string; role: string } | null;
  staff: { id: string; name: string; role: string; color: string }[];
  mode: string;
  client: { name: string; host: string; agent: string; label: string };
  params: Record<string, string>;
}

const AGENT_COLORS: Record<string, string> = { claude: "#d97757", chatgpt: "#10a37f", perplexity: "#20808d", gemini: "#4285f4", copilot: "#0078d4", cursor: "#111" };

export function Consent({ session, staff, mode, client, params }: Props) {
  const router = useRouter();
  const [access, setAccess] = useState<"full" | "read">("full");

  if (!session) {
    return (
      <main className="min-h-dvh">
        <div className="mx-auto max-w-md px-6 pt-10 text-center">
          <div className="text-sm text-muted">
            <b className="text-ink">{client.label}</b> wants to connect to Tilda.
          </div>
          <div className="mt-1 text-xs text-muted">Sign in with your staff PIN to continue.</div>
        </div>
        <PinLogin staff={staff} mode={mode} onDone={() => router.refresh()} compact />
      </main>
    );
  }

  const can = [
    ["Read the menu, stock, orders, customers and sales reports", true],
    ["Ring up orders, send them to the kitchen and take (simulated) payments", access === "full"],
    ["Refunds, discounts, price and stock changes — big ones wait for a manager's approval", access === "full"],
  ] as const;

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <form method="post" action="/oauth/authorize/decision" className="w-full max-w-md animate-pop rounded-3xl border border-line bg-surface p-6 shadow-card">
        {Object.entries(params).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="access" value={access} />
        <div className="flex items-center justify-center gap-3">
          <span className="grid size-14 place-items-center rounded-2xl text-2xl font-black text-white shadow-sm" style={{ background: AGENT_COLORS[client.agent] ?? "var(--ai)" }}>
            {client.label[0]}
          </span>
          <span className="text-2xl text-muted">⇄</span>
          <span className="grid size-14 place-items-center rounded-2xl bg-accent text-2xl font-black text-accent-ink shadow-sm">t</span>
        </div>
        <h1 className="mt-5 text-center text-xl font-bold">
          Connect {client.name} to Tilda?
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          It will act on your behalf as <b className="text-ink">{session.name}</b> ({session.role}). Redirects to {client.host}.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1">
          {(["full", "read"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAccess(a)} className={cx("h-10 rounded-xl text-sm font-semibold", access === a ? "bg-surface shadow-sm" : "text-muted")}>
              {a === "full" ? "Full access" : "Read-only"}
            </button>
          ))}
        </div>

        <ul className="mt-4 space-y-2">
          {can.map(([label, on]) => (
            <li key={label} className={cx("flex gap-2 text-sm", !on && "text-muted line-through")}>
              <span className={on ? "text-ok" : "text-muted"}>{on ? "✓" : "–"}</span>
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-ai-soft p-3 text-xs text-ai">
          Every action is logged in the AI Hub with the agent&apos;s name. You can revoke this connection there at any time.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="submit" name="decision" value="deny" variant="secondary" size="lg">
            Cancel
          </Button>
          <Button type="submit" name="decision" value="allow" variant="primary" size="lg">
            Allow
          </Button>
        </div>
      </form>
    </main>
  );
}
