import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
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

const {
  acceptSuggestion,
  dismissSuggestion,
  findSuggestions,
  linkParticipantManually,
  searchAccountsForLink,
  unlinkParticipantAction,
} = await import("./big-event-linking");

const bigEvent: FakeRow = {
  $id: "b1",
  campus_id: "2",
  department_id: null,
  ends_at: "2027-01-27T17:00:00.000+00:00",
  name_no: "Winter Games 2027",
  starts_at: "2027-01-24T07:00:00.000+00:00",
  status: "draft",
};

function participant(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    $id: "p1",
    big_event_id: "b1",
    campus_id: "2",
    dismissed_user_id: null,
    first_name: "Kari",
    last_name: "Nordmann",
    link_method: null,
    linked_at: null,
    phone: "+4791234567",
    suggested_reason: null,
    suggested_user_id: null,
    ticket_email: "kari@gmail.com",
    user_id: null,
    ...overrides,
  };
}

function account(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    $id: "u1",
    campus_id: "2",
    email: "kari@bi.no",
    name: "Kari Nordmann",
    phone: null,
    student_id: "1234567",
    ...overrides,
  };
}

function seed(participants: FakeRow[], accounts: FakeRow[]): void {
  fake.reset({
    big_event_participants: participants,
    big_events: [bigEvent],
    user: accounts,
  });
}

function stored(id: string): FakeRow | undefined {
  return fake.rows("big_event_participants").find((row) => row.$id === id);
}

beforeEach(() => {
  currentCtx = makeCtx();
  logAuditEvent.mockClear();
});

describe("findSuggestions", () => {
  test("phone suggestion only proposes BI-linked accounts", async () => {
    seed(
      [participant()],
      [
        account({ $id: "u-gmail", phone: "91234567", student_id: null }),
        account({
          $id: "u-bi",
          name: "Someone Else",
          phone: "+47 912 34 567",
        }),
      ]
    );

    const result = await findSuggestions("b1");

    expect(result).toEqual({ suggested: 1 });
    expect(stored("p1")).toMatchObject({
      suggested_reason: "phone",
      suggested_user_id: "u-bi",
    });
  });

  test("no BI-linked account with that phone means no suggestion", async () => {
    seed(
      [participant({ first_name: "Unik" })],
      [account({ $id: "u-gmail", phone: "91234567", student_id: null })]
    );
    expect(await findSuggestions("b1")).toEqual({ suggested: 0 });
    expect(stored("p1")?.suggested_user_id).toBeNull();
  });

  test("a phone on two tickets gives no phone suggestion (R29)", async () => {
    seed(
      [
        participant({ $id: "p1" }),
        participant({ $id: "p2", first_name: "Ola", last_name: "Hansen" }),
      ],
      [account({ $id: "u-bi", name: "Someone Else", phone: "91234567" })]
    );

    expect(await findSuggestions("b1")).toEqual({ suggested: 0 });
    expect(stored("p1")?.suggested_user_id).toBeNull();
    expect(stored("p2")?.suggested_user_id).toBeNull();
  });

  test("a dismissed account is not suggested again", async () => {
    seed(
      [participant({ dismissed_user_id: "u-bi" })],
      [account({ $id: "u-bi", phone: "91234567" })]
    );

    expect(await findSuggestions("b1")).toEqual({ suggested: 0 });
    expect(stored("p1")?.suggested_user_id).toBeNull();
  });

  test("name suggestion needs exactly one hit", async () => {
    seed(
      [participant({ phone: null })],
      [
        account({ $id: "u-a", email: "kari.a@bi.no" }),
        account({ $id: "u-b", email: "kari.b@bi.no" }),
      ]
    );
    expect(await findSuggestions("b1")).toEqual({ suggested: 0 });

    seed(
      [participant({ phone: null })],
      [
        account({ $id: "u-a", email: "kari.a@bi.no" }),
        // Another campus: not the same person for a name match.
        account({ $id: "u-b", campus_id: "1", email: "kari.b@bi.no" }),
      ]
    );
    expect(await findSuggestions("b1")).toEqual({ suggested: 1 });
    expect(stored("p1")).toMatchObject({
      suggested_reason: "name",
      suggested_user_id: "u-a",
    });
  });

  test("skips an account that already holds a ticket here", async () => {
    seed(
      [
        participant({ phone: null }),
        participant({ $id: "p2", first_name: "Ola", user_id: "u-a" }),
      ],
      [account({ $id: "u-a" })]
    );
    expect(await findSuggestions("b1")).toEqual({ suggested: 0 });
  });

  test("campus access looks only at own-campus participants", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["1"],
      resolvedCampusIds: ["1"],
      roles: ["campusadmin"],
    });
    seed(
      [
        participant({ $id: "p-bergen" }),
        participant({ $id: "p-oslo", campus_id: "1", phone: "+4799999999" }),
      ],
      [
        account({ $id: "u-bergen", phone: "91234567" }),
        account({ $id: "u-oslo", phone: "99999999" }),
      ]
    );
    // A campus admin of Oslo has no access to a Bergen big event.
    await expect(findSuggestions("b1")).rejects.toThrow();

    fake.rows("big_events")[0].campus_id = "5";
    expect(await findSuggestions("b1")).toEqual({ suggested: 1 });
    expect(stored("p-bergen")?.suggested_user_id).toBeNull();
    expect(stored("p-oslo")?.suggested_user_id).toBe("u-oslo");
  });
});

describe("accepting and dismissing", () => {
  test("accepting a suggestion links the account by hand", async () => {
    seed(
      [participant({ suggested_reason: "phone", suggested_user_id: "u1" })],
      [account()]
    );
    expect(await acceptSuggestion("p1")).toEqual({ ok: true });
    expect(stored("p1")).toMatchObject({
      link_method: "manual",
      suggested_user_id: null,
      user_id: "u1",
    });
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  test("dismissing remembers the account and clears the suggestion", async () => {
    seed(
      [participant({ suggested_reason: "name", suggested_user_id: "u1" })],
      [account()]
    );
    await dismissSuggestion("p1");
    expect(stored("p1")).toMatchObject({
      dismissed_user_id: "u1",
      suggested_reason: null,
      suggested_user_id: null,
    });
  });
});

describe("linking by hand", () => {
  test("refusals come back as reasons", async () => {
    seed(
      [participant(), participant({ $id: "p2", user_id: "u1" })],
      [account(), account({ $id: "u-gmail", student_id: null })]
    );
    expect(await linkParticipantManually("p1", "u-gmail")).toEqual({
      ok: false,
      reason: "not_bi_linked",
    });
    expect(await linkParticipantManually("p1", "u1")).toEqual({
      ok: false,
      reason: "account_has_ticket",
    });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  test("a campus admin can't link another campus's participant", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["2"],
      resolvedCampusIds: ["2"],
      roles: ["campusadmin"],
    });
    seed([participant({ campus_id: "1" })], [account()]);
    await expect(linkParticipantManually("p1", "u1")).rejects.toThrow();
    expect(stored("p1")?.user_id).toBeNull();
  });

  test("unlinking clears the link", async () => {
    seed([participant({ link_method: "manual", user_id: "u1" })], [account()]);
    await unlinkParticipantAction("p1");
    expect(stored("p1")).toMatchObject({ link_method: null, user_id: null });
  });
});

describe("searchAccountsForLink", () => {
  test("finds only BI-linked accounts and marks those with a ticket here", async () => {
    seed(
      [participant({ user_id: "u-taken" })],
      [
        account({ $id: "u-free", email: "kari.free@bi.no" }),
        account({ $id: "u-taken", email: "kari.taken@bi.no" }),
        account({ $id: "u-gmail", email: "kari@gmail.com", student_id: null }),
      ]
    );

    const found = await searchAccountsForLink("b1", "kari");

    expect(found).toEqual([
      {
        campusName: "Bergen",
        email: "kari.free@bi.no",
        hasTicketHere: false,
        id: "u-free",
        name: "Kari Nordmann",
      },
      {
        campusName: "Bergen",
        email: "kari.taken@bi.no",
        hasTicketHere: true,
        id: "u-taken",
        name: "Kari Nordmann",
      },
    ]);
  });

  test("needs at least two characters", async () => {
    seed([], [account()]);
    expect(await searchAccountsForLink("b1", " k ")).toEqual([]);
  });
});
