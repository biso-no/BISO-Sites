import { describe, expect, it, vi } from "vitest";
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
  projectName: null,
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
      accountCount: 1,
      completed: 1,
      departments: 1,
      inactive: 0,
      partial: false,
      projects: 1,
      usageRows: 1,
      warnings: [],
      written: 1,
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

  it("only a full run stamps synced_at", async () => {
    const { db, tables } = fakeDb(seed());
    await syncFinagoProjects(db, { ...base, budgetMs: 0 });
    expect(tables.finago_projects[0]?.synced_at).toBeUndefined();
    await syncFinagoProjects(db, base);
    expect(tables.finago_projects[0]?.synced_at).toBe(now.toISOString());
  });

  const abortable = ({
    accountNumbers,
    signal,
  }: {
    accountNumbers: number[];
    signal?: AbortSignal;
  }) =>
    accountNumbers[0] === 6000
      ? Promise.resolve([line({})])
      : new Promise<never>((_, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
  const twoAccounts = [
    { $id: "a", account_number: 6000, active: true },
    { $id: "b", account_number: 6100, active: true },
  ];

  it("keeps a deactivated edition's history as an inactive row", async () => {
    const { db, tables } = fakeDb(seed());
    const result = await syncFinagoProjects(db, {
      ...base,
      listCostLines: () =>
        Promise.resolve([
          line({}),
          line({
            date: "2024-12-01",
            projectId: "p7",
            projectName: "KD (2024)",
          }),
          line({
            date: "2025-02-01",
            projectId: "p7",
            projectName: "KD (2024)",
          }),
          line({ projectId: "p8", projectName: null }),
        ]),
    });
    expect(
      tables.finago_projects.find((r) => r.project_id === "p7")
    ).toMatchObject({
      active: false,
      first_line_date: "2024-12-01",
      last_line_date: "2025-02-01",
      line_count: 2,
      name: "KD (2024)",
      series: "kd",
      year: 2024,
    });
    expect(
      tables.finago_projects.find((r) => r.project_id === "p8")
    ).toBeUndefined();
    expect(tables.finago_project_usage.some((r) => r.project_id === "p7")).toBe(
      true
    );
    expect(result).toMatchObject({ projects: 1, written: 2 });
  });

  it("refreshes stats on an existing inactive row and keeps it inactive", async () => {
    const { db, tables } = fakeDb(
      seed({
        finago_projects: [
          {
            $id: "r7",
            active: false,
            line_count: 0,
            name: "KD (2024)",
            project_id: "p7",
          },
        ],
      })
    );
    await syncFinagoProjects(db, {
      ...base,
      listCostLines: () =>
        Promise.resolve([line({ projectId: "p7", projectName: null })]),
    });
    expect(tables.finago_projects.find((r) => r.$id === "r7")).toMatchObject({
      active: false,
      line_count: 1,
    });
  });

  it("a partial run never shrinks existing project or usage stats", async () => {
    const { db, tables } = fakeDb(
      seed({
        finago_project_usage: [
          {
            $id: "u1",
            department_id: "d1",
            first_line_date: "2025-01-01",
            last_line_date: "2026-10-01",
            line_count: 40,
            project_id: "p1",
          },
        ],
        finago_projects: [
          {
            $id: "r1",
            first_line_date: "2025-01-01",
            last_line_date: "2026-10-01",
            line_count: 50,
            name: "Fadderullan 2026",
            peak_date: "2026-08-20",
            project_id: "p1",
          },
        ],
        ledger_accounts: twoAccounts,
      })
    );
    const result = await syncFinagoProjects(db, {
      ...base,
      budgetMs: 40,
      listCostLines: abortable,
    });
    expect(result).toMatchObject({
      accountCount: 2,
      completed: 1,
      partial: true,
    });
    expect(tables.finago_projects[0]).toMatchObject({
      first_line_date: "2025-01-01",
      last_line_date: "2026-10-01",
      line_count: 50,
      peak_date: "2026-08-20",
    });
    expect(tables.finago_project_usage[0]).toMatchObject({
      first_line_date: "2025-01-01",
      last_line_date: "2026-10-01",
      line_count: 40,
    });
  });

  it("reads 24 months up to the day after now", async () => {
    const { db } = fakeDb(seed());
    const calls: { from: string; to: string }[] = [];
    await syncFinagoProjects(db, {
      ...base,
      listCostLines: ({ from, to }) => {
        calls.push({ from, to });
        return Promise.resolve([]);
      },
    });
    expect(calls).toEqual([{ from: "2024-11-19", to: "2026-11-20" }]);
  });

  const accountRows = (numbers: number[]) =>
    numbers.map((n) => ({ $id: `a${n}`, account_number: n, active: true }));
  const hang = (signal?: AbortSignal) =>
    new Promise<never>((_, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });

  it("reads four accounts at a time", async () => {
    const numbers = [6000, 6100, 6200, 6300, 6400, 6500, 6600, 6700, 6800];
    const { db } = fakeDb(seed({ ledger_accounts: accountRows(numbers) }));
    let running = 0;
    let most = 0;
    const read: number[] = [];
    const result = await syncFinagoProjects(db, {
      ...base,
      listCostLines: async ({ accountNumbers }) => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        read.push(accountNumbers[0] as number);
        return [];
      },
    });
    expect(most).toBe(4);
    expect(read.sort()).toEqual(numbers);
    expect(result).toMatchObject({ completed: 9, partial: false });
  });

  it("a timed-out run counts only the accounts read in a row from the start", async () => {
    const { db, tables } = fakeDb(
      seed({ ledger_accounts: accountRows([6000, 6100, 6200, 6300, 6400]) })
    );
    const result = await syncFinagoProjects(db, {
      ...base,
      budgetMs: 40,
      listCostLines: ({ accountNumbers, signal }) => {
        const account = accountNumbers[0];
        if (account === 6200) {
          return hang(signal);
        }
        return Promise.resolve([
          line({ accountNumber: account, projectId: `p${account}` }),
        ]);
      },
      startOffset: 1,
    });
    // 6100 is read, 6200 times out; 6300, 6400 and 6000 are read too, but
    // the next run must start at 6200, so only one account is complete.
    expect(result).toMatchObject({
      accountCount: 5,
      completed: 1,
      partial: true,
    });
    // Lines from every account that finished are kept.
    expect(tables.finago_project_usage.map((r) => r.project_id).sort()).toEqual(
      ["p6000", "p6100", "p6300", "p6400"]
    );
  });

  it("the first failed account fails the run and stops the others", async () => {
    const { db, writes } = fakeDb(
      seed({ ledger_accounts: accountRows([6000, 6100, 6200]) })
    );
    let aborted = 0;
    await expect(
      syncFinagoProjects(db, {
        ...base,
        listCostLines: ({ accountNumbers, signal }) => {
          if (accountNumbers[0] === 6100) {
            return Promise.reject(new Error("finago 500"));
          }
          signal?.addEventListener("abort", () => {
            aborted += 1;
          });
          return hang(signal);
        },
      })
    ).rejects.toThrow("finago 500");
    expect(aborted).toBe(2);
    expect(writes).toEqual([]);
  });

  it("a project's peak comes from its own year's window", async () => {
    const { db, tables } = fakeDb(
      seed({
        finago_projects: [
          { $id: "r7", active: false, name: "KD 2024", project_id: "p7" },
        ],
      })
    );
    await syncFinagoProjects(db, {
      ...base,
      getProjects: () =>
        Promise.resolve([{ name: "KD 2025", projectId: "p1" }]),
      listCostLines: () =>
        Promise.resolve([
          line({ amount: 1000, date: "2025-03-01" }),
          // A large late invoice the year after.
          line({ amount: 5000, date: "2026-02-01" }),
          line({ amount: 100, date: "2024-12-01", projectId: "p7" }),
          line({ amount: 5000, date: "2025-03-01", projectId: "p7" }),
        ]),
    });
    expect(
      tables.finago_projects.find((r) => r.project_id === "p1")?.peak_date
    ).toBe("2025-03-01");
    // An unlisted edition's year comes from its stored name.
    expect(tables.finago_projects.find((r) => r.$id === "r7")?.peak_date).toBe(
      "2024-12-01"
    );
  });

  const activeRows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      $id: `r${i}`,
      active: true,
      name: `Project ${i}`,
      project_id: `x${i}`,
    }));

  it("an empty project list marks nothing inactive", async () => {
    const { db, tables } = fakeDb(seed({ finago_projects: activeRows(3) }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await syncFinagoProjects(db, {
      ...base,
      getProjects: () => Promise.resolve([]),
    });
    warn.mockRestore();
    expect(result).toMatchObject({
      inactive: 0,
      warnings: ["empty_project_list"],
    });
    expect(tables.finago_projects.every((r) => r.active === true)).toBe(true);
  });

  it("a list under half the active projects marks nothing inactive", async () => {
    const { db, tables } = fakeDb(seed({ finago_projects: activeRows(5) }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await syncFinagoProjects(db, {
      ...base,
      getProjects: () =>
        Promise.resolve([
          { name: "Project 0", projectId: "x0" },
          { name: "Project 1", projectId: "x1" },
        ]),
      listCostLines: () => Promise.resolve([]),
    });
    warn.mockRestore();
    expect(result).toMatchObject({
      inactive: 0,
      warnings: ["project_list_shrank", "no_cost_lines"],
    });
    expect(tables.finago_projects.filter((r) => r.active)).toHaveLength(5);
  });

  it("a list of half the active projects still marks the rest inactive", async () => {
    const { db, tables } = fakeDb(seed({ finago_projects: activeRows(4) }));
    const result = await syncFinagoProjects(db, {
      ...base,
      getProjects: () =>
        Promise.resolve([
          { name: "Project 0", projectId: "x0" },
          { name: "Project 1", projectId: "x1" },
        ]),
    });
    expect(result).toMatchObject({ inactive: 2, warnings: [] });
    expect(tables.finago_projects.filter((r) => r.active)).toHaveLength(2);
  });

  it("a full run that reads no lines keeps every project's stats", async () => {
    const stats = {
      first_line_date: "2025-01-01",
      last_line_date: "2026-10-01",
      line_count: 50,
      peak_date: "2026-08-20",
    };
    const { db, tables } = fakeDb(
      seed({
        finago_projects: [
          { $id: "r1", active: true, project_id: "p1", ...stats },
        ],
      })
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await syncFinagoProjects(db, {
      ...base,
      listCostLines: () => Promise.resolve([]),
    });
    warn.mockRestore();
    expect(result).toMatchObject({
      partial: false,
      warnings: ["no_cost_lines"],
    });
    expect(tables.finago_projects[0]).toMatchObject({
      name: "Fadderullan 2026",
      ...stats,
    });
  });

  it("starts at startOffset and reports completed accounts", async () => {
    const { db } = fakeDb(
      seed({
        ledger_accounts: [6000, 6100, 6200].map((n) => ({
          $id: `a${n}`,
          account_number: n,
          active: true,
        })),
      })
    );
    const order: number[] = [];
    const result = await syncFinagoProjects(db, {
      ...base,
      listCostLines: ({ accountNumbers }) => {
        order.push(accountNumbers[0] as number);
        return Promise.resolve([]);
      },
      startOffset: 1,
    });
    expect(order).toEqual([6100, 6200, 6000]);
    expect(result).toMatchObject({ accountCount: 3, completed: 3 });
  });
});
