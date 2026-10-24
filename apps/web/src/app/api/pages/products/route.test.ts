import { beforeEach, expect, test, vi } from "vitest";

const cachedPageProductsFeed = vi.fn();
vi.mock("@/lib/data/public-content", () => ({
  cachedPageProductsFeed: (...args: unknown[]) =>
    cachedPageProductsFeed(...args),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
  cachedPageProductsFeed.mockResolvedValue([{ id: "p" }]);
});

const call = (qs: string) =>
  GET(new Request(`http://web.test/api/pages/products${qs}`));

test("clamps the limit to 4 or 8 before the cached reader", async () => {
  await call("?dept=25&limit=999");
  expect(cachedPageProductsFeed).toHaveBeenLastCalledWith("25", "no", 4);
  await call("?dept=25&limit=8&locale=en");
  expect(cachedPageProductsFeed).toHaveBeenLastCalledWith("25", "en", 8);
});

test("an empty department answers [] without reading", async () => {
  const response = await call("");
  expect(await response.json()).toEqual([]);
  expect(cachedPageProductsFeed).not.toHaveBeenCalled();
});

test("a failed read answers an uncacheable empty array", async () => {
  cachedPageProductsFeed.mockRejectedValue(new Error("boom"));
  const response = await call("?dept=25");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
