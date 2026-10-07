import { ALL_SCOPES } from "@/lib/server/auth";
import { CORS, originOf } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = originOf(req);
  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      scopes_supported: ALL_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "Tilda POS",
      resource_documentation: `${origin}/connect`,
    },
    { headers: CORS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
