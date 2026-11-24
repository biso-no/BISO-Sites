import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { UserAuthContext } from "@/lib/authorization";
import type { ImportField } from "@/lib/big-events/import/field-aliases";
import type {
  ImportMapping,
  ImportOptions,
} from "@/lib/big-events/import/plan-import";
import { createFakeTablesDb, type FakeRow } from "@/test/fake-tables-db";

mock.module("server-only", () => ({}));

const fake = createFakeTablesDb();
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: fake.db })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  revalidateTag: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
}));

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: "a@example.com",
    managedCampuses: [],
    managedCampusIds: [],
    name: "Admin",
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: ["globaladmin"],
    userId: "admin-1",
    ...overrides,
  };
}

let currentCtx = makeCtx();
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));

// The model is never called: a spy stands in for it and records its input.
const aiMapping = await import("@/lib/big-events/import/ai-mapping.server");
const suggestColumns = spyOn(
  aiMapping,
  "suggestColumnsWithAi"
).mockImplementation(async () => ({}));
afterAll(() => suggestColumns.mockRestore());

const { applyImport, previewImport, readImportFile } = await import(
  "./big-event-import"
);

const PARTICIPANTS = "big_event_participants";
const GROUPS = "big_event_groups";
const MEMBERS = "big_event_group_members";

const bigEvent: FakeRow = {
  $id: "b1",
  campus_id: "5",
  department_id: null,
  ends_at: "2027-01-27T17:00:00.000+00:00",
  name_no: "Winter Games 2027",
  starts_at: "2027-01-24T07:00:00.000+00:00",
  status: "draft",
  travel_enabled: true,
};

function seed(tables: Record<string, FakeRow[]> = {}): void {
  fake.reset({ big_events: [bigEvent], user: [], ...tables });
}

/** The Tickster purchasers export: Ola (Bergen), Kari (Oslo), Per (Trondheim). */
function ticksterForm(): FormData {
  const buf = readFileSync(
    join(
      import.meta.dir,
      "../../../lib/big-events/import/__fixtures__/tickster-purchasers.xlsx"
    )
  );
  const form = new FormData();
  form.set("file", new File([buf], "Kjøperliste.xlsx"));
  return form;
}

function pasteForm(lines: string[][]): FormData {
  const form = new FormData();
  form.set("paste", lines.map((line) => line.join("\t")).join("\n"));
  return form;
}

const TICKSTER_MAPPING: ImportMapping = {
  columns: [
    "first_name",
    "last_name",
    "email",
    "phone",
    "ticket_ref",
    "ignore",
    "ignore",
    "ignore",
    "ignore",
    "ignore",
    "ticket_category",
    "ignore",
    "ignore",
  ],
};
const ROOM_BOOKINGS: ImportOptions = {
  defaultCampusId: null,
  groupKind: null,
  roomBookings: true,
};
const PLAIN: ImportOptions = {
  defaultCampusId: null,
  groupKind: null,
  roomBookings: false,
};

function mappingFor(...columns: ImportField[]): ImportMapping {
  return { columns };
}

function participantRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    $id: "p1",
    big_event_id: "b1",
    campus_id: "2",
    dismissed_user_id: null,
    first_name: "Kari",
    last_import_id: null,
    last_name: "Nordmann",
    link_method: null,
    linked_at: null,
    phone: "+4791234567",
    room_size: null,
    suggested_reason: null,
    suggested_user_id: null,
    ticket_category: null,
    ticket_email: "kari@example.com",
    ticket_ref: null,
    user_id: null,
    ...overrides,
  };
}

function byName(rows: FakeRow[], firstName: string): FakeRow | undefined {
  return rows.find((row) => row.first_name === firstName);
}

beforeEach(() => {
  currentCtx = makeCtx();
  logAuditEvent.mockClear();
  suggestColumns.mockClear();
  seed();
});

describe("applyImport", () => {
  test("apply recomputes the plan on the server", async () => {
    const result = await applyImport(
      "b1",
      ticksterForm(),
      TICKSTER_MAPPING,
      ROOM_BOOKINGS
    );

    const people = fake.rows(PARTICIPANTS);
    expect(people).toHaveLength(3);
    const ola = byName(people, "Ola");
    expect(ola).toMatchObject({
      big_event_id: "b1",
      campus_id: "2",
      last_name: "Nordmann",
      phone: "+4791234567",
      room_size: 4,
      ticket_category: "1 x Bergen - BISO - 4-Person",
      ticket_email: "ola@example.com",
      ticket_ref: "A100",
    });
    expect(ola?.user_id ?? null).toBeNull();
    expect(byName(people, "Kari")).toMatchObject({
      campus_id: "1",
      phone: "+4792345678",
      room_size: 2,
    });
    expect(byName(people, "Per")?.campus_id).toBe("3");
    const importIds = new Set(people.map((row) => row.last_import_id));
    expect(importIds.size).toBe(1);
    expect([...importIds][0]).toEqual(expect.any(String));

    const rooms = fake.rows(GROUPS);
    expect(rooms).toHaveLength(3);
    expect(rooms.find((room) => room.source_key === "booking:A100")).toEqual({
      $id: expect.any(String),
      big_event_id: "b1",
      booking_participant_id: ola?.$id,
      campus_id: "2",
      capacity: 4,
      kind: "room",
      name: "Ola Nordmann",
      source_key: "booking:A100",
    });
    const members = fake.rows(MEMBERS);
    expect(members).toHaveLength(3);
    expect(members.every((member) => member.leg === null)).toBe(true);
    expect(
      members.find((member) => member.participant_id === ola?.$id)?.group_id
    ).toBe(rooms.find((room) => room.source_key === "booking:A100")?.$id);

    expect(result).toMatchObject({
      created: 3,
      linked: 0,
      newGroups: 3,
      outsideYourCampus: 0,
      placed: 3,
      unchanged: 0,
      updated: 0,
    });
    const [, action, audit] = logAuditEvent.mock.calls[0] ?? [];
    expect(action).toBe("big_event.import");
    // Counts only: no names, emails or phones in the audit log.
    const payload = JSON.stringify(audit);
    for (const personal of ["Ola", "ola@example.com", "91234567", "A100"]) {
      expect(payload).not.toContain(personal);
    }

    // The same file again changes nothing but the import stamp.
    const again = await applyImport(
      "b1",
      ticksterForm(),
      TICKSTER_MAPPING,
      ROOM_BOOKINGS
    );
    expect(again).toMatchObject({
      created: 0,
      newGroups: 0,
      placed: 0,
      unchanged: 3,
      updated: 0,
    });
    expect(fake.rows(PARTICIPANTS)).toHaveLength(3);
    expect(fake.rows(GROUPS)).toHaveLength(3);
    expect(fake.rows(MEMBERS)).toHaveLength(3);
    const stamps = new Set(
      fake.rows(PARTICIPANTS).map((row) => row.last_import_id)
    );
    expect(stamps.size).toBe(1);
    expect(stamps.has([...importIds][0])).toBe(false);
  });

  test("apply links tickets bought with a BI email", async () => {
    seed({
      user: [
        { $id: "u-kari", email: "kari@bi.no", student_id: "1234567" },
        { $id: "u-ola", email: "ola@gmail.com", student_id: null },
      ],
    });
    const form = pasteForm([
      ["Navn", "Etternavn", "E-post", "Mobilnr"],
      ["Kari", "Nordmann", "Kari@BI.no", "91234567"],
      ["Ola", "Hansen", "ola@gmail.com", "92345678"],
    ]);

    const result = await applyImport(
      "b1",
      form,
      mappingFor("first_name", "last_name", "email", "phone"),
      PLAIN
    );

    expect(result.linked).toBe(1);
    const people = fake.rows(PARTICIPANTS);
    expect(byName(people, "Kari")).toMatchObject({
      link_method: "email",
      ticket_email: "kari@bi.no",
      user_id: "u-kari",
    });
    expect(byName(people, "Ola")?.user_id ?? null).toBeNull();
  });

  test("an email on several tickets links none of them", async () => {
    seed({
      user: [{ $id: "u-kari", email: "kari@bi.no", student_id: "1234567" }],
    });
    const form = pasteForm([
      ["Navn", "Etternavn", "E-post"],
      ["Kari", "Nordmann", "kari@bi.no"],
      ["Ola", "Nordmann", "kari@bi.no"],
    ]);

    const result = await applyImport(
      "b1",
      form,
      mappingFor("first_name", "last_name", "email"),
      PLAIN
    );

    expect(result.linked).toBe(0);
    expect(fake.rows(PARTICIPANTS).some((row) => row.user_id)).toBe(false);
  });

  test("campus access skips other campuses' rows", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });

    const preview = await previewImport(
      "b1",
      ticksterForm(),
      TICKSTER_MAPPING,
      ROOM_BOOKINGS
    );
    expect(preview).toMatchObject({ created: 1, outsideYourCampus: 2 });
    expect(preview.createdNames).toEqual(["Ola Nordmann"]);

    const result = await applyImport(
      "b1",
      ticksterForm(),
      TICKSTER_MAPPING,
      ROOM_BOOKINGS
    );
    expect(result).toMatchObject({ created: 1, outsideYourCampus: 2 });
    expect(fake.rows(PARTICIPANTS).map((row) => row.first_name)).toEqual([
      "Ola",
    ]);
    expect(fake.rows(GROUPS).map((group) => group.campus_id)).toEqual(["2"]);
  });

  test("a campus admin's import never matches people they can't see", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });
    seed({
      [PARTICIPANTS]: [
        participantRow({ $id: "p-oslo", campus_id: "1", first_name: "Kari" }),
      ],
    });
    const form = pasteForm([
      ["Navn", "Etternavn", "E-post", "Mobilnr", "Campus"],
      ["Kari", "Nordmann", "kari@example.com", "91234567", "Bergen"],
    ]);

    const preview = await previewImport(
      "b1",
      form,
      mappingFor("first_name", "last_name", "email", "phone", "campus"),
      PLAIN
    );

    // The Oslo row is invisible: not updated, not listed as missing.
    expect(preview).toMatchObject({ created: 1, missing: 0, updated: 0 });
  });

  test("a group column moves people out of their old room (R8)", async () => {
    seed({
      [GROUPS]: [
        {
          $id: "g-101",
          big_event_id: "b1",
          booking_participant_id: null,
          campus_id: "2",
          capacity: 4,
          kind: "room",
          name: "101",
          source_key: "col:room:101",
        },
      ],
      [MEMBERS]: [
        {
          $id: "m1",
          big_event_id: "b1",
          group_id: "g-101",
          leg: null,
          participant_id: "p1",
        },
      ],
      [PARTICIPANTS]: [participantRow()],
    });
    const form = () =>
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Rom"],
        ["Kari", "Nordmann", "91234567", "102"],
      ]);
    const mapping = mappingFor("first_name", "last_name", "phone", "group");

    const preview = await previewImport("b1", form(), mapping, PLAIN);
    expect(preview).toMatchObject({
      groupKind: "room",
      moved: 1,
      newGroups: 1,
      unchanged: 1,
    });

    await applyImport("b1", form(), mapping, PLAIN);
    const members = fake.rows(MEMBERS);
    expect(members).toHaveLength(1);
    const room = fake.rows(GROUPS).find((group) => group.name === "102");
    expect(members[0]).toMatchObject({
      group_id: room?.$id,
      leg: null,
      participant_id: "p1",
    });
  });

  test("a bus column gives a seat both ways", async () => {
    const form = pasteForm([
      ["Navn", "Etternavn", "Mobilnr", "Buss"],
      ["Kari", "Nordmann", "91234567", "Buss 1"],
    ]);
    await applyImport(
      "b1",
      form,
      mappingFor("first_name", "last_name", "phone", "group"),
      { ...PLAIN, groupKind: "bus" }
    );
    expect(fake.rows(GROUPS)).toMatchObject([{ kind: "bus", name: "Buss 1" }]);
    expect(
      fake
        .rows(MEMBERS)
        .map((member) => member.leg)
        .sort()
    ).toEqual(["home", "out"]);
  });
});

describe("previewImport", () => {
  test("counts new, updated, unchanged, missing and skipped people", async () => {
    seed({
      [PARTICIPANTS]: [
        participantRow({ $id: "p-kari" }),
        participantRow({
          $id: "p-ola",
          first_name: "Ola",
          last_name: "Hansen",
          phone: "+4792345678",
          ticket_email: "ola@example.com",
        }),
        participantRow({
          $id: "p-anne",
          first_name: "Anne",
          last_name: "Berg",
          phone: null,
          ticket_email: "anne@example.com",
        }),
      ],
    });
    const form = pasteForm([
      ["Navn", "Etternavn", "E-post", "Mobilnr"],
      ["Kari", "Nordmann", "kari@example.com", "91234567"],
      ["Ola", "Hansen", "ola@example.com", "99999999"],
      ["Per", "Dahl", "per@example.com", ""],
      ["", "Uten navn", "x@example.com", ""],
    ]);

    const preview = await previewImport(
      "b1",
      form,
      mappingFor("first_name", "last_name", "email", "phone"),
      PLAIN
    );

    expect(preview).toMatchObject({
      created: 1,
      createdNames: ["Per Dahl"],
      missing: 1,
      missingNames: ["Anne Berg"],
      skipped: 1,
      skippedRows: [{ reason: "no_name", rowNumber: 5 }],
      unchanged: 1,
      updated: 1,
    });
    // A preview writes nothing.
    expect(fake.db.createRow).not.toHaveBeenCalled();
    expect(fake.db.updateRow).not.toHaveBeenCalled();
  });
});

describe("readImportFile", () => {
  test("apply never sends personal data to the AI", async () => {
    const columns = await readImportFile("b1", ticksterForm());

    expect(columns.headerRow).toBe(2);
    expect(columns.mapping.slice(0, 5)).toEqual([
      "first_name",
      "last_name",
      "email",
      "phone",
      "ticket_ref",
    ]);
    expect(columns.detected).toEqual({
      campus: true,
      group: false,
      roomSizes: true,
    });
    expect(suggestColumns).toHaveBeenCalledTimes(1);
    const [sent] = suggestColumns.mock.calls[0] ?? [[]];
    expect(sent.length).toBeGreaterThan(0);
    for (const column of sent) {
      expect(Object.keys(column).sort()).toEqual(["header", "index", "shape"]);
    }
    const text = JSON.stringify(sent);
    for (const personal of [
      "Ola",
      "Kari",
      "Nordmann",
      "@example.com",
      "91234567",
      "A100",
    ]) {
      expect(text).not.toContain(personal);
    }
  });

  test("a sheet without known column names never reaches the AI", async () => {
    const columns = await readImportFile(
      "b1",
      pasteForm([
        ["Kari Nordmann", "kari@example.com", "91234567"],
        ["Ola Hansen", "ola@example.com", "92345678"],
      ])
    );
    expect(columns.headerRow).toBe(0);
    expect(suggestColumns).not.toHaveBeenCalled();
  });

  test("uses the AI's guess for a column the known names miss", async () => {
    suggestColumns.mockImplementationOnce(async () => ({ 2: "group" }));
    const columns = await readImportFile(
      "b1",
      pasteForm([
        ["Navn", "Etternavn", "Hytte"],
        ["Kari", "Nordmann", "Fjellbu"],
      ])
    );
    expect(columns.mapping).toEqual(["first_name", "last_name", "group"]);
    expect(columns.detected.group).toBe(true);
  });

  test("refuses a big event the caller can't see", async () => {
    currentCtx = makeCtx({ roles: [] });
    await expect(readImportFile("b1", ticksterForm())).rejects.toThrow();
  });
});
