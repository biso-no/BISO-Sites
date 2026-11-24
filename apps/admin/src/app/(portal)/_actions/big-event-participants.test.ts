import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import type { ParticipantFormValues } from "@/lib/big-events/participant-form";

mock.module("server-only", () => ({}));

interface ListResult {
  rows: Record<string, unknown>[];
  total: number;
}
type ListHandler = (queries: string[]) => ListResult;

const db = {
  createRow: mock(),
  deleteRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
const users = {
  get: mock(
    async (_args: { userId: string }): Promise<{ targets: unknown[] }> => ({
      targets: [],
    })
  ),
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, users })),
}));

// The real `getScanMembershipStatus` runs (bun's module mocks leak across
// test files, and `membership-lookup.test.ts` needs the real module); only
// its Finago call and the Next cache are faked.
const getCustomerCategories = mock(
  async (_studentNumber: number): Promise<number[]> => []
);
mock.module("@repo/connectors/24sevenoffice", () => ({
  getCustomerCategories,
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  revalidateTag: mock(() => undefined),
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
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
    roles: [],
    userId: "admin-1",
    ...overrides,
  };
}

const globalAdmin = makeCtx({ roles: ["globaladmin"] });
const campusAdminOf = (...campusIds: string[]): UserAuthContext =>
  makeCtx({
    managedCampusIds: campusIds,
    resolvedCampusIds: campusIds,
    roles: ["campusadmin"],
  });

let currentCtx: UserAuthContext = globalAdmin;
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));

const {
  addParticipant,
  checkMemberships,
  exportParticipantsCsv,
  listParticipants,
  removeParticipants,
  sendConnectEmails,
  updateParticipant,
} = await import("./big-event-participants");

function bigEventRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: "b1",
    campus_id: "2",
    created_by: "u0",
    department_id: null,
    ends_at: "2027-01-27T17:00:00.000+00:00",
    group_checkin_enabled: false,
    hero_image_url: null,
    name_en: null,
    name_no: "Winter Games 2027",
    place_address: null,
    place_name: null,
    slug: "winter-games-2027",
    starts_at: "2027-01-24T07:00:00.000+00:00",
    status: "draft",
    travel_enabled: true,
    ...overrides,
  };
}

function participantRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: "p1",
    big_event_id: "b1",
    campus_id: "2",
    connect_nonce: "nonce",
    connect_reminded_at: null,
    connect_sent_at: null,
    connect_token_hash: "hash",
    dismissed_user_id: null,
    first_name: "Kari",
    last_import_id: null,
    last_name: "Nordmann",
    link_method: null,
    linked_at: null,
    membership_checked_at: null,
    membership_valid: null,
    phone: null,
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

const formValues: ParticipantFormValues = {
  campus_id: "2",
  first_name: "Kari",
  last_name: "Nordmann",
  phone: "",
  ticket_email: "",
};

const csvHeaders = {
  campus: "Campus",
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  room: "Room",
};

/** Routes `listRows` by table id; unknown tables return nothing. */
function routeListRows(handlers: Record<string, ListHandler>) {
  db.listRows.mockImplementation(
    async (_database: string, table: string, queries: string[]) =>
      handlers[table]?.(queries) ?? { rows: [], total: 0 }
  );
}

function rows(list: Record<string, unknown>[]): ListResult {
  return { rows: list, total: list.length };
}

function queriesFor(table: string): string[][] {
  return db.listRows.mock.calls
    .filter((call) => call[1] === table)
    .map((call) => call[2] as string[]);
}

function deletedRows(): [string, string][] {
  return db.deleteRow.mock.calls.map(
    (call) => [call[1], call[2]] as [string, string]
  );
}

beforeEach(() => {
  currentCtx = globalAdmin;
  for (const fn of [
    db.createRow,
    db.deleteRow,
    db.listRows,
    db.updateRow,
    users.get,
    getCustomerCategories,
    logAuditEvent,
  ]) {
    fn.mockReset();
  }
  users.get.mockImplementation(async () => ({ targets: [] }));
  getCustomerCategories.mockImplementation(async () => []);
  routeListRows({ big_events: () => rows([bigEventRow()]) });
});

describe("listParticipants", () => {
  test("campus access lists only own-campus participants", async () => {
    currentCtx = campusAdminOf("2");
    routeListRows({
      big_event_participants: () => rows([participantRow()]),
      big_events: () => rows([bigEventRow({ campus_id: "2" })]),
    });

    const list = await listParticipants("b1");

    const [queries] = queriesFor("big_event_participants");
    expect(queries).toContain(Query.equal("big_event_id", ["b1"]));
    expect(queries).toContain(Query.equal("campus_id", ["2"]));
    expect(list.rows.map((row) => row.$id)).toEqual(["p1"]);
  });

  test("refuses a big event the caller can't see", async () => {
    currentCtx = campusAdminOf("3");
    await expect(listParticipants("b1")).rejects.toThrow();
    expect(queriesFor("big_event_participants")).toHaveLength(0);
  });

  test("sorts people into reach piles with their room and account", async () => {
    routeListRows({
      big_event_group_members: () =>
        rows([{ $id: "m1", group_id: "g1", participant_id: "p1" }]),
      big_event_groups: () => rows([{ $id: "g1", name: "Ola Hansen" }]),
      big_event_participants: () =>
        rows([
          participantRow({
            $id: "p1",
            dismissed_user_id: "u-other",
            last_import_id: "import-1",
            suggested_reason: "phone",
            suggested_user_id: "u-other",
            user_id: "u-push",
          }),
          participantRow({
            $id: "p2",
            first_name: "Anne",
            user_id: "u-quiet",
          }),
          participantRow({ $id: "p3", campus_id: null, first_name: "Bjørn" }),
        ]),
      big_events: () => rows([bigEventRow()]),
      user: () =>
        rows([
          { $id: "u-push", email: "s1@bi.no", name: "Kari N" },
          { $id: "u-quiet", email: "s2@bi.no", name: "Anne N" },
        ]),
    });
    users.get.mockImplementation(async ({ userId }) => ({
      targets: userId === "u-push" ? [{ providerType: "push" }] : [],
    }));

    const list = await listParticipants("b1");

    expect(list.counts).toEqual({ app_no_push: 1, email: 1, push: 1 });
    expect(list.noCampus).toBe(1);
    expect(list.hasRooms).toBe(true);
    expect(queriesFor("big_event_groups")[0]).toContain(
      Query.equal("kind", ["room"])
    );
    const byId = new Map(list.rows.map((row) => [row.$id, row]));
    expect(byId.get("p1")).toMatchObject({
      accountEmail: "s1@bi.no",
      accountName: "Kari N",
      pile: "push",
      roomName: "Ola Hansen",
    });
    expect(byId.get("p2")).toMatchObject({
      pile: "app_no_push",
      roomName: null,
    });
    expect(byId.get("p3")).toMatchObject({ accountEmail: null, pile: "email" });
    // Only what the tab shows or edits leaves the server.
    for (const hidden of [
      "connect_nonce",
      "connect_token_hash",
      "dismissed_user_id",
      "last_import_id",
      "suggested_reason",
      "suggested_user_id",
      "big_event_id",
      "$permissions",
    ]) {
      expect(byId.get("p1")).not.toHaveProperty(hidden);
    }
  });

  test("a possible match shows the account's name and email, not its id", async () => {
    routeListRows({
      big_event_participants: () =>
        rows([
          participantRow({
            $id: "p1",
            suggested_reason: "phone",
            suggested_user_id: "u-match",
          }),
          participantRow({
            $id: "p2",
            first_name: "Ola",
            suggested_reason: "name",
            suggested_user_id: "u-gone",
          }),
        ]),
      big_events: () => rows([bigEventRow()]),
      user: () =>
        rows([{ $id: "u-match", email: "kari@bi.no", name: "Kari Nordmann" }]),
    });

    const list = await listParticipants("b1");

    const byId = new Map(list.rows.map((row) => [row.$id, row]));
    expect(byId.get("p1")?.suggestion).toEqual({
      email: "kari@bi.no",
      name: "Kari Nordmann",
      reason: "phone",
    });
    // A suggested account that no longer exists shows nothing.
    expect(byId.get("p2")?.suggestion).toBeNull();
    expect(JSON.stringify(list.rows)).not.toContain("u-match");
  });
});

describe("addParticipant and updateParticipant", () => {
  test("adding stores normalized contact details", async () => {
    db.createRow.mockResolvedValue({ $id: "p-new" });

    const result = await addParticipant("b1", {
      ...formValues,
      phone: "912 34 567",
      ticket_email: " Kari@Example.com ",
    });

    expect(result).toEqual({ id: "p-new" });
    const [, table, , data] = db.createRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(table).toBe("big_event_participants");
    expect(data).toEqual({
      big_event_id: "b1",
      campus_id: "2",
      first_name: "Kari",
      last_name: "Nordmann",
      phone: "+4791234567",
      ticket_email: "kari@example.com",
    });
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("big_event.participant.add");
  });

  test("campus admin can't add someone from another campus", async () => {
    currentCtx = campusAdminOf("2");
    routeListRows({
      big_events: () => rows([bigEventRow({ campus_id: "5" })]),
    });

    await expect(
      addParticipant("b1", { ...formValues, campus_id: "1" })
    ).rejects.toThrow();
    await expect(
      addParticipant("b1", { ...formValues, campus_id: null })
    ).rejects.toThrow();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("campus admin can't move a participant to another campus", async () => {
    currentCtx = campusAdminOf("2");
    routeListRows({
      big_event_participants: () => rows([participantRow()]),
      big_events: () => rows([bigEventRow()]),
    });

    await expect(
      updateParticipant("p1", { ...formValues, campus_id: "1" })
    ).rejects.toThrow();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("editing never touches the account link", async () => {
    routeListRows({
      big_event_participants: () => rows([participantRow({ user_id: "u1" })]),
      big_events: () => rows([bigEventRow()]),
    });

    await updateParticipant("p1", { ...formValues, first_name: "Kari Anne" });

    const [, table, id, data] = db.updateRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect([table, id]).toEqual(["big_event_participants", "p1"]);
    expect(data).not.toHaveProperty("user_id");
    expect(data).toMatchObject({ first_name: "Kari Anne", ticket_email: null });
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe(
      "big_event.participant.update"
    );
  });
});

describe("removeParticipants", () => {
  test("remove deletes the person's group memberships", async () => {
    routeListRows({
      big_event_group_members: () =>
        rows([
          { $id: "m1", group_id: "g1", participant_id: "p1" },
          { $id: "m2", group_id: "g2", participant_id: "p1" },
        ]),
      big_event_participants: () => rows([participantRow()]),
      big_events: () => rows([bigEventRow()]),
    });

    const result = await removeParticipants(["p1"]);

    expect(result).toEqual({ removed: 1 });
    expect(queriesFor("big_event_group_members")[0]).toContain(
      Query.equal("participant_id", ["p1"])
    );
    expect(deletedRows()).toEqual([
      ["big_event_group_members", "m1"],
      ["big_event_group_members", "m2"],
      ["big_event_participants", "p1"],
    ]);
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe(
      "big_event.participant.remove"
    );
  });

  test("campus admin can't remove another campus's participant", async () => {
    currentCtx = campusAdminOf("2");
    routeListRows({
      big_event_participants: () =>
        rows([participantRow(), participantRow({ $id: "p2", campus_id: "1" })]),
      big_events: () => rows([bigEventRow({ campus_id: "5" })]),
    });

    await expect(removeParticipants(["p1", "p2"])).rejects.toThrow();
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});

describe("checkMemberships", () => {
  test("membership check marks an invalid membership", async () => {
    routeListRows({
      big_event_participants: () => rows([participantRow({ user_id: "u1" })]),
      big_events: () => rows([bigEventRow()]),
      user: () => rows([{ $id: "u1", student_id: "s1234567" }]),
    });

    const result = await checkMemberships("b1");

    expect(result).toEqual({ checked: 1, invalid: 1 });
    expect(getCustomerCategories).toHaveBeenCalledWith(1_234_567);
    expect(queriesFor("big_event_participants")[0]).toContain(
      Query.isNotNull("user_id")
    );
    const [, table, id, data] = db.updateRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect([table, id]).toEqual(["big_event_participants", "p1"]);
    expect(data.membership_valid).toBe(false);
    expect(typeof data.membership_checked_at).toBe("string");
  });

  test("a failed lookup leaves the old value", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(
      () => undefined
    );
    routeListRows({
      big_event_participants: () =>
        rows([participantRow({ membership_valid: true, user_id: "u1" })]),
      big_events: () => rows([bigEventRow()]),
      user: () => rows([{ $id: "u1", student_id: "s1234567" }]),
    });
    getCustomerCategories.mockImplementation(() =>
      Promise.reject(new Error("Finago is down"))
    );

    const result = await checkMemberships("b1");

    consoleError.mockRestore();
    expect(result).toEqual({ checked: 0, invalid: 0 });
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});

describe("exportParticipantsCsv", () => {
  test("csv export escapes commas", async () => {
    routeListRows({
      big_event_participants: () =>
        rows([
          participantRow({ last_name: "Nordmann, jr.", phone: "+4791234567" }),
        ]),
      big_events: () => rows([bigEventRow()]),
    });

    const csv = await exportParticipantsCsv("b1", "all", csvHeaders);

    expect(csv.split("\n")).toEqual([
      "First name,Last name,Email,Phone,Campus,Room",
      'Kari,"Nordmann, jr.",kari@example.com,+4791234567,Bergen,',
    ]);
  });

  test("exports only the chosen pile", async () => {
    routeListRows({
      big_event_participants: () =>
        rows([
          participantRow({ $id: "p1", first_name: "Kari" }),
          participantRow({ $id: "p2", first_name: "Ola", user_id: "u1" }),
        ]),
      big_events: () => rows([bigEventRow()]),
    });

    const csv = await exportParticipantsCsv("b1", "email", csvHeaders);

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("Kari");
    expect(csv).not.toContain("Ola");
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}

describe("sendConnectEmails", () => {
  const fetchMock = mock(async (..._args: unknown[]) => new Response(null));
  const realFetch = globalThis.fetch;
  const savedEnv = {
    api: process.env.NEXT_PUBLIC_API_BASE_URL,
    secret: process.env.CRON_SECRET,
  };

  beforeEach(() => {
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
    process.env.CRON_SECRET = "secret";
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
    restoreEnv("NEXT_PUBLIC_API_BASE_URL", savedEnv.api);
    restoreEnv("CRON_SECRET", savedEnv.secret);
  });

  function route(
    participants: Record<string, unknown>[],
    status = "published"
  ) {
    routeListRows({
      big_event_deliveries: () => rows([]),
      big_event_participants: () => rows(participants),
      big_events: () => rows([bigEventRow({ status })]),
    });
  }

  test("refuses while the big event is a draft", async () => {
    route([participantRow()], "draft");
    await expect(sendConnectEmails("b1")).rejects.toThrow(
      "Publish the big event"
    );
    expect(db.createRow).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("queues only visible unlinked people", async () => {
    currentCtx = campusAdminOf("2");
    route([
      participantRow({ $id: "p1", ticket_email: "a@example.com" }),
      participantRow({ $id: "p2", ticket_email: "b@example.com" }),
    ]);

    const result = await sendConnectEmails("b1");

    expect(result).toEqual({ addresses: 2, queued: 2 });
    const [queries] = queriesFor("big_event_participants");
    expect(queries).toContain(Query.equal("campus_id", ["2"]));
    expect(queries).toContain(Query.isNull("user_id"));
    expect(queries).toContain(Query.isNotNull("ticket_email"));
    expect(logAuditEvent).toHaveBeenCalledWith(
      currentCtx,
      "big_event.connect_emails.send",
      expect.objectContaining({
        payload: { addresses: 2, queued: 2, requested: null },
      })
    );
  });

  test("send again refuses a person outside your campus", async () => {
    currentCtx = campusAdminOf("2");
    route([participantRow({ $id: "p9", campus_id: "3" })]);
    await expect(sendConnectEmails("b1", ["p9"])).rejects.toThrow();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("send again refuses a person who isn't on this big event", async () => {
    route([]);
    await expect(sendConnectEmails("b1", ["p-other"])).rejects.toThrow();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("kicks the processor after queueing", async () => {
    route([participantRow()]);
    await sendConnectEmails("b1", ["p1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/cron/big-event-deliveries");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "x-cron-secret": "secret" });
  });

  test("kick is a no-op without the api url", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "";
    route([participantRow()]);
    await sendConnectEmails("b1", ["p1"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
