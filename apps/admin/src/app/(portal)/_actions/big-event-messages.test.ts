import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { MessageDraft } from "@/lib/big-events/messages/draft";
import { createFakeTablesDb, type FakeRow } from "@/test/fake-tables-db";

mock.module("server-only", () => ({}));

const fake = createFakeTablesDb();
const users = {
  get: mock(
    async (_args: { userId: string }): Promise<{ targets: unknown[] }> => ({
      targets: [],
    })
  ),
};
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({
    db: fake.db,
    messaging: {},
    users,
  })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  revalidateTag: mock(() => undefined),
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
}));
// `mock.module` is process-wide: every export stays, only these are faked.
const actualIntl = await import("next-intl/server");
mock.module("next-intl/server", () => ({
  ...actualIntl,
  getLocale: mock(async () => "en"),
  getTranslations: mock(
    async () => (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key
  ),
}));

const sendMessage = mock(
  async (_deps: unknown, _id: string, _options?: { claimedAt?: string }) =>
    ({
      counts: { email: 1, push: 1, recipients: 3, sms: 0 },
      ok: true,
    }) as const
);
mock.module("@repo/shared/big-events/messages/send", () => ({ sendMessage }));

const isFeatureEnabled = mock(async (_key: string) => false);
const actualFlags = await import("@repo/shared/utils/feature-flags-server");
mock.module("@repo/shared/utils/feature-flags-server", () => ({
  ...actualFlags,
  isFeatureEnabled,
}));

const translateContentFields = mock(
  async (_input: {
    fields: { key: string; value: string }[];
  }): Promise<Record<string, string>> => ({})
);
mock.module("@/lib/content-translation.server", () => ({
  translateContentFields,
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
const bergenAdmin = makeCtx({
  managedCampusIds: ["2"],
  resolvedCampusIds: ["2"],
  roles: ["campusadmin"],
  userId: "bergen-1",
});
const nobody = makeCtx({ userId: "student-1" });

let currentCtx: UserAuthContext = globalAdmin;
const logAuditEvent = mock(
  async (..._args: unknown[]): Promise<undefined> => undefined
);
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));

const {
  cancelMessage,
  listMessages,
  previewMessage,
  retryMessage,
  sendBigEventMessage: sendAction,
  translateMessage,
  unpinMessage,
} = await import("./big-event-messages");

let drafts = 0;
/** Each call a new draft unless a test names one, as the composer does. */
function sendBigEventMessage(
  bigEventId: string,
  message: MessageDraft,
  when: { at: string },
  draftId = `draft-${++drafts}`
) {
  return sendAction(bigEventId, message, when, draftId);
}

const EVENTS = "big_events";
const PARTICIPANTS = "big_event_participants";
const GROUPS = "big_event_groups";
const MEMBERS = "big_event_group_members";
const MESSAGES = "big_event_messages";
const NOW = "2027-01-20T12:00:00.000Z";

const bigEvent: FakeRow = {
  $id: "b1",
  bus_lists_published_at: null,
  campus_id: "5",
  department_id: null,
  ends_at: "2027-01-27T17:00:00.000+00:00",
  name_no: "Winter Games 2027",
  slug: "winter-games-2027",
  starts_at: "2027-01-24T07:00:00.000+00:00",
  status: "published",
  travel_enabled: true,
};

function person(id: string, fields: Record<string, unknown>): FakeRow {
  return {
    $id: id,
    big_event_id: "b1",
    campus_id: "2",
    first_name: id,
    phone: null,
    ticket_email: null,
    user_id: null,
    ...fields,
  };
}

function bus(id: string, fields: Record<string, unknown>): FakeRow {
  return {
    $id: id,
    big_event_id: "b1",
    campus_id: "2",
    contact_name: "Kari",
    contact_phone: null,
    home_departs_at: null,
    home_meeting_point: null,
    kind: "bus",
    name: id,
    out_departs_at: "2027-01-24T07:00:00.000Z",
    out_meeting_point: "BI Bergen",
    ...fields,
  };
}

function seat(participant: string, group: string, leg: string): FakeRow {
  return {
    $id: `${participant}-${group}-${leg}`,
    big_event_id: "b1",
    group_id: group,
    leg,
    participant_id: participant,
  };
}

function messageRow(id: string, fields: Record<string, unknown> = {}): FakeRow {
  return {
    $createdAt: "2027-01-20T10:00:00.000+00:00",
    $id: id,
    also_sms: false,
    audience: JSON.stringify({ type: "everyone" }),
    big_event_id: "b1",
    body_en: "Hi",
    body_no: "Hei",
    campus_ids: [],
    email_count: 0,
    failed_count: 0,
    important: false,
    kind: "manual",
    leg: null,
    pinned: false,
    push_count: 0,
    recipients: 0,
    scheduled_at: "2027-01-20T10:00:00.000+00:00",
    sent_at: "2027-01-20T10:00:03.000+00:00",
    sms_count: 0,
    status: "sent",
    title_en: "Info",
    title_no: "Info",
    ...fields,
  };
}

function seed(extra: Record<string, FakeRow[]> = {}): void {
  fake.reset({
    [EVENTS]: [bigEvent],
    [GROUPS]: [
      bus("Buss 1", { out_meeting_point: null }),
      bus("Oslo 1", { campus_id: "1" }),
    ],
    [MEMBERS]: [seat("ola", "Buss 1", "out"), seat("kari", "Oslo 1", "out")],
    [MESSAGES]: [],
    [PARTICIPANTS]: [
      person("kari", { campus_id: "1", user_id: "u-kari" }),
      person("ola", { ticket_email: "ola@example.com" }),
      person("per", {}),
    ],
    ...extra,
  });
}

const draft = (overrides: Partial<MessageDraft> = {}): MessageDraft => ({
  alsoSms: false,
  audience: { type: "everyone" },
  body: {
    en: "Hi {first name}, see you at {meeting point}",
    no: "Hei {fornavn}, vi ses ved {oppmøtested}",
  },
  important: false,
  title: { en: "Your bus", no: "Bussen din" },
  ...overrides,
});

function messages(): FakeRow[] {
  return fake.rows(MESSAGES);
}

const fetchMock = mock(async (..._args: unknown[]) => new Response(null));
const realFetch = globalThis.fetch;
const savedEnv = {
  api: process.env.NEXT_PUBLIC_API_BASE_URL,
  secret: process.env.CRON_SECRET,
};

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

beforeEach(() => {
  currentCtx = globalAdmin;
  seed();
  setSystemTime(new Date(NOW));
  for (const fn of [
    sendMessage,
    isFeatureEnabled,
    translateContentFields,
    logAuditEvent,
    users.get,
    fetchMock,
  ]) {
    fn.mockClear();
  }
  users.get.mockImplementation(async ({ userId }) => ({
    targets: userId === "u-kari" ? [{ providerType: "push" }] : [],
  }));
  isFeatureEnabled.mockImplementation(async () => false);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
  process.env.CRON_SECRET = "secret";
});

afterEach(() => {
  setSystemTime();
});

afterAll(() => {
  globalThis.fetch = realFetch;
  restoreEnv("NEXT_PUBLIC_API_BASE_URL", savedEnv.api);
  restoreEnv("CRON_SECRET", savedEnv.secret);
});

describe("refusals per error code (M11)", () => {
  test("no_access: someone without access to the big event", async () => {
    currentCtx = nobody;
    expect(await previewMessage("b1", draft())).toEqual({
      error: "no_access",
      ok: false,
    });
    expect(await sendBigEventMessage("b1", draft(), { at: "now" })).toEqual({
      error: "no_access",
      ok: false,
    });
    expect(
      await translateMessage("b1", { body: "Hei", from: "no", title: "Hei" })
    ).toEqual({ error: "no_access", ok: false });
    expect(await listMessages("b1")).toEqual({ error: "no_access", ok: false });
    expect(messages()).toHaveLength(0);
  });

  test("unknown_placeholder: an unknown {…} blocks preview and sending", async () => {
    const bad = draft({ body: { en: "Hi {name}", no: "Hei {navn}" } });
    expect(await previewMessage("b1", bad)).toEqual({
      error: "unknown_placeholder",
      ok: false,
    });
    expect(await sendBigEventMessage("b1", bad, { at: "now" })).toEqual({
      error: "unknown_placeholder",
      ok: false,
    });
    expect(messages()).toHaveLength(0);
  });

  test("missing_translation: both languages are needed to send", async () => {
    const result = await sendBigEventMessage(
      "b1",
      draft({ body: { no: "Hei" }, title: { no: "Info" } }),
      { at: "now" }
    );
    expect(result).toEqual({ error: "missing_translation", ok: false });
    expect(messages()).toHaveLength(0);
  });

  test("scheduling in the past is refused", async () => {
    const result = await sendBigEventMessage("b1", draft(), {
      at: "2027-01-20T11:58:00.000Z",
    });
    expect(result).toEqual({ error: "in_the_past", ok: false });
    expect(messages()).toHaveLength(0);
  });

  test("no_people: an audience nobody is in", async () => {
    const result = await sendBigEventMessage(
      "b1",
      draft({ audience: { campusIds: ["3"], type: "campus" } }),
      { at: "now" }
    );
    expect(result).toEqual({ error: "no_people", ok: false });
    expect(messages()).toHaveLength(0);
  });

  test("not_found: a message that doesn't exist", async () => {
    for (const action of [cancelMessage, retryMessage, unpinMessage]) {
      expect(await action("missing")).toEqual({
        error: "not_found",
        ok: false,
      });
    }
  });

  test("already_sent: too late to cancel, nothing to try again", async () => {
    seed({ [MESSAGES]: [messageRow("m1")] });
    expect(await cancelMessage("m1")).toEqual({
      error: "already_sent",
      ok: false,
    });
    expect(await retryMessage("m1")).toEqual({
      error: "already_sent",
      ok: false,
    });
    expect(messages()).toHaveLength(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("previewMessage", () => {
  test("counts who gets what, samples per meeting point and flags missing details", async () => {
    const result = await previewMessage("b1", draft());
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.reach).toEqual({
      email: 1,
      people: 3,
      push: 1,
      sms: 0,
      unreachable: 1,
    });
    // Per has no bus and Buss 1 no meeting point: their texts are the same.
    expect(result.samples.map((sample) => sample.label)).toEqual([
      "Oslo 1",
      "Buss 1",
    ]);
    expect(result.samples[0]?.text.no).toEqual({
      body: "Hei kari, vi ses ved BI Bergen",
      title: "Bussen din",
    });
    expect(result.warnings).toEqual([
      'warnings.noMeetingPoint {"bus":"Buss 1","leg":"out"}',
      'warnings.peopleWithoutBus {"count":1,"leg":"out"}',
    ]);
  });

  test("an SMS counts only while the SMS switch is on", async () => {
    seed({
      [PARTICIPANTS]: [person("ola", { phone: "+4791234567" })],
    });
    const off = await previewMessage("b1", draft({ alsoSms: true }));
    isFeatureEnabled.mockImplementation(async () => true);
    const on = await previewMessage("b1", draft({ alsoSms: true }));
    expect(off.ok && off.reach.sms).toBe(0);
    expect(on.ok && on.reach.sms).toBe(1);
    expect(isFeatureEnabled).toHaveBeenCalledWith("big_events_sms");
  });

  test("campus admins only reach their campus", async () => {
    currentCtx = bergenAdmin;
    const everyone = await previewMessage("b1", draft());
    const oslo = await previewMessage(
      "b1",
      draft({ audience: { participantIds: ["kari"], type: "people" } })
    );
    expect(everyone.ok && everyone.reach.people).toBe(2);
    expect(oslo.ok && oslo.reach.people).toBe(0);
  });
});

describe("sendBigEventMessage", () => {
  test("send now writes the message in the sender's scope, sends it and kicks the emails", async () => {
    const result = await sendBigEventMessage("b1", draft({ important: true }), {
      at: "now",
    });

    expect(result).toMatchObject({ ok: true, people: 3, status: "sent" });
    const [row] = messages();
    // Written already claimed for this send (ruling R35).
    expect(row).toMatchObject({
      also_sms: false,
      audience: JSON.stringify({ type: "everyone" }),
      big_event_id: "b1",
      body_no: "Hei {fornavn}, vi ses ved {oppmøtested}",
      campus_ids: [],
      created_by: "admin-1",
      important: true,
      kind: "manual",
      leg: null,
      pinned: true,
      scheduled_at: NOW,
      sent_at: NOW,
      status: "sending",
      title_en: "Your bus",
    });
    expect(result.ok && result.messageId).toBe(row?.$id);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]?.[1]).toBe(row?.$id);
    expect(sendMessage.mock.calls[0]?.[2]).toEqual({ claimedAt: NOW });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, action, details] = logAuditEvent.mock.calls[0] as [
      unknown,
      string,
      { payload: Record<string, unknown> },
    ];
    expect(action).toBe("big_event.message.send");
    expect(details.payload).toMatchObject({
      audience: "everyone",
      message_id: row?.$id,
      people: 3,
    });
    expect(JSON.stringify(details.payload)).not.toContain("Hei");
  });

  test("campus admins only reach their campus", async () => {
    currentCtx = bergenAdmin;
    const result = await sendBigEventMessage("b1", draft(), { at: "now" });
    expect(result).toMatchObject({ ok: true });
    expect(messages()[0]).toMatchObject({ campus_ids: ["2"] });

    const oslo = await sendBigEventMessage(
      "b1",
      draft({ audience: { participantIds: ["kari"], type: "people" } }),
      { at: "now" }
    );
    expect(oslo).toEqual({ error: "no_people", ok: false });
  });

  test("a send that fails is reported as failed, not thrown (R29)", async () => {
    sendMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("push service down"))
    );
    const consoleError = spyOn(console, "error").mockImplementation(
      () => undefined
    );

    const result = await sendBigEventMessage("b1", draft(), { at: "now" });

    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
    expect(result).toEqual({
      messageId: String(messages()[0]?.$id),
      ok: true,
      people: 3,
      status: "failed",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logAuditEvent.mock.calls[0]?.[2]).toMatchObject({
      payload: { status: "failed" },
    });
  });

  test("a later time is scheduled for the cron, not sent", async () => {
    const result = await sendBigEventMessage("b1", draft(), {
      at: "2027-01-21T08:00:00+01:00",
    });
    expect(result).toMatchObject({ ok: true, status: "scheduled" });
    expect(messages()[0]).toMatchObject({
      scheduled_at: "2027-01-21T07:00:00.000Z",
      sent_at: null,
      status: "scheduled",
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("big_event.message.schedule");
  });

  test("the message takes the draft's id; sending it again sends nothing more (R35)", async () => {
    const first = await sendBigEventMessage(
      "b1",
      draft(),
      { at: "now" },
      "0b9f2a64-5c1e-4f3a-9d2b-7e8c1a2b3c4d"
    );
    expect(first).toMatchObject({
      messageId: "0b9f2a64-5c1e-4f3a-9d2b-7e8c1a2b3c4d",
      ok: true,
    });
    // The first answer was lost; the row went on and was sent.
    Object.assign(messages()[0] ?? {}, { recipients: 3, status: "sent" });

    const again = await sendBigEventMessage(
      "b1",
      draft(),
      { at: "now" },
      "0b9f2a64-5c1e-4f3a-9d2b-7e8c1a2b3c4d"
    );

    expect(again).toEqual({
      messageId: "0b9f2a64-5c1e-4f3a-9d2b-7e8c1a2b3c4d",
      ok: true,
      people: 3,
      status: "sent",
    });
    expect(messages()).toHaveLength(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  test("a draft id naming a message the caller can't see tells nothing", async () => {
    seed({
      [MESSAGES]: [
        messageRow("oslo-message", { campus_ids: ["1"], recipients: 40 }),
      ],
    });
    currentCtx = bergenAdmin;
    expect(
      await sendBigEventMessage("b1", draft(), { at: "now" }, "oslo-message")
    ).toEqual({ error: "no_access", ok: false });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("a draft id that can't be a message id is refused", async () => {
    for (const bad of [
      "",
      "-starts-with-a-dash",
      "has space",
      "x".repeat(37),
    ]) {
      await expect(
        sendBigEventMessage("b1", draft(), { at: "now" }, bad)
      ).rejects.toThrow();
    }
    expect(messages()).toHaveLength(0);
  });

  test("a bus audience without a leg is stored for the way out (R13, R8)", async () => {
    await sendBigEventMessage(
      "b1",
      draft({ audience: { groupIds: ["Buss 1"], type: "groups" } }),
      { at: "now" }
    );
    const [row] = messages();
    expect(row?.leg).toBe("out");
    expect(JSON.parse(String(row?.audience))).toEqual({
      groupIds: ["Buss 1"],
      leg: "out",
      type: "groups",
    });
  });
});

describe("translateMessage", () => {
  test("sends only the organizer's title and text, placeholders kept", async () => {
    translateContentFields.mockImplementation(async () => ({
      body: "Hi {first name}",
      title: "Your bus",
    }));
    const result = await translateMessage("b1", {
      body: "Hei {fornavn}",
      from: "no",
      title: "Bussen din",
    });
    expect(result).toEqual({
      body: "Hi {first name}",
      ok: true,
      title: "Your bus",
    });
    expect(translateContentFields.mock.calls[0]?.[0]).toMatchObject({
      fields: [
        { format: "plain", key: "title", value: "Bussen din" },
        { format: "plain", key: "body", value: "Hei {fornavn}" },
      ],
      sourceLocale: "no",
      targetLocale: "en",
    });
  });
});

describe("cancelMessage, retryMessage and unpinMessage", () => {
  test("a scheduled message is cancelled by deleting it", async () => {
    const later = { scheduled_at: "2027-01-20T12:05:00.000Z", sent_at: null };
    seed({
      [MESSAGES]: [
        messageRow("m1", { ...later, status: "scheduled" }),
        messageRow("m2", { ...later, status: null }),
      ],
    });
    expect(await cancelMessage("m1")).toEqual({ ok: true });
    expect(await cancelMessage("m2")).toEqual({ ok: true });
    expect(messages()).toHaveLength(0);
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("big_event.message.cancel");
  });

  test("a message due within a minute, or already due, can't be cancelled (R28)", async () => {
    seed({
      [MESSAGES]: [
        messageRow("in-30s", {
          scheduled_at: "2027-01-20T12:00:30.000Z",
          sent_at: null,
          status: "scheduled",
        }),
        messageRow("past", {
          scheduled_at: "2027-01-20T11:00:00.000Z",
          sent_at: null,
          status: "scheduled",
        }),
      ],
    });
    for (const id of ["in-30s", "past"]) {
      expect(await cancelMessage(id)).toEqual({
        error: "already_sent",
        ok: false,
      });
    }
    expect(messages()).toHaveLength(2);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  test("automatic messages can't be cancelled; other campuses' messages can't be touched", async () => {
    seed({
      [MESSAGES]: [
        messageRow("auto", {
          campus_ids: ["2"],
          kind: "bus_assigned",
          status: "scheduled",
        }),
        messageRow("oslo", {
          campus_ids: ["1"],
          pinned: true,
          status: "scheduled",
        }),
        messageRow("all", { pinned: true }),
      ],
    });
    currentCtx = bergenAdmin;
    expect(await cancelMessage("auto")).toEqual({
      error: "no_access",
      ok: false,
    });
    expect(await cancelMessage("oslo")).toEqual({
      error: "no_access",
      ok: false,
    });
    expect(await unpinMessage("all")).toEqual({
      error: "no_access",
      ok: false,
    });
    expect(messages()).toHaveLength(3);
  });

  test("try again claims a failed message itself and sends it (R35)", async () => {
    seed({
      [MESSAGES]: [messageRow("m1", { failed_count: 2, status: "failed" })],
    });
    const result = await retryMessage("m1");
    expect(result).toEqual({ ok: true, status: "sent" });
    expect(fake.db.updateRow.mock.calls[0]?.[3]).toEqual({
      scheduled_at: NOW,
      sent_at: NOW,
      status: "sending",
    });
    expect(sendMessage.mock.calls[0]?.[1]).toBe("m1");
    expect(sendMessage.mock.calls[0]?.[2]).toEqual({ claimedAt: NOW });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logAuditEvent.mock.calls[0]?.[1]).toBe("big_event.message.retry");
  });

  test("try again sends nothing when another run took the message first", async () => {
    seed({ [MESSAGES]: [messageRow("m1", { status: "failed" })] });
    // Another run claims it right after this write, before the read-back.
    fake.db.updateRow.mockImplementationOnce(
      (
        _db: string,
        _table: string,
        _id: string,
        data: Record<string, unknown> = {}
      ) => {
        const row = messages()[0] as FakeRow;
        Object.assign(row, data, { sent_at: "2027-01-20T12:00:00.500Z" });
        return Promise.resolve({ ...row });
      }
    );

    const result = await retryMessage("m1");

    expect(result).toEqual({ ok: true, status: "sending" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("a try again that fails again is reported as failed (R29)", async () => {
    seed({ [MESSAGES]: [messageRow("m1", { status: "failed" })] });
    sendMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("push service down"))
    );
    const consoleError = spyOn(console, "error").mockImplementation(
      () => undefined
    );

    const result = await retryMessage("m1");

    consoleError.mockRestore();
    expect(result).toEqual({ ok: true, status: "failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logAuditEvent.mock.calls[0]?.[2]).toMatchObject({
      payload: { message_id: "m1", status: "failed" },
    });
  });

  test("unpin takes the pin off", async () => {
    seed({ [MESSAGES]: [messageRow("m1", { important: true, pinned: true })] });
    expect(await unpinMessage("m1")).toEqual({ ok: true });
    expect(messages()[0]).toMatchObject({ important: true, pinned: false });
  });
});

describe("listMessages", () => {
  test("history shows automatic messages", async () => {
    seed({
      [MESSAGES]: [
        messageRow("manual"),
        messageRow("auto-1", {
          audience: JSON.stringify({ participantIds: ["ola"], type: "people" }),
          campus_ids: ["2"],
          kind: "bus_assigned",
          recipients: 1,
          scheduled_at: "2027-01-20T11:00:00.000+00:00",
        }),
        messageRow("auto-2", {
          audience: JSON.stringify({
            participantIds: ["kari"],
            type: "people",
          }),
          campus_ids: ["1"],
          kind: "bus_assigned",
          recipients: 1,
          scheduled_at: "2027-01-20T11:00:00.000+00:00",
        }),
      ],
    });
    const result = await listMessages("b1");
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(
      result.items.map((item) => [item.id, item.automatic, item.counts.people])
    ).toEqual([
      ["auto-1", true, 2],
      ["manual", false, 0],
    ]);
  });

  test("campus admins see their campus's messages and organisation-wide ones (R22)", async () => {
    seed({
      [MESSAGES]: [
        messageRow("all", { scheduled_at: "2027-01-20T09:00:00.000Z" }),
        messageRow("bergen", {
          campus_ids: ["2"],
          scheduled_at: "2027-01-20T10:00:00.000Z",
        }),
        messageRow("oslo", {
          campus_ids: ["1"],
          scheduled_at: "2027-01-20T11:00:00.000Z",
        }),
      ],
    });
    currentCtx = bergenAdmin;
    const result = await listMessages("b1");
    expect(result.ok && result.items.map((item) => item.id)).toEqual([
      "bergen",
      "all",
    ]);
  });
});
