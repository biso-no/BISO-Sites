import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  EventsCoverPattern,
  EventsLocationMode,
  EventsPricingMode,
  EventsPublishMode,
  EventsStatus,
} from "@repo/api/types/appwrite";
import type { EventUpsertInput } from "@repo/shared/types/events";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
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

const departmentCtx = makeCtx({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  departmentTeamIds: ["sg-app-dept-sosialutvalget"],
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: ["dept-1"],
});

let currentCtx: UserAuthContext = departmentCtx;

const departmentEventValues: EventUpsertInput = {
  campus_id: "campus-oslo",
  capacity: 100,
  category: null,
  contact_email: null,
  contact_name: null,
  contact_role: null,
  cover_pattern: EventsCoverPattern.DOTTED,
  department_id: "dept-1",
  description_en: "<p>English source</p>",
  description_no: "<p>Norsk kilde</p>",
  end_date: null,
  image: null,
  is_collection: false,
  location: null,
  location_mode: EventsLocationMode.PHYSICAL,
  member_only: false,
  member_price: null,
  notify_push: false,
  online_url: null,
  price: null,
  pricing_mode: EventsPricingMode.FREE,
  publish_mode: EventsPublishMode.NOW,
  registration_deadline: null,
  scheduled_publish_at: null,
  short_description_en: "English source teaser",
  short_description_no: "Norsk kildeingress",
  slug: "student-event",
  start_date: null,
  status: EventsStatus.DRAFT,
  tags: [],
  ticket_url: null,
  title_en: "English source title",
  title_no: "Norsk kildetittel",
  waitlist: false,
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "campus-oslo"]]),
    campusNamesById: new Map([["campus-oslo", "Oslo"]]),
    departmentIdsByName: new Map([["Sosialutvalget", "dept-1"]]),
    departmentNamesById: new Map([["dept-1", "Sosialutvalget"]]),
  })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));
// NOTE: never mock.module("./announcements") here — bun module mocks are
// process-wide and would clobber the real announcements action module for
// every later test file in the suite.
mock.module("@/lib/announcements/send", () => ({
  buildDeepLink: mock(() => "biso://announcements/announcement-1"),
  dispatchAnnouncement: mock(async () => ({ recipients: 0 })),
}));

const { createEvent, getEvent, updateEvent } = await import("./events");
const { createSegment } = await import("./event-segments");

function mockEventRow(event: Record<string, unknown> | null): void {
  db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
    if (tableId === "events") {
      return { rows: event ? [event] : [], total: event ? 1 : 0 };
    }
    return { rows: [], total: 0 };
  });
}

beforeEach(() => {
  currentCtx = departmentCtx;
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();

  db.getRow.mockImplementation(
    (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "departments") {
        return { $id: rowId, campus: { $id: "campus-oslo" } };
      }
      throw new Error(`Unexpected getRow for ${tableId}`);
    }
  );
  db.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  db.createRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
  db.deleteRow.mockImplementation(async () => undefined);
});

describe("event relationship persistence", () => {
  test("createEvent persists ownership and both nested locales", async () => {
    const result = await createEvent(departmentEventValues);

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "events",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        department: "dept-1",
        translation_refs: expect.arrayContaining([
          expect.objectContaining({
            $permissions: expect.any(Array),
            content_type: "event",
            locale: "no",
          }),
          expect.objectContaining({ content_type: "event", locale: "en" }),
        ]),
      }),
      expect.any(Array)
    );
  });

  test("department author cannot create outside their department", async () => {
    const result = await createEvent({
      ...departmentEventValues,
      department_id: "dept-other",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this department",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("updateEvent authorizes the persisted relationship scope", async () => {
    mockEventRow({
      $id: "event-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      member_only: false,
      status: "draft",
    });

    const result = await updateEvent("event-1", departmentEventValues);

    expect(result).toEqual({ error: "Unauthorized: no access to this campus" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("getEvent hides rows outside the relationship scope", async () => {
    mockEventRow({
      $id: "event-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "published",
    });

    await expect(getEvent("event-1")).resolves.toBeNull();
  });
});

describe("event segment authorization", () => {
  const segmentValues = {
    campus_id: null,
    capacity: 0,
    event_id: "event-1",
    kind: "vip",
    name: "VIP",
    topic_id: null,
  };

  test("segment creation is scoped to the parent event's ownership", async () => {
    mockEventRow({
      $id: "event-1",
      campus: { $id: "campus-oslo" },
      campus_id: "campus-oslo",
      department: { $id: "dept-1" },
      status: "draft",
    });

    const result = await createSegment(segmentValues);

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "event_segments",
      expect.any(String),
      expect.objectContaining({ event_id: "event-1", name: "VIP" })
    );
  });

  test("segment creation is denied outside the parent event's scope", async () => {
    mockEventRow({
      $id: "event-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "draft",
    });

    const result = await createSegment(segmentValues);

    expect(result).toEqual({ error: "Event not found" });
    expect(db.createRow).not.toHaveBeenCalled();
  });
});
