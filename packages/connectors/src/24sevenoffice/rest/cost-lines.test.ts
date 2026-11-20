import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { finago } from "./client";
import { listCostLines } from "./cost-lines";

interface GetResult {
  data: unknown;
  error?: unknown;
  response: Response;
}

function page(data: unknown, nextPage?: number): GetResult {
  const headers = new Headers();
  if (nextPage) {
    headers.set(
      "Link",
      `<https://rest.api.24sevenoffice.com/v1/transactionlines?dateFrom=2026-01-01&page=${nextPage}>; rel="next"`
    );
  }
  return { data, response: new Response(null, { headers }) };
}

function mockGet(results: GetResult[]) {
  let call = 0;
  return spyOn(finago, "GET").mockImplementation((() => {
    const result = results[call];
    call += 1;
    return Promise.resolve(result);
  }) as any);
}

afterEach(() => {
  (finago.GET as any).mockRestore?.();
});

const range = { from: "2026-01-01", to: "2026-12-31" };

describe("listCostLines", () => {
  test("maps project and department dimensions", async () => {
    mockGet([
      page([
        {
          account: { number: 6300 },
          amount: 150.5,
          date: "2026-03-04",
          dimensions: [
            { dimensionType: 1, value: 42, name: "Gala" },
            { dimensionType: 2, value: 7, name: "Events" },
            { dimensionType: 101, value: 3, name: "Oslo" },
          ],
        },
      ]),
    ]);
    const lines = await listCostLines({ accountNumbers: [6300], ...range });
    expect(lines).toEqual([
      {
        accountNumber: 6300,
        amount: 150.5,
        date: "2026-03-04",
        departmentId: "7",
        projectId: "42",
        projectName: "Gala",
      },
    ]);
  });

  test("a line without a project has projectId null", async () => {
    mockGet([
      page([
        {
          account: { number: 6300 },
          amount: 10,
          date: "2026-03-04",
          dimensions: [{ dimensionType: 2, value: 7, name: "Events" }],
        },
        { account: { number: 6300 }, amount: 5, date: "2026-03-05" },
      ]),
    ]);
    const lines = await listCostLines({ accountNumbers: [6300], ...range });
    expect(lines[0]?.projectId).toBeNull();
    expect(lines[0]?.projectName).toBeNull();
    expect(lines[0]?.departmentId).toBe("7");
    expect(lines[1]).toMatchObject({ projectId: null, departmentId: null });
  });

  test("queries each account separately and follows next pages", async () => {
    const line = (n: number) => ({
      account: { number: n },
      amount: 1,
      date: "2026-03-04",
    });
    const spy = mockGet([
      page([line(6300)], 2),
      page([line(6300)]),
      page([line(6400)]),
    ]);
    const lines = await listCostLines({
      accountNumbers: [6300, 6400],
      ...range,
    });
    expect(lines).toHaveLength(3);
    const queries = spy.mock.calls.map((c) => (c as any)[1].params.query);
    expect(queries[0]).toMatchObject({
      accountNumber: 6300,
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      includeDimensions: true,
      limit: 1000,
    });
    expect(queries[1]).toMatchObject({ accountNumber: 6300, page: 2 });
    expect(queries[2]).toMatchObject({ accountNumber: 6400 });
    expect(queries[2].page).toBeUndefined();
  });

  test("rejects when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const spy = mockGet([]);
    await expect(
      listCostLines({
        accountNumbers: [6300],
        signal: controller.signal,
        ...range,
      })
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  test("rejects when a later page fails", async () => {
    mockGet([
      page([{ account: { number: 6300 }, amount: 1, date: "2026-03-04" }], 2),
      { data: undefined, error: { message: "boom" }, response: new Response() },
    ]);
    await expect(
      listCostLines({ accountNumbers: [6300], ...range })
    ).rejects.toThrow();
  });

  test("skips lines without date or amount", async () => {
    mockGet([
      page([
        { account: { number: 6300 }, amount: 1 },
        { account: { number: 6300 }, date: "2026-03-04" },
        { account: { number: 6300 }, amount: 2, date: "2026-03-04" },
      ]),
    ]);
    const lines = await listCostLines({ accountNumbers: [6300], ...range });
    expect(lines).toHaveLength(1);
  });

  test("throws on a repeated next page", async () => {
    mockGet([page([], 1)]);
    await expect(
      listCostLines({ accountNumbers: [6300], ...range })
    ).rejects.toThrow();
  });
});
