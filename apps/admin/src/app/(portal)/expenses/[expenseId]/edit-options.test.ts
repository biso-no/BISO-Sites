import { describe, expect, spyOn, test } from "bun:test";
import type {
  FinagoProjects,
  FinagoProjectUsage,
} from "@repo/api/types/appwrite";
import { loadReceiptEditOptions, projectOptions } from "./edit-options";

const project = (
  id: string,
  name: string,
  year: number | null,
  active = true
) =>
  ({
    $id: id,
    active,
    name,
    project_id: id,
    series: name.toLowerCase(),
    year,
  }) as FinagoProjects;

/** An edition of the KD series. */
const kd = (id: string, year: number, active = true) => ({
  ...project(id, `KD ${year}`, year, active),
  series: "kd",
});

const usage = (projectId: string, departmentId: string) =>
  ({
    department_id: departmentId,
    last_line_date: "2026-05-01",
    project_id: projectId,
  }) as FinagoProjectUsage;

describe("projectOptions", () => {
  test("options list the department's candidates first", () => {
    const options = projectOptions({
      departmentId: "d1",
      projects: [
        project("a", "Aaa 2026", 2026),
        project("b", "Bbb 2026", 2026),
        project("c", "Ccc 2026", 2026),
        project("old", "Old 2019", 2019, false),
      ],
      today: "2026-11-19",
      usage: [usage("c", "d1"), usage("a", "other")],
    });
    expect(options).toEqual([
      { name: "Ccc 2026", projectId: "c", suggested: true },
      { name: "Aaa 2026", projectId: "a", suggested: false },
      { name: "Bbb 2026", projectId: "b", suggested: false },
    ]);
  });

  test("next year's edition is suggested after finance closes the one in use", () => {
    const options = projectOptions({
      departmentId: "d1",
      projects: [
        kd("k26", 2026, false),
        kd("k27", 2027),
        project("x", "Other 2026", 2026),
      ],
      today: "2026-11-19",
      usage: [usage("k26", "d1")],
    });
    expect(options).toEqual([
      { name: "KD 2027", projectId: "k27", suggested: true },
      { name: "Other 2026", projectId: "x", suggested: false },
    ]);
  });

  test("without a department everything is a plain option", () => {
    const options = projectOptions({
      departmentId: null,
      projects: [project("a", "Aaa 2026", 2026)],
      today: "2026-11-19",
      usage: [],
    });
    expect(options).toEqual([
      { name: "Aaa 2026", projectId: "a", suggested: false },
    ]);
  });

  test("æ, ø and å sort after z", () => {
    const options = projectOptions({
      departmentId: null,
      projects: [
        project("1", "Åpning 2026", 2026),
        project("2", "Zebra 2026", 2026),
        project("3", "Ærlig 2026", 2026),
        project("4", "Aaa 2026", 2026),
      ],
      today: "2026-11-19",
      usage: [],
    });
    expect(options.map((o) => o.projectId)).toEqual(["4", "2", "3", "1"]);
  });
});

type Db = Parameters<typeof loadReceiptEditOptions>[0];

/** A db that answers `equal` filters from in-memory tables. */
function fakeDb(
  tables: Record<string, Record<string, unknown>[]>,
  failing: string[] = []
): Db {
  return {
    listRows: (_db: string, table: string, queries: string[] = []) => {
      if (failing.includes(table)) {
        return Promise.reject(new Error(`Table not found: ${table}`));
      }
      let rows = tables[table] ?? [];
      for (const query of queries.map(
        (q) =>
          JSON.parse(q) as {
            attribute: string;
            method: string;
            values: unknown[];
          }
      )) {
        if (query.method === "equal") {
          rows = rows.filter((row) =>
            query.values.includes(row[query.attribute])
          );
        }
      }
      return Promise.resolve({ rows, total: rows.length });
    },
  } as unknown as Db;
}

describe("loadReceiptEditOptions", () => {
  const types = [
    {
      account_number: 6800,
      active: true,
      label: "Office",
      label_no: "Kontor",
      slug: "office",
      tax_code: null,
    },
  ];
  const accounts = [{ account_number: 6800, active: true, name: "Office" }];

  test("a closed edition the department used still suggests next year's", async () => {
    const options = await loadReceiptEditOptions(
      fakeDb({
        expense_cost_types: types,
        finago_project_usage: [usage("k26", "d1")],
        finago_projects: [kd("k26", 2026, false), kd("k27", 2027)],
        ledger_accounts: accounts,
      }),
      "d1"
    );
    expect(options.projects).toEqual([
      { name: "KD 2027", projectId: "k27", suggested: true },
    ]);
  });

  test("without the project tables the page still gets its other options", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    const options = await loadReceiptEditOptions(
      fakeDb({ expense_cost_types: types, ledger_accounts: accounts }, [
        "finago_projects",
        "finago_project_usage",
      ]),
      "d1"
    );
    warn.mockRestore();
    expect(options.projects).toEqual([]);
    expect(options.types.map((type) => type.slug)).toEqual(["office"]);
    expect(options.accounts.map((a) => a.accountNumber)).toEqual([6800]);
  });
});
