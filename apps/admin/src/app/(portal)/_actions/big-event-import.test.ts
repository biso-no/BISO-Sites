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

  test("a new ticket email from the file kills the old connect link (R36)", async () => {
    seed({
      [PARTICIPANTS]: [
        participantRow({
          connect_nonce: "n-kari",
          connect_token_hash: "h-kari",
        }),
        participantRow({
          $id: "p2",
          connect_nonce: "n-ola",
          connect_token_hash: "h-ola",
          first_name: "Ola",
          last_name: "Hansen",
          phone: "+4792345678",
          ticket_email: "ola@example.com",
        }),
      ],
    });
    const form = pasteForm([
      ["Navn", "Etternavn", "E-post", "Mobilnr"],
      ["Kari", "Nordmann", "kari.new@example.com", "91234567"],
      ["Ola", "Hansen", "ola@example.com", "92345678"],
    ]);

    await applyImport(
      "b1",
      form,
      mappingFor("first_name", "last_name", "email", "phone"),
      PLAIN
    );

    const people = fake.rows(PARTICIPANTS);
    expect(byName(people, "Kari")).toMatchObject({
      connect_nonce: null,
      connect_token_hash: null,
      ticket_email: "kari.new@example.com",
    });
    expect(byName(people, "Ola")).toMatchObject({
      connect_nonce: "n-ola",
      connect_token_hash: "h-ola",
    });
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

  test("an email on another campus's ticket links neither (R29)", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });
    seed({
      [PARTICIPANTS]: [
        participantRow({
          $id: "p-oslo",
          campus_id: "1",
          first_name: "Ola",
          last_name: "Hansen",
          ticket_email: "kari@bi.no",
        }),
      ],
      user: [{ $id: "u-kari", email: "kari@bi.no", student_id: "1234567" }],
    });

    const result = await applyImport(
      "b1",
      pasteForm([
        ["Navn", "Etternavn", "E-post", "Campus"],
        ["Kari", "Nordmann", "kari@bi.no", "Bergen"],
      ]),
      mappingFor("first_name", "last_name", "email", "campus"),
      PLAIN
    );

    expect(result).toMatchObject({ created: 1, linked: 0 });
    expect(fake.rows(PARTICIPANTS).some((row) => row.user_id)).toBe(false);
  });

  test("buses need Travel (R30)", async () => {
    seed({ big_events: [{ ...bigEvent, travel_enabled: false }] });
    const form = () =>
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Buss"],
        ["Kari", "Nordmann", "91234567", "Buss 1"],
      ]);
    const mapping = mappingFor("first_name", "last_name", "phone", "group");
    const bus = { ...PLAIN, groupKind: "bus" as const };

    await expect(previewImport("b1", form(), mapping, bus)).rejects.toThrow(
      "Travel"
    );
    // Refused before any write: nothing changed, and the result says so.
    expect(await applyImport("b1", form(), mapping, bus)).toMatchObject({
      complete: false,
      written: 0,
    });
    expect(fake.db.createRow).not.toHaveBeenCalled();

    // Rooms are fine without Travel.
    await applyImport("b1", form(), mapping, { ...PLAIN, groupKind: "room" });
    expect(fake.rows(GROUPS)).toMatchObject([{ kind: "room" }]);
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
          source_key: "col:room:2:101",
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

  test("full-access import keeps two campuses' Buss 1 apart", async () => {
    const form = () =>
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Campus", "Buss"],
        ["Kari", "Nordmann", "91234567", "Bergen", "Buss 1"],
        ["Ola", "Hansen", "92345678", "Oslo", "Buss 1"],
        ["Per", "Dahl", "93456789", "Bergen", "Buss 1"],
      ]);
    const mapping = mappingFor(
      "first_name",
      "last_name",
      "phone",
      "campus",
      "group"
    );
    const options = { ...PLAIN, groupKind: "bus" as const };

    await applyImport("b1", form(), mapping, options);

    const buses = fake.rows(GROUPS);
    expect(
      buses.map((bus) => [bus.name, bus.campus_id, bus.source_key]).sort()
    ).toEqual([
      ["Buss 1", "1", "col:bus:1:buss 1"],
      ["Buss 1", "2", "col:bus:2:buss 1"],
    ]);
    const busOf = (firstName: string) => {
      const person = byName(fake.rows(PARTICIPANTS), firstName);
      const seat = fake
        .rows(MEMBERS)
        .find((member) => member.participant_id === person?.$id);
      return buses.find((bus) => bus.$id === seat?.group_id)?.campus_id;
    };
    expect([busOf("Kari"), busOf("Ola"), busOf("Per")]).toEqual([
      "2",
      "1",
      "2",
    ]);

    // The same file again finds both buses and moves no one.
    const again = await previewImport("b1", form(), mapping, options);
    expect(again).toMatchObject({ moved: 0, newGroups: 0, placed: 0 });
  });

  test("a campus admin's Buss 1 isn't reused for another campus's rows", async () => {
    const mapping = mappingFor(
      "first_name",
      "last_name",
      "phone",
      "campus",
      "group"
    );
    const options = { ...PLAIN, groupKind: "bus" as const };
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });
    await applyImport(
      "b1",
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Campus", "Buss"],
        ["Kari", "Nordmann", "91234567", "Bergen", "Buss 1"],
      ]),
      mapping,
      options
    );

    currentCtx = makeCtx();
    const preview = await previewImport(
      "b1",
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Campus", "Buss"],
        ["Ola", "Hansen", "92345678", "Oslo", "Buss 1"],
      ]),
      mapping,
      options
    );
    expect(preview).toMatchObject({ created: 1, newGroups: 1 });

    await applyImport(
      "b1",
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Campus", "Buss"],
        ["Ola", "Hansen", "92345678", "Oslo", "Buss 1"],
      ]),
      mapping,
      options
    );
    const bergenBus = fake.rows(GROUPS).find((bus) => bus.campus_id === "2");
    const bergenSeats = fake
      .rows(MEMBERS)
      .filter((member) => member.group_id === bergenBus?.$id);
    const kari = byName(fake.rows(PARTICIPANTS), "Kari");
    expect(new Set(bergenSeats.map((seat) => seat.participant_id))).toEqual(
      new Set([kari?.$id])
    );
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

describe("applyImport: when a write fails", () => {
  test("a failed write stops later phases and is audited", async () => {
    seed({
      user: [{ $id: "u-ola", email: "ola@example.com", student_id: "1234567" }],
    });
    fake.setBeforeWrite(({ data, tableId }) => {
      if (tableId === PARTICIPANTS && data?.first_name === "Per") {
        throw new Error("Appwrite is down");
      }
    });

    const result = await applyImport(
      "b1",
      ticksterForm(),
      TICKSTER_MAPPING,
      ROOM_BOOKINGS
    );

    expect(result).toMatchObject({
      complete: false,
      created: 2,
      failed: 1,
      linked: 0,
      newGroups: 0,
      placed: 0,
    });
    expect(fake.rows(PARTICIPANTS)).toHaveLength(2);
    // Later phases never ran: no rooms, no places, no email link.
    expect(fake.rows(GROUPS)).toEqual([]);
    expect(fake.rows(MEMBERS)).toEqual([]);
    expect(fake.rows(PARTICIPANTS).some((row) => row.user_id)).toBe(false);

    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    const [, action, audit] = logAuditEvent.mock.calls[0] ?? [];
    expect(action).toBe("big_event.import");
    expect(audit).toMatchObject({
      payload: {
        complete: false,
        phases: { created: { failed: 1, written: 2 } },
      },
    });
    const payload = JSON.stringify(audit);
    for (const personal of ["Per", "per@example.com", "93456789", "A102"]) {
      expect(payload).not.toContain(personal);
    }
  });

  test("no write is still running when apply returns", async () => {
    let inFlight = 0;
    fake.setBeforeWrite(async ({ data, tableId }) => {
      if (tableId !== PARTICIPANTS) {
        return;
      }
      inFlight += 1;
      try {
        if (data?.first_name === "Ola") {
          throw new Error("Appwrite is down");
        }
        if (data?.first_name === "Kari") {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      } finally {
        inFlight -= 1;
      }
    });

    const result = await applyImport(
      "b1",
      ticksterForm(),
      TICKSTER_MAPPING,
      ROOM_BOOKINGS
    );

    expect(inFlight).toBe(0);
    expect(result).toMatchObject({ complete: false, created: 2, failed: 1 });
    // The slow write finished before apply returned.
    expect(byName(fake.rows(PARTICIPANTS), "Kari")).toBeDefined();
  });

  test("a failed new place keeps the old one (R8)", async () => {
    seed({
      [GROUPS]: [
        {
          $id: "g-101",
          big_event_id: "b1",
          booking_participant_id: null,
          campus_id: null,
          capacity: 4,
          kind: "room",
          name: "101",
          source_key: "col:room:-:101",
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
      [PARTICIPANTS]: [participantRow({ campus_id: null })],
    });
    fake.setBeforeWrite(({ kind, tableId }) => {
      if (tableId === MEMBERS && kind === "create") {
        throw new Error("Appwrite is down");
      }
    });

    const result = await applyImport(
      "b1",
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Rom"],
        ["Kari", "Nordmann", "91234567", "102"],
      ]),
      mappingFor("first_name", "last_name", "phone", "group"),
      PLAIN
    );

    expect(result).toMatchObject({ complete: false, moved: 0 });
    expect(fake.rows(MEMBERS).map((member) => member.$id)).toEqual(["m1"]);
  });
});

describe("applyImport: repairing places (R34)", () => {
  /** Kari (p1) and Ola (p2) in room 101, campus-less like the file. */
  function seedRoom101(...participantIds: string[]): void {
    seed({
      [GROUPS]: [
        {
          $id: "g-101",
          big_event_id: "b1",
          booking_participant_id: null,
          campus_id: null,
          capacity: 4,
          kind: "room",
          name: "101",
          source_key: "col:room:-:101",
        },
      ],
      [MEMBERS]: participantIds.map((participantId) => ({
        $id: `m-${participantId}`,
        big_event_id: "b1",
        group_id: "g-101",
        leg: null,
        participant_id: participantId,
      })),
      [PARTICIPANTS]: [
        participantRow({ $id: "p1", campus_id: null }),
        participantRow({
          $id: "p2",
          campus_id: null,
          first_name: "Ola",
          last_name: "Hansen",
          phone: "+4792345678",
          ticket_email: "ola@example.com",
        }),
      ],
    });
  }
  const roomFile = () =>
    pasteForm([
      ["Navn", "Etternavn", "Mobilnr", "Rom"],
      ["Kari", "Nordmann", "91234567", "102"],
      ["Ola", "Hansen", "92345678", "102"],
    ]);
  const roomMapping = mappingFor("first_name", "last_name", "phone", "group");

  function roomsOf(participantId: string): string[] {
    const names = new Map(
      fake.rows(GROUPS).map((group) => [group.$id, String(group.name)])
    );
    return fake
      .rows(MEMBERS)
      .filter((member) => member.participant_id === participantId)
      .map((member) => names.get(String(member.group_id)) ?? "?")
      .sort();
  }

  test("a re-import removes a stale old place left by a failed save", async () => {
    seedRoom101("p1", "p2");
    fake.setBeforeWrite(({ kind }) => {
      if (kind === "delete") {
        throw new Error("Appwrite is down");
      }
    });
    const failed = await applyImport("b1", roomFile(), roomMapping, PLAIN);
    expect(failed).toMatchObject({ complete: false });
    expect(roomsOf("p1")).toEqual(["101", "102"]);

    fake.setBeforeWrite(null);
    const preview = await previewImport("b1", roomFile(), roomMapping, PLAIN);
    expect(preview).toMatchObject({ moved: 2, newGroups: 0, placed: 0 });

    const repaired = await applyImport("b1", roomFile(), roomMapping, PLAIN);
    expect(repaired).toMatchObject({ complete: true, moved: 2 });
    expect(roomsOf("p1")).toEqual(["102"]);
    expect(roomsOf("p2")).toEqual(["102"]);
  });

  test("some new places written then one fails → the next import repairs both", async () => {
    seedRoom101("p1", "p2");
    fake.setBeforeWrite(({ data, kind, tableId }) => {
      if (
        kind === "create" &&
        tableId === MEMBERS &&
        data?.participant_id === "p2"
      ) {
        throw new Error("Appwrite is down");
      }
    });
    await applyImport("b1", roomFile(), roomMapping, PLAIN);
    // Kari got her new room, Ola didn't; nobody left room 101.
    expect(roomsOf("p1")).toEqual(["101", "102"]);
    expect(roomsOf("p2")).toEqual(["101"]);

    fake.setBeforeWrite(null);
    const repaired = await applyImport("b1", roomFile(), roomMapping, PLAIN);
    expect(repaired).toMatchObject({ complete: true, moved: 2, placed: 1 });
    expect(roomsOf("p1")).toEqual(["102"]);
    expect(roomsOf("p2")).toEqual(["102"]);
  });

  test("a re-import completes a missing bus leg", async () => {
    const bus = (id: string, name: string) => ({
      $id: id,
      big_event_id: "b1",
      booking_participant_id: null,
      campus_id: null,
      capacity: 50,
      kind: "bus",
      name,
      source_key: `col:bus:-:${name.toLowerCase()}`,
    });
    const seat = (
      id: string,
      groupId: string,
      participantId: string,
      leg: string
    ) => ({
      $id: id,
      big_event_id: "b1",
      group_id: groupId,
      leg,
      participant_id: participantId,
    });
    seed({
      [GROUPS]: [bus("g-b1", "Buss 1"), bus("g-b2", "Buss 2")],
      [MEMBERS]: [
        // Kari: only the way out was written.
        seat("s1", "g-b1", "p1", "out"),
        // Ola: out on bus 1, home on bus 2; the file says bus 1.
        seat("s2", "g-b1", "p2", "out"),
        seat("s3", "g-b2", "p2", "home"),
      ],
      [PARTICIPANTS]: [
        participantRow({ $id: "p1", campus_id: null }),
        participantRow({
          $id: "p2",
          campus_id: null,
          first_name: "Ola",
          last_name: "Hansen",
          phone: "+4792345678",
          ticket_email: "ola@example.com",
        }),
      ],
    });
    const busFile = pasteForm([
      ["Navn", "Etternavn", "Mobilnr", "Buss"],
      ["Kari", "Nordmann", "91234567", "Buss 1"],
      ["Ola", "Hansen", "92345678", "Buss 1"],
    ]);

    const result = await applyImport("b1", busFile, roomMapping, {
      ...PLAIN,
      groupKind: "bus",
    });

    expect(result).toMatchObject({ complete: true, moved: 1 });
    const seats = (participantId: string) =>
      fake
        .rows(MEMBERS)
        .filter((member) => member.participant_id === participantId)
        .map((member) => `${member.group_id}:${member.leg}`)
        .sort();
    expect(seats("p1")).toEqual(["g-b1:home", "g-b1:out"]);
    expect(seats("p2")).toEqual(["g-b1:home", "g-b1:out"]);
  });
});

describe("applyImport: pins, room buses and notices (N7)", () => {
  function busRow(id: string, name: string): FakeRow {
    return {
      $id: id,
      big_event_id: "b1",
      booking_participant_id: null,
      campus_id: null,
      capacity: 50,
      home_bus_id: null,
      kind: "bus",
      name,
      out_bus_id: null,
      source_key: `col:bus:-:${name.toLowerCase()}`,
    };
  }
  function seatRow(
    groupId: string,
    participantId: string,
    leg: "out" | "home" | null,
    pinned = false
  ): FakeRow {
    return {
      $id: `m-${groupId}-${participantId}-${leg}`,
      big_event_id: "b1",
      group_id: groupId,
      leg,
      participant_id: participantId,
      pinned,
    };
  }
  const ola = () =>
    participantRow({
      $id: "p2",
      campus_id: null,
      first_name: "Ola",
      last_name: "Hansen",
      phone: "+4792345678",
      ticket_email: "ola@example.com",
    });
  function seats(participantId: string | undefined): string[] {
    return fake
      .rows(MEMBERS)
      .filter((member) => member.participant_id === participantId)
      .map((member) => `${member.group_id}:${member.leg}`)
      .sort();
  }
  const groupMapping = mappingFor("first_name", "last_name", "phone", "group");

  test("a person named into a room takes the room's bus", async () => {
    seed({
      [GROUPS]: [
        busRow("g-b1", "Buss 1"),
        busRow("g-b2", "Buss 2"),
        {
          $id: "g-101",
          big_event_id: "b1",
          booking_participant_id: null,
          campus_id: null,
          capacity: 4,
          home_bus_id: "g-b1",
          kind: "room",
          name: "101",
          out_bus_id: "g-b1",
          source_key: "col:room:-:101",
        },
      ],
      [MEMBERS]: [
        // Kari got a seat on bus 2 before she had a room.
        seatRow("g-b2", "p1", "out"),
        seatRow("g-b2", "p1", "home"),
        // Ola was moved onto bus 2 by hand on the way out.
        seatRow("g-b2", "p2", "out", true),
        seatRow("g-b2", "p2", "home"),
      ],
      [PARTICIPANTS]: [participantRow({ campus_id: null }), ola()],
    });
    const form = () =>
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Rom"],
        ["Kari", "Nordmann", "91234567", "101"],
        ["Ola", "Hansen", "92345678", "101"],
        ["Per", "Dahl", "93456789", "101"],
      ]);

    // Kari and Per move to the room's bus; Ola stays where he was moved.
    expect(
      await previewImport("b1", form(), groupMapping, {
        ...PLAIN,
        groupKind: "room",
      })
    ).toMatchObject({ busNotices: 0, nothingNew: false, roomBusMoves: 2 });
    const result = await applyImport("b1", form(), groupMapping, {
      ...PLAIN,
      groupKind: "room",
    });

    expect(result).toMatchObject({ complete: true, placed: 3 });
    const per = byName(fake.rows(PARTICIPANTS), "Per");
    expect(seats("p1")).toEqual(["g-101:null", "g-b1:home", "g-b1:out"]);
    // Ola stays where he was moved by hand, and rides home on that bus too.
    expect(seats("p2")).toEqual(["g-101:null", "g-b2:home", "g-b2:out"]);
    expect(seats(per?.$id)).toEqual(["g-101:null", "g-b1:home", "g-b1:out"]);
    expect(
      fake
        .rows(MEMBERS)
        .every((member) => member.pinned === (member.$id === "m-g-b2-p2-out"))
    ).toBe(true);
  });

  test("a pinned out seat takes the home seat with it on import", async () => {
    seed({
      [GROUPS]: [
        busRow("g-b1", "Buss 1"),
        busRow("g-b2", "Buss 2"),
        {
          $id: "g-101",
          big_event_id: "b1",
          booking_participant_id: null,
          campus_id: null,
          capacity: 4,
          home_bus_id: "g-b1",
          kind: "room",
          name: "101",
          out_bus_id: "g-b1",
          source_key: "col:room:-:101",
        },
      ],
      [MEMBERS]: [
        // Both were moved onto bus 2 by hand on the way out only. Kari has
        // no way home yet; Ola still rides home on bus 1.
        seatRow("g-b2", "p1", "out", true),
        seatRow("g-b2", "p2", "out", true),
        seatRow("g-b1", "p2", "home"),
      ],
      [PARTICIPANTS]: [participantRow({ campus_id: null }), ola()],
    });

    const result = await applyImport(
      "b1",
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Rom"],
        ["Kari", "Nordmann", "91234567", "101"],
        ["Ola", "Hansen", "92345678", "101"],
      ]),
      groupMapping,
      { ...PLAIN, groupKind: "room" }
    );

    expect(result).toMatchObject({ complete: true, placed: 2 });
    // Home follows the hand-moved way out (ruling R5), not the room's bus.
    expect(seats("p1")).toEqual(["g-101:null", "g-b2:home", "g-b2:out"]);
    expect(seats("p2")).toEqual(["g-101:null", "g-b2:home", "g-b2:out"]);
  });

  test("a re-import updates a booking room's capacity", async () => {
    await applyImport("b1", ticksterForm(), TICKSTER_MAPPING, ROOM_BOOKINGS);
    const room = () =>
      fake.rows(GROUPS).find((group) => group.source_key === "booking:A100");
    expect(room()?.capacity).toBe(4);
    // An older file sold Ola's room as a 2-person room.
    Object.assign(room() ?? {}, { capacity: 2 });
    expect(
      await previewImport("b1", ticksterForm(), TICKSTER_MAPPING, ROOM_BOOKINGS)
    ).toMatchObject({ nothingNew: false, placed: 0, resizedRooms: 1 });
    fake.db.updateRow.mockClear();

    const again = await applyImport(
      "b1",
      ticksterForm(),
      TICKSTER_MAPPING,
      ROOM_BOOKINGS
    );

    expect(again).toMatchObject({ complete: true, newGroups: 0 });
    expect(room()?.capacity).toBe(4);
    // Only the room whose size changed is written.
    const roomWrites = fake.db.updateRow.mock.calls.filter(
      ([, tableId]) => tableId === GROUPS
    );
    expect(roomWrites).toEqual([
      ["app", GROUPS, String(room()?.$id), { capacity: 4 }],
    ]);
  });

  test("import bus moves after publishing mark notices", async () => {
    const seedBuses = (published: string | null) =>
      seed({
        big_events: [{ ...bigEvent, bus_lists_published_at: published }],
        [GROUPS]: [busRow("g-b1", "Buss 1"), busRow("g-b2", "Buss 2")],
        [MEMBERS]: [
          seatRow("g-b1", "p1", "out"),
          seatRow("g-b1", "p1", "home"),
          seatRow("g-b1", "p2", "out"),
          seatRow("g-b1", "p2", "home"),
        ],
        [PARTICIPANTS]: [participantRow({ campus_id: null }), ola()],
      });
    // Kari moves to bus 2, Ola stays on bus 1, Per is new on bus 2.
    const form = () =>
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Buss"],
        ["Kari", "Nordmann", "91234567", "Buss 2"],
        ["Ola", "Hansen", "92345678", "Buss 1"],
        ["Per", "Dahl", "93456789", "Buss 2"],
      ]);
    const busImport = { ...PLAIN, groupKind: "bus" as const };
    const noticeOf = (firstName: string) =>
      byName(fake.rows(PARTICIPANTS), firstName)?.bus_notice_due_at ?? null;

    // Before publishing, nobody has been told anything: no notices.
    seedBuses(null);
    expect(
      await previewImport("b1", form(), groupMapping, busImport)
    ).toMatchObject({ busNotices: 0, moved: 1 });
    await applyImport("b1", form(), groupMapping, busImport);
    expect(["Kari", "Ola", "Per"].map(noticeOf)).toEqual([null, null, null]);

    seedBuses("2027-01-10T10:00:00.000Z");
    expect(
      await previewImport("b1", form(), groupMapping, busImport)
    ).toMatchObject({ busNotices: 2, moved: 1 });
    const result = await applyImport("b1", form(), groupMapping, busImport);
    expect(result).toMatchObject({ complete: true, moved: 1 });
    expect(seats("p1")).toEqual(["g-b2:home", "g-b2:out"]);
    expect(noticeOf("Kari")).toEqual(expect.any(String));
    expect(noticeOf("Ola")).toBeNull();
    expect(noticeOf("Per")).toEqual(expect.any(String));
    const [, , audit] = logAuditEvent.mock.calls.at(-1) ?? [];
    expect(audit).toMatchObject({ payload: { bus_notices: 2 } });
  });

  function roomRow(campusId: string | null, busId: string): FakeRow {
    return {
      $id: "g-101",
      big_event_id: "b1",
      booking_participant_id: null,
      campus_id: campusId,
      capacity: 4,
      home_bus_id: busId,
      kind: "room",
      name: "101",
      out_bus_id: busId,
      source_key: `col:room:${campusId ?? "-"}:101`,
    };
  }

  test("a campus admin's import keeps a person pinned on another campus's bus", async () => {
    // Kari and Ola moved from Oslo to Bergen. Oslo's organizers had moved
    // Kari onto their bus by hand; Ola still rides home on it.
    const seedCampuses = () =>
      seed({
        [GROUPS]: [
          {
            ...busRow("g-oslo", "Buss 1"),
            campus_id: "1",
            source_key: "col:bus:1:buss 1",
          },
          {
            ...busRow("g-bergen", "Buss 1"),
            campus_id: "2",
            source_key: "col:bus:2:buss 1",
          },
          roomRow("2", "g-bergen"),
        ],
        [MEMBERS]: [
          seatRow("g-oslo", "p1", "out", true),
          seatRow("g-oslo", "p1", "home"),
          seatRow("g-oslo", "p2", "home"),
        ],
        [PARTICIPANTS]: [participantRow(), { ...ola(), campus_id: "2" }],
      });
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });
    const file = (column: string, value: string) =>
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", column],
        ["Kari", "Nordmann", "91234567", value],
        ["Ola", "Hansen", "92345678", value],
      ]);
    const bergen = { ...PLAIN, defaultCampusId: "2" as const };

    // Room import: nobody gets a second bus on a trip they already have.
    seedCampuses();
    const rooms = await applyImport("b1", file("Rom", "101"), groupMapping, {
      ...bergen,
      groupKind: "room",
    });
    expect(rooms).toMatchObject({ complete: true, placed: 2 });
    expect(seats("p1")).toEqual(["g-101:null", "g-oslo:home", "g-oslo:out"]);
    expect(seats("p2")).toEqual(["g-101:null", "g-bergen:out", "g-oslo:home"]);

    // Bus import: Kari stays put; Ola gets only the way out.
    seedCampuses();
    const busImport = { ...bergen, groupKind: "bus" as const };
    expect(
      await previewImport("b1", file("Buss", "Buss 1"), groupMapping, busImport)
    ).toMatchObject({ keptPinned: 1, newGroups: 0 });
    await applyImport("b1", file("Buss", "Buss 1"), groupMapping, busImport);
    expect(seats("p1")).toEqual(["g-oslo:home", "g-oslo:out"]);
    expect(seats("p2")).toEqual(["g-bergen:out", "g-oslo:home"]);
    // Oslo's seats are never touched.
    expect(
      fake.rows(MEMBERS).find((member) => member.$id === "m-g-oslo-p1-out")
    ).toMatchObject({ pinned: true });
  });

  test("re-importing the same file writes no memberships, groups or notices", async () => {
    seed({
      big_events: [
        { ...bigEvent, bus_lists_published_at: "2027-01-10T10:00:00.000Z" },
      ],
      [GROUPS]: [busRow("g-b1", "Buss 1"), roomRow(null, "g-b1")],
      [MEMBERS]: [],
      [PARTICIPANTS]: [participantRow({ campus_id: null })],
    });
    const form = () =>
      pasteForm([
        ["Navn", "Etternavn", "Mobilnr", "Rom"],
        ["Kari", "Nordmann", "91234567", "101"],
        ["Per", "Dahl", "93456789", "101"],
      ]);
    const roomImport = { ...PLAIN, groupKind: "room" as const };
    await applyImport("b1", form(), groupMapping, roomImport);
    expect(seats("p1")).toEqual(["g-101:null", "g-b1:home", "g-b1:out"]);

    expect(
      await previewImport("b1", form(), groupMapping, roomImport)
    ).toMatchObject({
      busNotices: 0,
      moved: 0,
      newGroups: 0,
      nothingNew: true,
      placed: 0,
      resizedRooms: 0,
      roomBusMoves: 0,
    });
    fake.db.createRow.mockClear();
    fake.db.deleteRow.mockClear();
    fake.db.updateRow.mockClear();
    const again = await applyImport("b1", form(), groupMapping, roomImport);

    expect(again).toMatchObject({ complete: true, moved: 0, placed: 0 });
    expect(fake.db.createRow).not.toHaveBeenCalled();
    expect(fake.db.deleteRow).not.toHaveBeenCalled();
    const writes = fake.db.updateRow.mock.calls;
    expect(writes.every(([, tableId]) => tableId === PARTICIPANTS)).toBe(true);
    expect(
      writes.some(([, , , data]) => data && "bus_notice_due_at" in data)
    ).toBe(false);
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
