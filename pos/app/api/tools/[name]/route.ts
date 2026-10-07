import { runAsStaff } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await req.json().catch(() => ({}));
  return runAsStaff(name, body);
}
