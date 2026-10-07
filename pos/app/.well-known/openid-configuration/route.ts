import { ALL_SCOPES } from "@/lib/server/auth";
import { CORS, originOf } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = originOf(req);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ALL_SCOPES,
      client_id_metadata_document_supported: true,
      service_documentation: `${origin}/connect`,
    },
    { headers: CORS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
