"use client";

import { useState } from "react";
import { callTool, newKey, tool } from "@/lib/client/api";
import { useLiveData, usePos } from "@/lib/client/pos-context";
import type { ApiKeyRecord, Approval, AuditEntry, Settings } from "@/lib/domain/types";
import { ConnectGuide, CopyField, TRY_PROMPTS } from "@/components/ai/connect-guide";
import { AgentBadge, Badge, Button, Card, Empty, Field, Input, PageHeader, Segmented, Sheet, Spinner, cx, timeAgo } from "@/components/ui";

export default function AiHubPage() {
  const { session, snapshot } = usePos();
  const isManager = session.role !== "cashier";
  const [newToken, setNewToken] = useState<string | null>(null);

  const approvals = useLiveData(() => tool<Approval[]>("list_approvals_full"));
  const activity = useLiveData(() => tool<AuditEntry[]>("list_audit", { limit: 60, agents_only: true }));
  const keys = useLiveData(() => (isManager ? tool<ApiKeyRecord[]>("list_api_keys") : Promise.resolve([] as ApiKeyRecord[])), [isManager]);

  const pending = (approvals.data ?? []).filter((a) => a.status === "pending");
  const decided = (approvals.data ?? []).filter((a) => a.status !== "pending").slice(0, 5);
  const today = new Date().toDateString();
  const actionsToday = (activity.data ?? []).filter((a) => new Date(a.at).toDateString() === today).length;
  const liveConnections = (keys.data ?? []).filter((k) => !k.revoked).length;

  return (
    <div className="pb-10">
      <PageHeader
        title="AI Hub"
        subtitle="Let Claude, ChatGPT, Perplexity and friends run the shop — with guardrails you control."
        actions={snapshot?.mode === "demo" ? <Badge tone="warn">Demo mode · data resets</Badge> : <Badge tone="ok">Live · Supabase</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 px-4 sm:px-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] [&>*]:min-w-0">
        {/* Hero */}
        <Card className="relative overflow-hidden p-5 sm:p-6 xl:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-ai/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Badge tone="ai">✦ Model Context Protocol</Badge>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Your POS is now an AI tool.</h2>
              <p className="mt-2 max-w-2xl text-ink-2">
                Tilda exposes <b>31 tools</b>, live resources and ready-made prompts over one secure MCP endpoint. Ring up orders, check stock, run reports or close the day by chat. Every action shows up here, and anything risky waits for your approval.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center lg:w-80 [&>*]:min-w-0">
              <MiniStat value={pending.length} label="Awaiting approval" tone={pending.length ? "warn" : undefined} />
              <MiniStat value={actionsToday} label="Agent actions today" tone="ai" />
              <MiniStat value={liveConnections} label="Connections" />
            </div>
          </div>
        </Card>

        {/* Approvals */}
        <Card className="p-4 sm:p-5">
          <SectionTitle title="Approvals" hint="Agents can't do these alone" count={pending.length} />
          {approvals.loading ? (
            <Loading />
          ) : pending.length === 0 ? (
            <Empty icon="🛡️" title="Nothing waiting">
              When an AI asks for a big refund, discount, price or stock change, it lands here for a manager to approve.
            </Empty>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <ApprovalCard key={a.id} approval={a} canDecide={isManager} onDone={approvals.reload} />
              ))}
            </div>
          )}
          {decided.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recently decided</div>
              <ul className="space-y-1.5 text-sm">
                {decided.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{a.summary}</span>
                    <Badge tone={a.status === "approved" ? "ok" : "bad"}>
                      {a.status} · {a.decidedBy}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {/* Activity */}
        <Card className="p-4 sm:p-5 xl:row-span-2">
          <SectionTitle title="Live agent activity" hint="Updates in real time" live />
          {activity.loading ? (
            <Loading />
          ) : !activity.data?.length ? (
            <Empty icon="🤖" title="No agent activity yet">
              Connect an AI below and ask it something — you&apos;ll watch every tool call land here.
            </Empty>
          ) : (
            <ol className="relative space-y-0.5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
              {activity.data.map((e) => (
                <li key={e.id} className="relative flex gap-3 rounded-xl py-2 pl-0 pr-1">
                  <span className={cx("relative z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold", outcomeTone(e.outcome))}>{outcomeIcon(e.outcome)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AgentBadge agent={e.actor.agent} label={e.actor.agentLabel} />
                      <span className="text-xs text-muted">for {e.actor.name} · {timeAgo(e.at)}</span>
                    </div>
                    <div className="mt-0.5 text-sm">{e.summary}</div>
                    {e.error ? <div className="text-xs text-bad">{e.error}</div> : null}
                    <code className="text-[11px] text-muted">{e.tool}</code>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Connect */}
        <Card className="p-4 sm:p-5">
          <SectionTitle title="Connect your AI" hint="One URL, any client" />
          <ConnectGuide apiKey={newToken} />
        </Card>

        {/* Try it */}
        <Card className="p-4 sm:p-5">
          <SectionTitle title="Things to try" hint="Paste into your AI after connecting" />
          <ul className="space-y-2">
            {TRY_PROMPTS.map((p) => (
              <li key={p}>
                <CopyField value={p} mono={false} />
              </li>
            ))}
          </ul>
        </Card>

        {/* Keys */}
        {isManager ? <Connections keys={keys.data ?? []} loading={keys.loading} onToken={setNewToken} reload={keys.reload} /> : null}

        {/* Guardrails */}
        {snapshot ? <Guardrails settings={snapshot.settings} canEdit={session.role === "owner"} /> : null}

        {snapshot ? <TeamPins staff={snapshot.staff} /> : null}
      </div>
    </div>
  );
}

function MiniStat({ value, label, tone }: { value: number; label: string; tone?: "ai" | "warn" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-3 backdrop-blur">
      <div className={cx("text-2xl font-bold tabular", tone === "ai" && "text-ai", tone === "warn" && "text-warn")}>{value}</div>
      <div className="text-[11px] leading-tight text-muted">{label}</div>
    </div>
  );
}

function SectionTitle({ title, hint, count, live }: { title: string; hint?: string; count?: number; live?: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {count ? <span className="grid size-6 place-items-center rounded-full bg-warn text-xs font-bold text-white">{count}</span> : null}
        {live ? <span className="size-2 animate-pulse rounded-full bg-ok" aria-label="live" /> : null}
      </div>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="grid place-items-center py-10">
      <Spinner className="text-ai" />
    </div>
  );
}

const outcomeTone = (o: AuditEntry["outcome"]) =>
  o === "ok" ? "bg-ai-soft text-ai" : o === "approval_required" ? "bg-warn-soft text-warn" : o === "dry_run" ? "bg-surface-2 text-muted" : "bg-bad-soft text-bad";
const outcomeIcon = (o: AuditEntry["outcome"]) => (o === "ok" ? "✓" : o === "approval_required" ? "⏳" : o === "dry_run" ? "◌" : "!");

function ApprovalCard({ approval, canDecide, onDone }: { approval: Approval; canDecide: boolean; onDone: () => void }) {
  const { toast, refreshSnapshot } = usePos();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const decide = async (decision: "approve" | "reject") => {
    setBusy(decision);
    const r = await callTool("decide_approval", { id: approval.id, decision });
    setBusy(null);
    if (r.ok) {
      toast({ title: decision === "approve" ? "Approved & done" : "Rejected", body: approval.summary, tone: decision === "approve" ? "ok" : "default" });
      onDone();
      refreshSnapshot();
    } else toast({ title: "Couldn't complete", body: r.error, tone: "bad" });
  };
  const by = approval.requestedBy;
  const reason = typeof approval.input.reason === "string" ? approval.input.reason : null;
  return (
    <div className="animate-pop rounded-2xl border border-warn/40 bg-warn-soft/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {by.type === "agent" ? <AgentBadge agent={by.agent} label={by.agentLabel} /> : <Badge>{by.name}</Badge>}
        <span className="text-xs text-muted">
          {by.type === "agent" ? `on behalf of ${by.name} · ` : ""}
          {timeAgo(approval.createdAt)}
        </span>
      </div>
      <div className="mt-2 text-base font-semibold">{approval.summary}</div>
      {reason ? <div className="mt-1 text-sm text-ink-2">“{reason}”</div> : null}
      <div className="mt-1 text-xs text-warn">{approval.reason}</div>
      {canDecide ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => decide("reject")} loading={busy === "reject"} disabled={busy !== null}>
            Reject
          </Button>
          <Button variant="ok" onClick={() => decide("approve")} loading={busy === "approve"} disabled={busy !== null}>
            Approve
          </Button>
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted">A manager or the owner needs to decide this.</div>
      )}
    </div>
  );
}

function Connections({ keys, loading, onToken, reload }: { keys: ApiKeyRecord[]; loading: boolean; onToken: (t: string) => void; reload: () => void }) {
  const { toast } = usePos();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Claude Code");
  const [readOnly, setReadOnly] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const r = await callTool<{ token: string }>("create_api_key", { name, read_only: readOnly });
    setBusy(false);
    if (r.ok && r.data) {
      setCreated(r.data.token);
      onToken(r.data.token);
      reload();
    } else if (!r.ok) toast({ title: "Couldn't create key", body: r.error, tone: "bad" });
  };

  const revoke = async (k: ApiKeyRecord) => {
    if (!confirm(`Revoke "${k.name}"? It stops working immediately.`)) return;
    const r = await callTool("revoke_api_key", { id: k.id, idempotency_key: newKey() });
    if (r.ok) {
      toast({ title: "Connection revoked", body: k.name, tone: "default" });
      reload();
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Connections</h2>
        <Button size="sm" variant="primary" onClick={() => (setCreated(null), setOpen(true))}>
          + API key
        </Button>
      </div>
      {loading ? (
        <Loading />
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted">No connections yet. OAuth clients (Claude, ChatGPT, Perplexity) appear here after you click Allow; API keys are for Claude Code, Cursor and scripts.</p>
      ) : (
        <ul className="divide-y divide-line">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cx("truncate font-semibold", k.revoked && "text-muted line-through")}>{k.name}</span>
                  <Badge tone={k.kind === "oauth" ? "ai" : "neutral"}>{k.kind === "oauth" ? "OAuth" : "API key"}</Badge>
                  {k.scopes.length === 1 ? <Badge>read-only</Badge> : null}
                </div>
                <div className="text-xs text-muted">
                  {k.prefix !== "OAuth" ? <code>{k.prefix}</code> : null} created {timeAgo(k.createdAt)}
                  {k.lastUsedAt ? ` · used ${timeAgo(k.lastUsedAt)}` : " · never used"}
                </div>
              </div>
              {!k.revoked ? (
                <Button size="sm" variant="ghost" onClick={() => revoke(k)}>
                  Revoke
                </Button>
              ) : (
                <Badge tone="bad">revoked</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New API key">
        {created ? (
          <div className="space-y-3">
            <p className="text-sm">Copy it now — it won&apos;t be shown again. The setup snippets in “Connect your AI” now include this key.</p>
            <CopyField value={created} />
            <Button variant="primary" className="w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude Code on Petar's laptop" />
            </Field>
            <Segmented
              value={readOnly ? "read" : "full"}
              onChange={(v) => setReadOnly(v === "read")}
              options={[
                { value: "full", label: "Full access" },
                { value: "read", label: "Read-only" },
              ]}
            />
            <Button variant="primary" className="w-full" onClick={create} loading={busy} disabled={!name.trim()}>
              Create key
            </Button>
          </div>
        )}
      </Sheet>
    </Card>
  );
}

function Guardrails({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const { money, toast, refreshSnapshot } = usePos();
  const [a, setA] = useState(settings.approval);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(a) !== JSON.stringify(settings.approval);
  const save = async () => {
    setBusy(true);
    const r = await callTool("update_settings", { approval: a });
    setBusy(false);
    if (r.ok) {
      toast({ title: "Guardrails saved", tone: "ok" });
      refreshSnapshot();
    } else toast({ title: "Couldn't save", body: r.error, tone: "bad" });
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold">AI guardrails</h2>
        {!canEdit ? <Badge>owner only</Badge> : null}
      </div>
      <p className="mb-4 text-sm text-muted">What AI agents (and cashiers) must get approved. Agents see these rules via the get_policies tool.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Refunds over" hint={money(a.refundOver)}>
          <Input type="number" inputMode="decimal" min={0} step={1} disabled={!canEdit} value={a.refundOver / 100} onChange={(e) => setA({ ...a, refundOver: Math.round(Number(e.target.value) * 100) })} />
        </Field>
        <Field label="Discounts over (%)">
          <Input type="number" inputMode="numeric" min={0} max={100} disabled={!canEdit} value={a.discountPercentOver} onChange={(e) => setA({ ...a, discountPercentOver: Number(e.target.value) })} />
        </Field>
        <Field label="Stock changes over (units)">
          <Input type="number" inputMode="numeric" min={0} disabled={!canEdit} value={a.stockAdjustOver} onChange={(e) => setA({ ...a, stockAdjustOver: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        <Toggle label="Price changes always need approval" checked={a.priceChange} disabled={!canEdit} onChange={(v) => setA({ ...a, priceChange: v })} />
        <Toggle label="Voiding large orders needs approval" checked={a.voidPaid} disabled={!canEdit} onChange={(v) => setA({ ...a, voidPaid: v })} />
      </div>
      {canEdit ? (
        <Button variant="primary" className="mt-4" onClick={save} disabled={!dirty} loading={busy}>
          Save guardrails
        </Button>
      ) : null}
    </Card>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm disabled:opacity-60" role="switch" aria-checked={checked}>
      {label}
      <span className={cx("relative h-6 w-10 shrink-0 rounded-full transition", checked ? "bg-ok" : "bg-surface-3")}>
        <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function TeamPins({ staff }: { staff: { id: string; name: string; role: string; color: string }[] }) {
  const { session, toast } = usePos();
  const [editing, setEditing] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const visible = session.role === "owner" ? staff : staff.filter((s) => s.id === session.staffId);
  const save = async () => {
    const r = await callTool("set_staff_pin", { staff_id: editing, pin });
    if (r.ok) {
      toast({ title: "PIN updated", tone: "ok" });
      setEditing(null);
      setPin("");
    } else toast({ title: "Couldn't update PIN", body: r.error, tone: "bad" });
  };
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-1 text-lg font-bold">Team PINs</h2>
      <p className="mb-3 text-sm text-muted">Change the demo PINs before going live. OAuth consent for AI connectors uses these PINs too.</p>
      <ul className="divide-y divide-line">
        {visible.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5">
            <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: s.color }}>
              {s.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs capitalize text-muted">{s.role}</div>
            </div>
            {editing === s.id ? (
              <div className="flex items-center gap-2">
                <Input className="w-24 text-center tracking-[0.4em]" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" autoFocus />
                <Button size="sm" variant="primary" disabled={pin.length !== 4} onClick={save}>
                  Save
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => (setEditing(s.id), setPin(""))}>
                Change PIN
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
