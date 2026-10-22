import { describe, expect, it } from "vitest";
import { type RevealDb, revealBenefitCode } from "./benefit-reveal-server";

const now = new Date("2026-10-21T12:00:00Z");

interface Created {
  data: Record<string, unknown>;
  id: string;
  permissions: string[];
  table: string;
}

function notFound(): Error & { code: number; type: string } {
  return Object.assign(new Error("missing"), {
    code: 404,
    type: "row_not_found",
  });
}

function makeDb(
  opts: {
    benefit?: Record<string, unknown> | null;
    code?: string | null;
    existingReveal?: boolean;
    failInteraction?: boolean;
    partner?: Record<string, unknown>;
  } = {}
) {
  const calls: string[] = [];
  const created: Created[] = [];
  const benefit =
    opts.benefit === undefined
      ? {
          $id: "b1",
          campus_id: "1",
          partner_id: "p1",
          redemption_type: "code",
          redemption_value: "LEGACY",
          section: "member",
          status: "published",
        }
      : opts.benefit;
  const db: RevealDb = {
    createRow(table, id, data, permissions) {
      calls.push(`create:${table}`);
      if (table === "benefit_interactions" && opts.failInteraction) {
        return Promise.reject(new Error("boom"));
      }
      created.push({ data, id, permissions, table });
      return Promise.resolve({});
    },
    getRow<T>(table: string) {
      calls.push(`get:${table}`);
      if (table === "campus_benefits") {
        return benefit
          ? Promise.resolve(benefit as T)
          : Promise.reject(notFound());
      }
      if (table === "benefit_partners") {
        return Promise.resolve((opts.partner ?? { is_active: true }) as T);
      }
      if (table === "benefit_codes") {
        return opts.code == null
          ? Promise.reject(notFound())
          : Promise.resolve({ value: opts.code } as T);
      }
      return Promise.reject(notFound());
    },
    listRows<T>(table: string) {
      calls.push(`list:${table}`);
      const rows = opts.existingReveal ? [{ $id: "r" }] : [];
      return Promise.resolve({ rows: rows as T[] });
    },
  };
  return { calls, created, db };
}

const input = {
  benefitId: "b1",
  membership: "active" as const,
  now,
  userId: "u1",
};

describe("revealBenefitCode", () => {
  it("rejects inactive members without touching the db", async () => {
    const { calls, db } = makeDb();
    expect(
      await revealBenefitCode(db, { ...input, membership: "inactive" })
    ).toEqual({ ok: false, reason: "not_member" });
    expect(calls).toEqual([]);
  });

  it("reports unavailable membership", async () => {
    const { calls, db } = makeDb();
    expect(
      await revealBenefitCode(db, { ...input, membership: "unavailable" })
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(calls).toEqual([]);
  });

  it("returns not_found for a missing benefit", async () => {
    const { db } = makeDb({ benefit: null });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("returns not_found for draft and expired benefits", async () => {
    for (const extra of [
      { status: "draft" },
      { publish_end: "2026-10-01T00:00:00Z" },
    ]) {
      const { db } = makeDb({
        benefit: {
          campus_id: "1",
          redemption_type: "code",
          section: "member",
          status: "published",
          ...extra,
        },
        code: "X",
      });
      expect(await revealBenefitCode(db, input)).toEqual({
        ok: false,
        reason: "not_found",
      });
    }
  });

  it("returns not_found for a career-section benefit", async () => {
    const { db } = makeDb({
      benefit: {
        campus_id: "1",
        redemption_type: "code",
        section: "career",
        status: "published",
      },
      code: "X",
    });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("treats a null section as member", async () => {
    const { db } = makeDb({
      benefit: {
        campus_id: "1",
        redemption_type: "code",
        section: null,
        status: "published",
      },
      code: "X",
    });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: true,
      value: "X",
    });
  });

  it("returns no_code for onsite redemption", async () => {
    const { db } = makeDb({
      benefit: {
        campus_id: "1",
        redemption_type: "onsite",
        section: "member",
        status: "published",
      },
      code: "X",
    });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: false,
      reason: "no_code",
    });
  });

  it("prefers the code row over the legacy value", async () => {
    const { db } = makeDb({ code: "SECRET" });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: true,
      value: "SECRET",
    });
  });

  it("falls back to the legacy value on 404", async () => {
    const { db } = makeDb({ code: null });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: true,
      value: "LEGACY",
    });
  });

  it("returns no_code for a blank value", async () => {
    const { db } = makeDb({ code: "   " });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: false,
      reason: "no_code",
    });
  });

  it("writes reveal and interaction rows with exact permissions", async () => {
    const { created, db } = makeDb({ code: "S" });
    await revealBenefitCode(db, input);
    const reveal = created.find((c) => c.table === "benefit_reveals");
    const interaction = created.find((c) => c.table === "benefit_interactions");
    expect(reveal?.data).toEqual({
      benefit_id: "b1",
      revealed_at: now.toISOString(),
      user_id: "u1",
    });
    expect(reveal?.permissions).toEqual([
      'read("user:u1")',
      'update("user:u1")',
    ]);
    expect(interaction?.data).toEqual({
      action: "reveal",
      benefit_id: "b1",
      campus_id: "1",
      metadata: null,
      user_id: "u1",
    });
    expect(interaction?.permissions).toEqual(['read("user:u1")']);
  });

  it("creates no second reveal row but still an interaction", async () => {
    const { created, db } = makeDb({ code: "S", existingReveal: true });
    await revealBenefitCode(db, input);
    expect(created.map((c) => c.table)).toEqual(["benefit_interactions"]);
  });

  it("still returns ok when the interaction write fails", async () => {
    const { db } = makeDb({ code: "S", failInteraction: true });
    expect(await revealBenefitCode(db, input)).toEqual({
      ok: true,
      value: "S",
    });
  });
});
