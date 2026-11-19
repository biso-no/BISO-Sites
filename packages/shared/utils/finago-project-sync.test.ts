import { describe, expect, it } from "vitest";
import { type SyncDb, syncFinagoProjects } from "./finago-project-sync";

type Row = Record<string, unknown> & { $id: string };
interface Q {
  attribute?: string;
  method: string;
  values?: unknown[];
}

function fakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    departments: [],
    expense_cost_types: [],
    finago_project_usage: [],
    finago_projects: [],
    ledger_accounts: [],
    ...seed,
  };
  const writes: { op: string; table: string; data: unknown }[] = [];
  let counter = 0;
  const db: SyncDb = {
    createRow: (_d, table, id, data) => {
      writes.push({ data, op: "create", table });
      counter += 1;
      const row = { ...data, $id: id === "unique()" ? `n${counter}` : id };
      tables[table]?.push(row as Row);
      return Promise.resolve(row);
    },
    listRows: (_d, table, queries = []) => {
      const qs = queries.map((q) => JSON.parse(q) as Q);
      let rows = [...(tables[table] ?? [])];
      for (const q of qs) {
        if (q.method === "equal") {
          rows = rows.filter((r) => q.values?.includes(r[q.attribute ?? ""]));
        }
        if (q.method === "between") {
          rows = rows.filter(
            (r) =>
              (r[q.attribute ?? ""] as number) >= (q.values?.[0] as number) &&
              (r[q.attribute ?? ""] as number) <= (q.values?.[1] as number)
          );
        }
      }
      const offset = qs.find((q) => q.method === "offset")?.values?.[0] ?? 0;
      const limit = qs.find((q) => q.method === "limit")?.values?.[0] ?? 25;
      return Promise.resolve({
        rows: rows.slice(Number(offset), Number(offset) + Number(limit)),
      });
    },
    updateRow: (_d, table, id, data) => {
      writes.push({ data, op: "update", table });
      const row = tables[table]?.find((r) => r.$id === id);
      Object.assign(row ?? {}, data);
      return Promise.resolve(row);
    },
  };
  return { db, tables, writes };
}

const now = new Date("2026-11-19T10:00:00Z");
const line = (o: Record<string, unknown>) => ({
  accountNumber: 6000,
  amount: 100,
  date: "2026-05-01",
  departmentId: "d1",
  projectId: "p1",
  ...o,
});
const base = {
  getProjects: () =>
    Promise.resolve([{ name: "Fadderullan 2026", projectId: "p1" }]),
  listCostLines: () => Promise.resolve([line({})]),
  now,
};
const seed = (extra: Record<string, Row[]> = {}) => ({
  departments: [{ $id: "d1" }, { $id: "d2" }],
  ledger_accounts: [{ $id: "a", account_number: 6000, active: true }],
  ...extra,
});

describe("syncFinagoProjects", () => {
  it("upserts projects with series and year", async () => {
    const { db, tables } = fakeDb(seed());
    const result = await syncFinagoProjects(db, base);
    expect(result).toEqual({
      departments: 1,
      inactive: 0,
      partial: false,
      projects: 1,
      usageRows: 1,
    });
    expect(tables.finago_projects[0]).toMatchObject({
      active: true,
      line_count: 1,
      name: "Fadderullan 2026",
      project_id: "p1",
      series: "fadderullan",
      year: 2026,
    });
    expect(tables.finago_project_usage[0]).toMatchObject({
      department_id: "d1",
      project_id: "p1",
    });
  });

  it("recomputes series and year on existing rows and keeps the element name", async () => {
    const { db, tables } = fakeDb(
      seed({
        finago_projects: [
          {
            $id: "r1",
            name: "Old name",
            project_id: "p1",
            series: "old (",
            year: 1999,
          },
        ],
      })
    );
    await syncFinagoProjects(db, base);
    expect(tables.finago_projects).toHaveLength(1);
    expect(tables.finago_projects[0]).toMatchObject({
      name: "Fadderullan 2026",
      series: "fadderullan",
      year: 2026,
    });
  });

  it("a failed project fetch marks nothing inactive", async () => {
    const { db, writes } = fakeDb(seed());
    await expect(
      syncFinagoProjects(db, {
        ...base,
        getProjects: () => Promise.reject(new Error("down")),
      })
    ).rejects.toThrow("down");
    expect(writes).toEqual([]);
  });

  it("marks a project inactive when it leaves the list", async () => {
    const { db, tables } = fakeDb(
      seed({
        finago_projects: [
          { $id: "r9", active: true, name: "Gone 2020", project_id: "p9" },
        ],
      })
    );
    const result = await syncFinagoProjects(db, base);
    expect(result.inactive).toBe(1);
    expect(tables.finago_projects.find((r) => r.$id === "r9")?.active).toBe(
      false
    );
  });

  it("writes each department's project share", async () => {
    const { db, tables } = fakeDb(seed());
    await syncFinagoProjects(db, {
      ...base,
      listCostLines: () =>
        Promise.resolve([
          line({}),
          line({ projectId: null }),
          line({ projectId: null, departmentId: "d2" }),
        ]),
    });
    expect(tables.departments.find((r) => r.$id === "d1")?.project_share).toBe(
      0.5
    );
    expect(tables.departments.find((r) => r.$id === "d2")?.project_share).toBe(
      0
    );
  });

  it("a partial run marks nothing inactive", async () => {
    const { db, tables } = fakeDb(
      seed({
        finago_projects: [
          { $id: "r9", active: true, name: "Gone", project_id: "p9" },
        ],
        ledger_accounts: [
          { $id: "a", account_number: 6000, active: true },
          { $id: "b", account_number: 6100, active: true },
        ],
      })
    );
    const result = await syncFinagoProjects(db, {
      ...base,
      budgetMs: 40,
      listCostLines: ({ accountNumbers, signal }) =>
        accountNumbers[0] === 6000
          ? Promise.resolve([line({})])
          : new Promise((_, reject) => {
              signal?.addEventListener("abort", () =>
                reject(new Error("aborted"))
              );
            }),
    });
    expect(result.partial).toBe(true);
    expect(result.inactive).toBe(0);
    expect(tables.finago_projects.find((r) => r.$id === "r9")?.active).toBe(
      true
    );
    expect(
      tables.finago_projects.find((r) => r.project_id === "p1")?.line_count
    ).toBe(1);
    expect(
      tables.departments.find((r) => r.$id === "d1")?.project_share
    ).toBeUndefined();
  });
});
