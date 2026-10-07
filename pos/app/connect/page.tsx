import Link from "next/link";
import { ConnectGuide } from "@/components/ai/connect-guide";

export const metadata = { title: "Connect your AI", description: "Connect Claude, ChatGPT, Perplexity, Copilot, Cursor or Gemini CLI to Tilda POS over MCP." };

export default function ConnectPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Link href="/" className="inline-flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-accent text-lg font-black text-accent-ink">t</span>
        <span className="text-lg font-bold">tilda</span>
      </Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">Connect your AI to Tilda</h1>
      <p className="mt-3 text-ink-2">
        Tilda is a point of sale with a built-in MCP server. Add it to your AI assistant once and run the shop by chat: ring up orders, check stock, refund (with approvals), draft purchase orders and get end-of-day briefings.
      </p>
      <div className="mt-8">
        <ConnectGuide />
      </div>
    </main>
  );
}
