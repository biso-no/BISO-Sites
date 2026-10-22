import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { notifyWebsite } from "./web-revalidate";

const originalFetch = globalThis.fetch;

describe("notifyWebsite", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_WEB_BASE_URL = "https://biso.no/";
    process.env.CRON_SECRET = "s3cret";
    spyOn(console, "warn").mockImplementation(() => undefined);
    spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_WEB_BASE_URL");
    Reflect.deleteProperty(process.env, "CRON_SECRET");
  });

  it("posts the tags to the website with the secret header", async () => {
    const fetchMock = mock(() => Promise.resolve(new Response("{}")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await notifyWebsite(["benefits"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://biso.no/api/revalidate");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-cron-secret"]).toBe(
      "s3cret"
    );
    expect(init.body).toBe(JSON.stringify({ tags: ["benefits"] }));
    expect(init.signal).toBeDefined();
  });

  it("resolves when fetch rejects", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("down"))
    ) as unknown as typeof fetch;
    await expect(notifyWebsite(["partners"])).resolves.toBeUndefined();
  });

  it("does nothing without configuration", async () => {
    const fetchMock = mock(() => Promise.resolve(new Response("{}")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    Reflect.deleteProperty(process.env, "CRON_SECRET");
    await notifyWebsite(["benefits"]);
    process.env.CRON_SECRET = "s3cret";
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_WEB_BASE_URL");
    await notifyWebsite(["benefits"]);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
