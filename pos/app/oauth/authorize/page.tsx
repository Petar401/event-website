import { getRepo } from "@/lib/server/env";
import { detectAgent, getStaffSession, readClient } from "@/lib/server/auth";
import { Consent } from "./consent";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect an AI" };

type Search = Record<string, string | string[] | undefined>;

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const client = await readClient(get("client_id"));
  const redirectUri = get("redirect_uri");

  let problem: string | null = null;
  if (!client) problem = "This app isn't registered with Tilda (unknown client_id).";
  else if (!client.redirect_uris.includes(redirectUri)) problem = "The redirect address doesn't match what the app registered.";
  else if (get("response_type") !== "code") problem = "Unsupported response_type (expected code).";
  else if (!get("code_challenge") || (get("code_challenge_method") || "S256") !== "S256") problem = "PKCE (S256) is required.";

  if (problem) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-md rounded-3xl border border-line bg-surface p-6 text-center shadow-card">
          <div className="text-4xl">⚠️</div>
          <h1 className="mt-2 text-xl font-bold">Can&apos;t connect</h1>
          <p className="mt-2 text-sm text-muted">{problem}</p>
        </div>
      </main>
    );
  }

  const session = await getStaffSession();
  const staff = (await getRepo().listStaff()).filter((s) => s.active).map(({ id, name, role, color }) => ({ id, name, role, color }));
  const agent = detectAgent(client!.client_name, client!.client_id);

  return (
    <Consent
      session={session}
      staff={staff}
      mode={getRepo().mode}
      client={{ name: client!.client_name, host: safeHost(redirectUri), agent: agent.agent, label: agent.label }}
      params={{
        client_id: get("client_id"),
        redirect_uri: redirectUri,
        state: get("state"),
        code_challenge: get("code_challenge"),
        scope: get("scope"),
      }}
    />
  );
}

function safeHost(u: string) {
  try {
    return new URL(u).host || u;
  } catch {
    return u;
  }
}
