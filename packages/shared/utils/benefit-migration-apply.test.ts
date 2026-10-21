import { describe, expect, it } from "vitest";
import type {
  MigrationPlan,
  PlannedDeletion,
  PlannedLine,
} from "./benefit-migration";
import {
  applyBenefitMigration,
  InvalidMigrationPlanError,
  type MigrationWriter,
} from "./benefit-migration-apply";

interface Call {
  args: unknown[];
  method: string;
}

function recordingWriter(): { calls: Call[]; writer: MigrationWriter } {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return Promise.resolve();
    };
  return {
    calls,
    writer: {
      deleteRow: async (...args: unknown[]) => {
        await record("deleteRow")(...args);
        return "deleted" as const;
      },
      updateRow: record("updateRow"),
      upsertRow: record("upsertRow"),
    } as MigrationWriter,
  };
}

function line(overrides: Partial<PlannedLine>): PlannedLine {
  return {
    action: "create",
    campusId: "1",
    id: "line-1",
    mergeInto: [],
    note: null,
    partnerKey: null,
    score: null,
    section: "career",
    sortOrder: 10,
    sourceCampusIds: ["1"],
    titleEn: "Career talk",
    titleNb: "Karrieredag",
    ...overrides,
  };
}

function basePlan(deletion?: Partial<PlannedDeletion>): MigrationPlan {
  return {
    version: 1,
    generatedAt: "2026-10-21T00:00:00.000Z",
    partners: [
      {
        campusId: "5",
        id: "partner-1",
        key: "acme",
        logoUrl: "https://example.com/logo.png",
        name: "Acme",
        suggested: false,
      },
    ],
    lines: [
      line({ id: "line-member", section: "member", partnerKey: "acme" }),
      line({ id: "line-career", section: "career" }),
    ],
    rowUpdates: [
      {
        campusId: "1",
        category: "other",
        makePublic: true,
        partnerKey: "acme",
        rowId: "row-public",
        section: "member",
        sortOrder: 3,
        title: "Public row",
      },
      {
        campusId: "1",
        category: null,
        makePublic: false,
        partnerKey: null,
        rowId: "row-private",
        section: "career",
        sortOrder: null,
        title: "Private row",
      },
      {
        campusId: "1",
        category: null,
        makePublic: false,
        partnerKey: null,
        rowId: "row-old",
        section: "career",
        sortOrder: null,
        title: "Old",
      },
    ],
    codes: [{ rowId: "row-public", value: "SECRET" }],
    deletions: [
      { approved: false, rowId: "row-old", title: "Old", ...deletion },
    ],
  };
}

describe("applyBenefitMigration", () => {
  it("writes partners, creates, updates, codes, deletions in order", async () => {
    const { calls, writer } = recordingWriter();
    const result = await applyBenefitMigration(
      basePlan({ approved: true }),
      writer
    );
    expect(calls.map((c) => [c.method, c.args[0], c.args[1]])).toEqual([
      ["upsertRow", "benefit_partners", "partner-1"],
      ["upsertRow", "campus_benefits", "line-member"],
      ["upsertRow", "campus_benefits", "line-career"],
      ["updateRow", "campus_benefits", "row-public"],
      ["updateRow", "campus_benefits", "row-private"],
      ["upsertRow", "benefit_codes", "row-public"],
      ["deleteRow", "campus_benefits", "row-old"],
    ]);
    expect(result).toEqual({
      codes: 1,
      created: 2,
      deleted: 1,
      partners: 1,
      updated: 2,
    });
  });

  it("resolves partner ids and member/career categories on created lines", async () => {
    const { calls, writer } = recordingWriter();
    await applyBenefitMigration(basePlan(), writer);
    expect(calls[0].args).toEqual([
      "benefit_partners",
      "partner-1",
      {
        name: "Acme",
        campus_id: "5",
        logo_url: "https://example.com/logo.png",
        is_active: true,
      },
      ['read("any")'],
    ]);
    expect(calls[1].args[2]).toEqual({
      campus: "1",
      campus_id: "1",
      section: "member",
      status: "published",
      title_nb: "Karrieredag",
      title_en: "Career talk",
      sort_order: 10,
      redemption_type: "none",
      is_featured: false,
      category: "other",
      partner_id: "partner-1",
    });
    expect(calls[2].args[2]).toMatchObject({
      category: null,
      partner_id: null,
    });
    expect(calls[1].args[3]).toEqual(['read("any")']);
  });

  it("builds update data and permissions from the row update", async () => {
    const { calls, writer } = recordingWriter();
    await applyBenefitMigration(basePlan(), writer);
    expect(calls[3].args).toEqual([
      "campus_benefits",
      "row-public",
      {
        section: "member",
        category: "other",
        partner_id: "partner-1",
        sort_order: 3,
      },
      ['read("any")'],
    ]);
    expect(calls[4].args).toEqual([
      "campus_benefits",
      "row-private",
      { section: "career", category: null },
      undefined,
    ]);
    expect(calls[6].args).toEqual([
      "benefit_codes",
      "row-public",
      { benefit_id: "row-public", value: "SECRET" },
      [],
    ]);
  });

  it("deletes only approved deletions", async () => {
    const unapproved = recordingWriter();
    await applyBenefitMigration(basePlan(), unapproved.writer);
    expect(unapproved.calls.some((c) => c.method === "deleteRow")).toBe(false);

    const approved = recordingWriter();
    await applyBenefitMigration(basePlan({ approved: true }), approved.writer);
    expect(approved.calls.filter((c) => c.method === "deleteRow")).toHaveLength(
      1
    );
  });

  it("skips updates and codes for rows with an approved deletion", async () => {
    const { calls, writer } = recordingWriter();
    const plan = basePlan({ approved: true });
    plan.codes.push({ rowId: "row-old", value: "GONE" });
    const result = await applyBenefitMigration(plan, writer);
    expect(
      calls.some((c) => c.method === "updateRow" && c.args[1] === "row-old")
    ).toBe(false);
    expect(
      calls.some((c) => c.method === "upsertRow" && c.args[1] === "row-old")
    ).toBe(false);
    expect(result).toMatchObject({ codes: 1, updated: 2, deleted: 1 });
  });

  it("still updates rows whose deletion is not approved", async () => {
    const { calls, writer } = recordingWriter();
    const result = await applyBenefitMigration(basePlan(), writer);
    expect(
      calls.some((c) => c.method === "updateRow" && c.args[1] === "row-old")
    ).toBe(true);
    expect(result.updated).toBe(3);
  });

  it("counts a missing row as already deleted", async () => {
    const { writer } = recordingWriter();
    writer.deleteRow = () => Promise.resolve("missing");
    const result = await applyBenefitMigration(
      basePlan({ approved: true }),
      writer
    );
    expect(result.deleted).toBe(0);
  });

  it("names the table and row id when a write fails, without data values", async () => {
    const { writer } = recordingWriter();
    const cause = new Error("boom");
    writer.upsertRow = (table) =>
      table === "benefit_codes" ? Promise.reject(cause) : Promise.resolve();
    const error = await applyBenefitMigration(basePlan(), writer).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("benefit_codes/row-public: boom");
    expect(error.message).not.toContain("SECRET");
    expect(error.cause).toBe(cause);
  });

  it("converges when applied twice against a stateful store", async () => {
    const store = new Map<string, Record<string, unknown>>();
    store.set("campus_benefits/row-public", { title: "x" });
    store.set("campus_benefits/row-private", { title: "y" });
    store.set("campus_benefits/row-old", { title: "z" });
    const writer: MigrationWriter = {
      deleteRow: (table, id) => {
        const key = `${table}/${id}`;
        const existed = store.delete(key);
        return Promise.resolve(existed ? "deleted" : "missing");
      },
      updateRow: (table, id, data) => {
        const key = `${table}/${id}`;
        const row = store.get(key);
        if (!row) {
          return Promise.reject(new Error("404"));
        }
        store.set(key, { ...row, ...data });
        return Promise.resolve();
      },
      upsertRow: (table, id, data) => {
        const key = `${table}/${id}`;
        store.set(key, { ...store.get(key), ...data });
        return Promise.resolve();
      },
    };
    const plan = basePlan({ approved: true });
    await applyBenefitMigration(plan, writer);
    const afterFirst = structuredClone([...store]);
    await expect(applyBenefitMigration(plan, writer)).resolves.toBeDefined();
    expect([...store]).toEqual(afterFirst);
    expect(store.has("campus_benefits/row-old")).toBe(false);
  });

  it("rejects an invalid plan before any write", async () => {
    const { calls, writer } = recordingWriter();
    const plan = basePlan();
    plan.lines.push(line({ id: "line-bad", action: "merge", mergeInto: [] }));
    const error = await applyBenefitMigration(plan, writer).catch((e) => e);
    expect(error).toBeInstanceOf(InvalidMigrationPlanError);
    expect(error.problems).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });
});
