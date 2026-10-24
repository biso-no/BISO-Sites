import { beforeEach, expect, test, vi } from "vitest";

const readBoardFeed = vi.fn();
vi.mock("@/lib/data/page-board", () => ({
  readBoardFeed: (...args: unknown[]) => readBoardFeed(...args),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
  readBoardFeed.mockResolvedValue([{ name: "Kari Eksempel", role: "Leder" }]);
});

const call = (qs: string) =>
  GET(new Request(`http://web.test/api/pages/board${qs}`));

test("answers the department's board as a bare array", async () => {
  const response = await call("?dept=25");
  expect(readBoardFeed).toHaveBeenCalledWith("25");
  expect(await response.json()).toEqual([
    { name: "Kari Eksempel", role: "Leder" },
  ]);
});

test("a missing or malformed department answers [] without reading", async () => {
  expect(await (await call("")).json()).toEqual([]);
  expect(await (await call("?dept=a%20b")).json()).toEqual([]);
  expect(await (await call(`?dept=${"x".repeat(40)}`)).json()).toEqual([]);
  expect(readBoardFeed).not.toHaveBeenCalled();
});

test("a failed read answers an uncacheable empty array", async () => {
  readBoardFeed.mockRejectedValue(new Error("boom"));
  const response = await call("?dept=25");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
