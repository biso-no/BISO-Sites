import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn();
const TENANT =
  "https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555";
const upstreamDoc = {
  authorization_endpoint: `${TENANT}/oauth2/v2.0/authorize`,
  token_endpoint: `${TENANT}/oauth2/v2.0/token`,
  userinfo_endpoint: "https://graph.microsoft.com/oidc/userinfo",
};

const request = () =>
  new Request(
    "https://api.biso.no/api/auth/bi-oidc/openid-configuration"
  ) as unknown as Parameters<typeof GET>[0];

describe("BI OIDC discovery for Appwrite", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv(
      "BI_OIDC_WELL_KNOWN_URL",
      `${TENANT}/v2.0/.well-known/openid-configuration`
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("serves Microsoft's document with the userinfo endpoint pointed here", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(upstreamDoc), { status: 200 })
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${TENANT}/v2.0/.well-known/openid-configuration`
    );
    expect(body.userinfo_endpoint).toBe(
      "https://api.biso.no/api/auth/bi-userinfo"
    );
    expect(body.authorization_endpoint).toBe(
      upstreamDoc.authorization_endpoint
    );
    expect(body.token_endpoint).toBe(upstreamDoc.token_endpoint);
    expect(response.headers.get("cache-control")).toContain("max-age=3600");
  });

  it("refuses a multi-tenant document", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...upstreamDoc,
          authorization_endpoint:
            "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        }),
        { status: 200 }
      )
    );

    expect((await GET(request())).status).toBe(500);
  });

  it("fails loudly when unconfigured or when Microsoft is down", async () => {
    vi.stubEnv("BI_OIDC_WELL_KNOWN_URL", "");
    expect((await GET(request())).status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv(
      "BI_OIDC_WELL_KNOWN_URL",
      `${TENANT}/v2.0/.well-known/openid-configuration`
    );
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    expect((await GET(request())).status).toBe(502);

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect((await GET(request())).status).toBe(502);
  });
});
