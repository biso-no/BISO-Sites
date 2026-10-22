import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => ({ isProd: false }));

vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/utils", () => ({
  get isProd() {
    return env.isProd;
  },
}));

import { POST } from "./route";

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://biso.no/api/revalidate", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("revalidate route", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    env.isProd = false;
    vi.stubEnv("CRON_SECRET", "s3cret");
  });

  it("answers 401 for a wrong secret", async () => {
    const response = await POST(
      request({ tags: ["benefits"] }, { "x-cron-secret": "nope" })
    );
    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("answers 500 in production with no secret configured", async () => {
    env.isProd = true;
    vi.stubEnv("CRON_SECRET", "");
    const response = await POST(request({ tags: ["benefits"] }));
    expect(response.status).toBe(500);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("answers 400 for unknown tags", async () => {
    const response = await POST(
      request({ tags: ["x"] }, { "x-cron-secret": "s3cret" })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_tags" });
  });

  it("answers 400 for empty, non-array or malformed bodies", async () => {
    const headers = { "x-cron-secret": "s3cret" };
    for (const body of [{ tags: [] }, { tags: "benefits" }, {}, "{not json"]) {
      const response = await POST(request(body, headers));
      expect(response.status).toBe(400);
    }
  });

  it("revalidates each allowed tag immediately", async () => {
    const response = await POST(
      request(
        { tags: ["benefits", "partners"] },
        { authorization: "Bearer s3cret" }
      )
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      revalidated: ["benefits", "partners"],
    });
    expect(revalidateTag).toHaveBeenCalledWith("benefits", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("partners", { expire: 0 });
  });
});
