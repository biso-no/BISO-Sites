import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

type Row = Record<string, unknown>;

const db = {
  deleteRow: mock(),
  listRows: mock(),
  upsertRow: mock(),
};

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

let currentCtx: UserAuthContext = makeCtx({
  managedCampusIds: ["2"],
  roles: ["campusadmin"],
});
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);
const notifyWebsite = mock(async (_tags: string[]) => undefined);
const revalidatePath = mock((_path: string) => undefined);
const translateContentFields = mock(
  async (_input: {
    fields: { key: string; value: string }[];
  }): Promise<Record<string, string>> => ({})
);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({ revalidatePath }));
mock.module("./audit-log", () => ({ logAuditEvent }));
mock.module("@/lib/web-revalidate", () => ({ notifyWebsite }));
mock.module("@/lib/content-translation.server", () => ({
  translateContentFields,
}));

const { loadMembershipTexts, resetMembershipSpot, saveMembershipSpot } =
  await import("./membership-texts");

const editor = () => makeCtx({ roles: ["benefitseditor"] });
const idsOf = (fn: { mock: { calls: unknown[][] } }, index: number) =>
  fn.mock.calls.map((call) => call[index]);

beforeEach(() => {
  currentCtx = editor();
  for (const fn of [
    db.deleteRow,
    db.listRows,
    db.upsertRow,
    logAuditEvent,
    notifyWebsite,
    revalidatePath,
    translateContentFields,
  ]) {
    fn.mockReset();
  }
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
  db.upsertRow.mockResolvedValue({});
  db.deleteRow.mockResolvedValue({});
  translateContentFields.mockImplementation(async ({ fields }) =>
    Object.fromEntries(fields.map((f) => [f.key, `EN ${f.value}`]))
  );
});

const stored = (spot: string, count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    $id: `${spot}-${i}`,
    body_en: null,
    body_nb: null,
    sort_order: i,
    spot: spot.replaceAll("-", "_"),
    title_en: `en ${i}`,
    title_nb: `nb ${i}`,
  }));

describe("access", () => {
  test("a campus admin is refused by every action", async () => {
    currentCtx = makeCtx({ managedCampusIds: ["2"], roles: ["campusadmin"] });
    expect(await saveMembershipSpot("home_join", [{ title_nb: "a" }])).toEqual({
      error: "Unauthorized",
    });
    expect(await resetMembershipSpot("home_join")).toEqual({
      error: "Unauthorized",
    });
    await expect(loadMembershipTexts()).rejects.toThrow("Unauthorized");
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
    expect(translateContentFields).not.toHaveBeenCalled();
  });
});

describe("loadMembershipTexts", () => {
  test("pre-fills an empty spot with the real Norwegian and English defaults", async () => {
    const spots = await loadMembershipTexts();
    expect(spots).toHaveLength(7);
    const join = spots.find((s) => s.spot === "home_join");
    expect(join?.hasRows).toBe(false);
    expect(join?.items).toHaveLength(5);
    expect(join?.items[0]?.title_nb.length).toBeGreaterThan(0);
    expect(join?.items[0]?.title_en.length).toBeGreaterThan(0);
    expect(join?.items[0]?.title_nb).not.toBe(join?.items[0]?.title_en);
    const business = spots.find((s) => s.spot === "business");
    expect(business?.items[0]?.body_nb.length).toBeGreaterThan(0);
    expect(business?.items[0]?.body_en.length).toBeGreaterThan(0);
  });

  test("returns stored rows in order for a spot that has them", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        { ...stored("onboarding", 2)[1], spot: "onboarding" },
        { ...stored("onboarding", 2)[0], spot: "onboarding" },
      ],
      total: 2,
    });
    const spots = await loadMembershipTexts();
    const onboarding = spots.find((s) => s.spot === "onboarding");
    expect(onboarding?.hasRows).toBe(true);
    expect(onboarding?.items).toEqual([
      { body_en: "", body_nb: "", title_en: "en 0", title_nb: "nb 0" },
      { body_en: "", body_nb: "", title_en: "en 1", title_nb: "nb 1" },
    ]);
    expect(spots.find((s) => s.spot === "home_join")?.hasRows).toBe(false);
  });
});

describe("saveMembershipSpot", () => {
  test("upserts 0..n-1 and deletes the leftover rows", async () => {
    db.listRows.mockResolvedValue({
      rows: stored("home-join", 5).map((row) => ({
        ...row,
        spot: "home_join",
      })),
      total: 5,
    });
    const result = await saveMembershipSpot("home_join", [
      { title_en: "One", title_nb: "En" },
      { title_en: "Two", title_nb: "To" },
      { title_en: "Three", title_nb: "Tre" },
    ]);
    expect(result).toEqual({ data: true });
    expect(idsOf(db.upsertRow, 2)).toEqual([
      "home-join-0",
      "home-join-1",
      "home-join-2",
    ]);
    expect(db.upsertRow.mock.calls[1]?.[3]).toMatchObject({
      sort_order: 1,
      spot: "home_join",
      title_en: "Two",
      title_nb: "To",
    });
    expect(idsOf(db.deleteRow, 2).sort()).toEqual([
      "home-join-3",
      "home-join-4",
    ]);
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("membership_texts_saved");
    expect(notifyWebsite).toHaveBeenCalledTimes(1);
    expect(notifyWebsite).toHaveBeenCalledWith(["membership-texts"]);
    expect(revalidatePath).toHaveBeenCalledWith("/benefits/texts");
  });

  test("deletes stray rows outside the new id set", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ $id: "legacy-row", spot: "home_join", title_nb: "x" }],
      total: 1,
    });
    await saveMembershipSpot("home_join", [{ title_en: "a", title_nb: "a" }]);
    expect(idsOf(db.deleteRow, 2)).toEqual(["legacy-row"]);
  });

  test("auto-translates blank English in one call and keeps typed English", async () => {
    const result = await saveMembershipSpot("business", [
      { body_nb: "Tekst", title_en: "", title_nb: "Tittel" },
      { body_en: "", body_nb: "Mer", title_en: "Typed", title_nb: "To" },
    ]);
    expect(result).toEqual({ data: true });
    expect(translateContentFields).toHaveBeenCalledTimes(1);
    const input = translateContentFields.mock.calls[0]?.[0] as unknown as {
      sourceLocale: string;
      targetLocale: string;
      fields: { key: string; value: string }[];
    };
    expect(input.sourceLocale).toBe("no");
    expect(input.targetLocale).toBe("en");
    expect(input.fields.map((f) => f.value).sort()).toEqual([
      "Mer",
      "Tekst",
      "Tittel",
    ]);
    expect(new Set(input.fields.map((f) => f.key)).size).toBe(3);
    expect(db.upsertRow.mock.calls[0]?.[3]).toMatchObject({
      body_en: "EN Tekst",
      title_en: "EN Tittel",
    });
    expect(db.upsertRow.mock.calls[1]?.[3]).toMatchObject({
      body_en: "EN Mer",
      title_en: "Typed",
    });
  });

  test("does not call the translator when English is complete", async () => {
    await saveMembershipSpot("home_join", [{ title_en: "x", title_nb: "x" }]);
    expect(translateContentFields).not.toHaveBeenCalled();
  });

  test("copies the Norwegian when translation fails and still saves", async () => {
    translateContentFields.mockRejectedValue(new Error("down"));
    const result = await saveMembershipSpot("business", [
      { body_nb: "Tekst", title_nb: "Tittel" },
    ]);
    expect(result).toEqual({ data: true });
    expect(db.upsertRow.mock.calls[0]?.[3]).toMatchObject({
      body_en: "Tekst",
      title_en: "Tittel",
    });
  });

  test("ignores a body on a line spot", async () => {
    const result = await saveMembershipSpot("home_join", [
      { body_en: "x", body_nb: "ignored", title_en: "a", title_nb: "a" },
    ]);
    expect(result).toEqual({ data: true });
    const data = db.upsertRow.mock.calls[0]?.[3] as Row;
    expect(data.body_nb ?? null).toBeNull();
    expect(data.body_en ?? null).toBeNull();
  });

  test("validates the limits with plain Norwegian messages", async () => {
    const tooMany = Array.from({ length: 13 }, () => ({ title_nb: "a" }));
    expect(await saveMembershipSpot("home_join", tooMany)).toEqual({
      error: "Maks 12 punkter.",
    });
    expect(await saveMembershipSpot("home_join", [])).toMatchObject({
      error: expect.any(String),
    });
    expect(
      await saveMembershipSpot("home_join", [{ title_nb: "   " }])
    ).toMatchObject({ error: expect.stringContaining("tittel") });
    expect(
      await saveMembershipSpot("home_join", [{ title_nb: "a".repeat(201) }])
    ).toMatchObject({ error: expect.stringContaining("200") });
    expect(
      await saveMembershipSpot("business", [
        { body_nb: "b".repeat(501), title_nb: "a" },
      ])
    ).toMatchObject({ error: expect.stringContaining("500") });
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
    expect(notifyWebsite).not.toHaveBeenCalled();
  });
});

describe("sturdier saves", () => {
  test("notifies the website when a delete fails after an upsert", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ $id: "home-join-3", spot: "home_join", title_nb: "x" }],
      total: 1,
    });
    db.deleteRow.mockRejectedValue(new Error("boom"));
    const result = await saveMembershipSpot("home_join", [
      { title_en: "a", title_nb: "a" },
    ]);
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(notifyWebsite).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  test("notifies when a reset fails midway", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        { $id: "onboarding-0", spot: "onboarding" },
        { $id: "onboarding-1", spot: "onboarding" },
      ],
      total: 2,
    });
    db.deleteRow
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("x"));
    expect(await resetMembershipSpot("onboarding")).toMatchObject({
      error: expect.any(String),
    });
    expect(notifyWebsite).toHaveBeenCalledTimes(1);
  });

  test("uses the Norwegian when a translation is over the limit", async () => {
    translateContentFields.mockImplementation(async ({ fields }) =>
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          f.key.startsWith("title") ? "t".repeat(201) : "b".repeat(501),
        ])
      )
    );
    await saveMembershipSpot("business", [
      { body_nb: "Tekst", title_nb: "Tittel" },
    ]);
    expect(db.upsertRow.mock.calls[0]?.[3]).toMatchObject({
      body_en: "Tekst",
      title_en: "Tittel",
    });
  });

  test("returns a plain error for malformed input instead of throwing", async () => {
    const bad = [
      null,
      "x",
      [null],
      [{ title_nb: 5 }],
      [{ title_nb: "a", body_nb: 3 }],
    ];
    for (const items of bad) {
      expect(
        await saveMembershipSpot("home_join", items as never)
      ).toMatchObject({ error: expect.any(String) });
    }
    expect(
      await saveMembershipSpot("nope" as never, [{ title_nb: "a" }])
    ).toMatchObject({ error: expect.any(String) });
    expect(await resetMembershipSpot("nope" as never)).toMatchObject({
      error: expect.any(String),
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });
});

describe("resetMembershipSpot", () => {
  test("deletes every row of the spot and notifies once", async () => {
    db.listRows.mockResolvedValue({
      rows: stored("onboarding", 3).map((row) => ({
        ...row,
        spot: "onboarding",
      })),
      total: 3,
    });
    expect(await resetMembershipSpot("onboarding")).toEqual({ data: true });
    expect(idsOf(db.deleteRow, 2).sort()).toEqual([
      "onboarding-0",
      "onboarding-1",
      "onboarding-2",
    ]);
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("membership_texts_reset");
    expect(notifyWebsite).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/benefits/texts");
  });
});
