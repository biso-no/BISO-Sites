import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { NextResponse } from "next/server";

let authorized = true;
let rows: unknown[] = [{ $id: "25", campus_id: "2" }];
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
// Both clients, so this file does not break a sibling route test that mocks
// the same module.
mock.module("@repo/api/server", () => ({
  createAdminClient: () => Promise.resolve({ db: { listRows } }),
  createPublicClient: () => Promise.resolve({ db: {} }),
}));

const realFetch = globalThis.fetch;
globalThis.fetch = fetchMock as unknown as typeof fetch;
process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test/";

const { GET } = await import("./route");

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  authorized = true;
  rows = [{ $id: "25", campus_id: "2" }];
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
      phone: "+47 000 00 001",
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
