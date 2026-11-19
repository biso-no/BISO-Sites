import { beforeEach, describe, expect, it, mock } from "bun:test";

const forwardEnvelope = mock();

mock.module("@sentry/nextjs/tunnel", () => ({ POST: forwardEnvelope }));

const relayRequest = (contentLength: string) =>
  new Request("https://example.com/api/relay", {
    method: "POST",
    headers: { "content-length": contentLength },
    body: "x",
  });

describe("relay route", () => {
  beforeEach(() => {
    forwardEnvelope.mockReset();
    forwardEnvelope.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("answers 413 above the cap without calling the SDK", async () => {
    const { POST } = await import("./route");
    const response = await POST(relayRequest("10485761"));
    expect(response.status).toBe(413);
    expect(forwardEnvelope).not.toHaveBeenCalled();
  });

  it("delegates a small body to the SDK", async () => {
    const { POST } = await import("./route");
    const request = relayRequest("2048");
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(forwardEnvelope).toHaveBeenCalledWith(request);
  });
});
