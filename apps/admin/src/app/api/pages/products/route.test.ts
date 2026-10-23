import { beforeEach, expect, mock, test } from "bun:test";
import { NextResponse } from "next/server";

const readPageProductsFeed = mock((..._args: unknown[]) =>
  Promise.resolve([{ id: "p" }])
);
let authorized = true;

mock.module("@repo/shared/utils/page-feeds", () => ({ readPageProductsFeed }));
mock.module("../_lib/feed", () => ({
  feedClient: () => Promise.resolve({}),
  feedLocale: (params: URLSearchParams) =>
    params.get("locale") === "en" ? "en" : "no",
  feedResponse: (payload: unknown) => NextResponse.json(payload),
  requireDepartment: (params: URLSearchParams) => params.get("dept") || null,
  requireFeedAuth: () =>
    Promise.resolve(authorized ? null : NextResponse.json({}, { status: 401 })),
}));

const { GET } = await import("./route");

beforeEach(() => {
  authorized = true;
  readPageProductsFeed.mockClear();
});

const call = (qs: string) =>
  GET(new Request(`http://admin.test/api/pages/products${qs}`));

test("requires editor auth", async () => {
  authorized = false;
  expect((await call("?dept=25")).status).toBe(401);
  expect(readPageProductsFeed).not.toHaveBeenCalled();
});

test("clamps the limit to 4 or 8 before reading", async () => {
  await call("?dept=25&limit=999&locale=en");
  expect(readPageProductsFeed.mock.calls[0]?.slice(1)).toEqual(["25", "en", 4]);
  await call("?dept=25&limit=8");
  expect(readPageProductsFeed.mock.calls[1]?.slice(1)).toEqual(["25", "no", 8]);
});

test("answers an empty array without a department", async () => {
  expect(await (await call("")).json()).toEqual([]);
  expect(readPageProductsFeed).not.toHaveBeenCalled();
});
