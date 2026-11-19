import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../receipt-scan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../receipt-scan")>()),
  fitFileForModel: vi.fn(async (data: Buffer, mediaType: string) => ({
    data,
    mediaType,
  })),
}));

import {
  createCheckTools,
  createViewReceiptTool,
  type ToolDeps,
} from "./tools";

const listRows = vi.fn();
const getRow = vi.fn();
const getFileDownload = vi.fn();
const deps = {
  db: { getRow, listRows },
  storage: { getFileDownload },
  today: "2026-11-19",
} as unknown as ToolDeps;

const LIMIT = /limit/i;
const OPTIONS = { abortSignal: undefined, messages: [], toolCallId: "t" };

interface AnyTool {
  execute: (input: unknown, options: unknown) => Promise<any>;
}
const run = (t: unknown, input: unknown) =>
  (t as AnyTool).execute(input, OPTIONS);

function example(over: Record<string, unknown>) {
  return {
    $id: String(over.description ?? "e"),
    account_number: null,
    account_source: null,
    confirmed: true,
    department_id: "dep1",
    description: "pizza",
    final_cost_type: "food",
    final_text: null,
    project_id: null,
    project_name: null,
    source: "student",
    type_source: "student",
    vendor_key: "dominos",
    ...over,
  };
}

function project(over: Record<string, unknown>) {
  return {
    $id: String(over.project_id),
    active: true,
    event_date: null,
    first_line_date: null,
    last_line_date: null,
    line_count: 10,
    name: "KD 2026",
    peak_date: null,
    series: null,
    year: 2026,
    ...over,
  };
}

beforeEach(() => {
  listRows.mockReset();
  getRow.mockReset();
  getFileDownload.mockReset();
});

describe("search_past_bookings", () => {
  it("returns own-text examples with their account", async () => {
    listRows.mockResolvedValue({
      rows: [
        example({
          account_number: 7140,
          account_source: "ai",
          description: "taxi",
          final_cost_type: null,
          final_text: 'Taxi "home" -> x',
          vendor_key: "oslo taxi",
        }),
      ],
    });
    const { search_past_bookings } = createCheckTools(deps);
    const result = await run(search_past_bookings, { vendor: "Oslo Taxi" });
    expect(result.examples).toHaveLength(1);
    expect(result.examples[0]).toMatchObject({
      account: 7140,
      text: "Taxi home x",
      type: null,
    });
  });

  it("shows the project only on confirmed examples and skips unseen unconfirmed picks", async () => {
    listRows.mockResolvedValue({
      rows: [
        example({
          confirmed: true,
          description: "a",
          project_id: "p1",
          project_name: "KD 2026",
        }),
        example({
          confirmed: false,
          description: "b",
          project_id: "p2",
          project_name: "AI pick",
          type_source: "student",
        }),
        example({
          confirmed: false,
          description: "c",
          type_source: null,
        }),
      ],
    });
    const { search_past_bookings } = createCheckTools(deps);
    const result = await run(search_past_bookings, { text: "pizza" });
    expect(result.examples).toHaveLength(2);
    expect(result.examples[0].project).toBe("KD 2026");
    expect(result.examples[1].project).toBeNull();
  });

  it("returns an error result instead of throwing", async () => {
    listRows.mockRejectedValue(new Error("db down"));
    const { search_past_bookings } = createCheckTools(deps);
    const result = await run(search_past_bookings, { text: "x" });
    expect(result).toEqual({ error: expect.any(String) });
  });
});

describe("list_projects", () => {
  it("lists candidates, timing per receipt date and the share class", async () => {
    const tables = (table: string) => {
      if (table === "finago_projects") {
        return {
          rows: [
            project({
              name: "KD 2025",
              project_id: "p25",
              year: 2025,
              active: false,
              event_date: "2025-10-10",
            }),
            project({ name: "KD 2026", project_id: "p26", year: 2026 }),
          ],
        };
      }
      if (table === "finago_project_usage") {
        return {
          rows: [
            {
              department_id: "dep1",
              last_line_date: "2025-10-12",
              project_id: "p25",
            },
          ],
        };
      }
      if (table === "events") {
        return {
          rows: [
            {
              $id: "ev1",
              start_date: "2026-10-09T18:00:00.000+00:00",
              translation_refs: [{ locale: "no", title: "KD fest" }],
            },
          ],
        };
      }
      return { rows: [] };
    };
    listRows.mockImplementation((_d: string, table: string) =>
      Promise.resolve(tables(table))
    );
    getRow.mockResolvedValue({ project_share: 0.9 });
    const { list_projects } = createCheckTools(deps);
    const result = await run(list_projects, {
      departmentId: "dep1",
      receiptDates: ["2026-09-01", "2026-09-01"],
    });
    expect(result.shareClass).toBe("expected");
    expect(
      result.candidates.map((c: { projectId: string }) => c.projectId)
    ).toEqual(["p26"]);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].timings).toHaveLength(1);
    expect(result.series[0].timings[0].receiptDate).toBe("2026-09-01");
    expect(result.series[0].timings[0].suggested).toBe("p26");
    expect(result.series[0].editions[1].eventDate).toBe("2026-10-09");
  });

  it("notes missing events and an unknown share instead of hiding them", async () => {
    listRows.mockImplementation((_d: string, table: string) =>
      table === "events"
        ? Promise.reject(new Error("no events"))
        : Promise.resolve({ rows: [] })
    );
    getRow.mockRejectedValue(new Error("no dept"));
    const { list_projects } = createCheckTools(deps);
    const result = await run(list_projects, {
      departmentId: "dep1",
      receiptDates: [],
    });
    expect(result.shareClass).toBe("unknown");
    expect(result.notes).toHaveLength(2);
  });

  it("matches the series as a whole word only", async () => {
    const eventsFor = (titles: string[]) =>
      titles.map((title, i) => ({
        $id: String(i),
        start_date: "2026-10-09T10:00:00.000+00:00",
        translation_refs: [{ locale: "no", title }],
      }));
    const timingFor = async (titles: string[]) => {
      listRows.mockImplementation((_d: string, table: string) => {
        if (table === "finago_projects") {
          return Promise.resolve({
            rows: [project({ name: "KD 2026", project_id: "p26" })],
          });
        }
        if (table === "finago_project_usage") {
          return Promise.resolve({
            rows: [
              {
                department_id: "dep1",
                last_line_date: "2026-01-01",
                project_id: "p26",
              },
            ],
          });
        }
        return Promise.resolve({
          rows: table === "events" ? eventsFor(titles) : [],
        });
      });
      getRow.mockResolvedValue({ project_share: 0.5 });
      const { list_projects } = createCheckTools(deps);
      const result = await run(list_projects, {
        departmentId: "dep1",
        receiptDates: ["2026-09-01"],
      });
      return result.series[0].editions[0].eventDateSource;
    };
    expect(await timingFor(["Workday", "kdfest"])).not.toBe("website");
    expect(await timingFor(["KD fest"])).toBe("website");
    expect(await timingFor(["Karrieredagene KD 2026"])).toBe("website");
  });

  it("asks for the newest events, newest first", async () => {
    listRows.mockResolvedValue({ rows: [] });
    getRow.mockResolvedValue({ project_share: 0.5 });
    const { list_projects } = createCheckTools(deps);
    await run(list_projects, { departmentId: "dep1", receiptDates: [] });
    const call = listRows.mock.calls.find((c) => c[1] === "events");
    const joined = (call?.[2] as string[]).join(" ");
    expect(joined).toContain("orderDesc");
    expect(joined).toContain("2023-01-01");
  });

  it("errors on a failing lookup", async () => {
    listRows.mockRejectedValue(new Error("boom"));
    const { list_projects } = createCheckTools(deps);
    expect(
      await run(list_projects, { departmentId: "d", receiptDates: [] })
    ).toEqual({ error: expect.any(String) });
  });
});

describe("find_events", () => {
  it("returns published events of the window, filtered by text", async () => {
    listRows.mockResolvedValue({
      rows: [
        {
          $id: "a",
          department_id: "dep1",
          start_date: "2026-10-09T18:00:00.000+00:00",
          translation_refs: [{ locale: "no", title: 'Kickoff "party"' }],
        },
        {
          $id: "b",
          department_id: "dep1",
          start_date: "2026-10-10T18:00:00.000+00:00",
          translation_refs: [{ locale: "no", title: "Quiz" }],
        },
      ],
    });
    const { find_events } = createCheckTools(deps);
    const result = await run(find_events, {
      from: "2026-10-01",
      text: "kickoff",
      to: "2026-10-31",
    });
    expect(result.events).toEqual([
      { date: "2026-10-09", departmentId: "dep1", title: "Kickoff party" },
    ]);
    const queries = listRows.mock.calls[0][2] as string[];
    expect(queries.join(" ")).toContain("published");
  });
});

describe("search_accounts", () => {
  it("finds active cost accounts by name or number, at most 20", async () => {
    listRows.mockResolvedValue({
      rows: [
        { account_number: 3000, active: true, name: "Sales food" },
        { account_number: 7140, active: true, name: "Travel food" },
        { account_number: 6300, active: true, name: "Rent" },
        ...Array.from({ length: 30 }, (_, i) => ({
          account_number: 5000 + i,
          active: true,
          name: `Food ${i}`,
        })),
      ],
    });
    const { search_accounts } = createCheckTools(deps);
    const result = await run(search_accounts, { text: "food" });
    expect(result.accounts).toHaveLength(20);
    expect(
      result.accounts.some((a: { number: number }) => a.number === 3000)
    ).toBe(false);
    const byNumber = await run(search_accounts, { text: "6300" });
    expect(byNumber.accounts).toEqual([{ name: "Rent", number: 6300 }]);
  });
});

describe("view_receipt", () => {
  const attachments = {
    rows: [
      { $id: "att1", type: "image/png", url: "file1" },
      { $id: "att2", type: "application/pdf", url: "file2" },
    ],
  };

  it("returns the file for a receipt of this expense", async () => {
    listRows.mockResolvedValue(attachments);
    getFileDownload.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    const tool = createViewReceiptTool(deps, "exp1");
    const result = await run(tool, { receiptId: "att1" });
    expect(result).toMatchObject({ mediaType: "image/png" });
    expect(result.base64).toBe(Buffer.from([1, 2, 3]).toString("base64"));
    expect(getFileDownload).toHaveBeenCalledWith("expenses", "file1");
  });

  it("refuses another expense's receipt", async () => {
    listRows.mockResolvedValue(attachments);
    const tool = createViewReceiptTool(deps, "exp1");
    const result = await run(tool, { receiptId: "other" });
    expect(result).toEqual({ error: expect.any(String) });
    expect(getFileDownload).not.toHaveBeenCalled();
  });

  it("allows at most three downloads across parallel calls", async () => {
    listRows.mockResolvedValue(attachments);
    getFileDownload.mockResolvedValue(new Uint8Array([1]).buffer);
    const tool = createViewReceiptTool(deps, "exp1");
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => run(tool, { receiptId: "att1" }))
    );
    expect(results.filter((r) => r.error)).toHaveLength(1);
    expect(getFileDownload).toHaveBeenCalledTimes(3);
  });

  it("does not spend a view on a refused receipt", async () => {
    listRows.mockResolvedValue(attachments);
    getFileDownload.mockResolvedValue(new Uint8Array([1]).buffer);
    const tool = createViewReceiptTool(deps, "exp1");
    for (let i = 0; i < 5; i++) {
      await run(tool, { receiptId: "nope" });
    }
    expect((await run(tool, { receiptId: "att1" })).error).toBeUndefined();
  });

  it("allows at most three views per run", async () => {
    listRows.mockResolvedValue(attachments);
    getFileDownload.mockResolvedValue(new Uint8Array([1]).buffer);
    const tool = createViewReceiptTool(deps, "exp1");
    for (let i = 0; i < 3; i++) {
      expect((await run(tool, { receiptId: "att1" })).error).toBeUndefined();
    }
    const fourth = await run(tool, { receiptId: "att1" });
    expect(fourth.error).toMatch(LIMIT);
    expect(getFileDownload).toHaveBeenCalledTimes(3);
  });
});
