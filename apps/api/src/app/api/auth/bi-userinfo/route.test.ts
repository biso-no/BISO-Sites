import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn();

function requestWith(authorization?: string) {
  const headers = new Headers();
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("https://api.biso.no/api/auth/bi-userinfo", {
    headers,
  }) as unknown as Parameters<typeof GET>[0];
}

describe("BI userinfo for Appwrite", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the bearer token to Microsoft and vouches for a bi.no email", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ email: "s1715738@bi.no", name: "Ola", sub: "abc" }),
        { status: 200 }
      )
    );

    const response = await GET(requestWith("Bearer token-123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      email: "s1715738@bi.no",
      email_verified: true,
      name: "Ola",
      sub: "abc",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.microsoft.com/oidc/userinfo");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer token-123"
    );
  });

  it("refuses a call without a bearer token before touching Microsoft", async () => {
    const response = await GET(requestWith());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes Microsoft's 401 through and reports other failures as an outage", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    expect((await GET(requestWith("Bearer bad"))).status).toBe(401);

    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect((await GET(requestWith("Bearer ok"))).status).toBe(502);

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect((await GET(requestWith("Bearer ok"))).status).toBe(502);

    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect((await GET(requestWith("Bearer ok"))).status).toBe(502);
  });
});
