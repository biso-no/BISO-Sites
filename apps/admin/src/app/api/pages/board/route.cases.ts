import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { NextResponse } from "next/server";

let authorized = true;
const DEPARTMENT = { $id: "25", Name: "OSL Finansforeningen", campus_id: "2" };
let rows: unknown[] = [DEPARTMENT];
const listRows = mock((..._args: unknown[]) => Promise.resolve({ rows }));
const fetchMock = mock((..._args: unknown[]) =>
  Promise.resolve(
    Response.json({
      members: [
        {
          email: "leder@example.org",
          name: "Kari Eksempel",
          phone: "+47 000 00 001",
          profilePhotoUrl: "data:image/png;base64,AAAA",
          role: "Leder",
        },
        { name: "" },
        null,
      ],
      success: true,
    })
  )
);

mock.module("@/lib/api-auth", () => ({
  requireApiAuth: () =>
    Promise.resolve(
      authorized
        ? { ctx: {} }
        : { response: NextResponse.json({}, { status: 401 }) }
    ),
}));
// The feed reads with the guest client, like the other feeds. This file runs
// in its own process (see route-cases.test.ts), so the mock cannot leak.
mock.module("@repo/api/server", () => ({
  createAdminClient: () => Promise.resolve({ db: {} }),
  createPublicClient: () => Promise.resolve({ db: { listRows } }),
}));

const realFetch = globalThis.fetch;
globalThis.fetch = fetchMock as unknown as typeof fetch;
const realBase = process.env.NEXT_PUBLIC_API_BASE_URL;
process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test/";

const { GET } = await import("./route");

afterAll(() => {
  globalThis.fetch = realFetch;
  if (realBase === undefined) {
    // biome-ignore lint/performance/noDelete: assigning undefined would store the string "undefined".
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_API_BASE_URL = realBase;
  }
});

beforeEach(() => {
  authorized = true;
  rows = [DEPARTMENT];
  listRows.mockClear();
  fetchMock.mockClear();
});

const call = (qs: string) =>
  GET(new Request(`http://admin.test/api/pages/board${qs}`));

test("requires editor auth before reading anything", async () => {
  authorized = false;
  expect((await call("?dept=25")).status).toBe(401);
  expect(listRows).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("resolves the campus from the department, then asks apps/api", async () => {
  const response = await call("?dept=25");
  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    "http://api.test/api/campus/2/25/board"
  );
  expect(await response.json()).toEqual([
    {
      email: "leder@example.org",
      name: "Kari Eksempel",
      photo: { src: "data:image/png;base64,AAAA" },
      role: "Leder",
    },
  ]);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test("an unknown department is an empty board", async () => {
  rows = [];
  expect(await (await call("?dept=25")).json()).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a board entry never carries a phone number", async () => {
  const items = (await (await call("?dept=25")).json()) as object[];
  for (const item of items) {
    expect(item).not.toHaveProperty("phone");
  }
});

test("a non-public unit (an operating ledger) is an empty board", async () => {
  rows = [{ ...DEPARTMENT, Name: "Drift Campus Oslo" }];
  expect(await (await call("?dept=25")).json()).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a missing or malformed department never reaches the reader", async () => {
  expect(await (await call("")).json()).toEqual([]);
  expect(await (await call("?dept=a%20b")).json()).toEqual([]);
  expect(listRows).not.toHaveBeenCalled();
});

test("an API failure answers an empty array", async () => {
  fetchMock.mockImplementationOnce(() =>
    Promise.resolve(new Response("nope", { status: 502 }))
  );
  const response = await call("?dept=25");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});
