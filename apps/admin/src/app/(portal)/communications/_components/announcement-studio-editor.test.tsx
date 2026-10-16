import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import type { Announcements } from "@repo/api/types/appwrite";
import { act, createElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import type { UserAuthContext } from "@/lib/authorization";
import {
  findButton,
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";

// The composer saves through the real server actions here, and the tests
// assert on the row the mocked table ends up holding: what the form stores is
// checked where it lands. What those actions reach — the Appwrite client,
// auth, cache revalidation and the audit log — is stubbed the way the
// `_actions` suites stub it. The actions themselves stay real, because
// `mock.module` applies to the whole test process and those suites import
// `announcements.ts` for real.
mock.module("server-only", () => ({}));

const db = {
  listRows: mock(),
  updateRow: mock(),
};

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Global Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, messaging: {}, users: {} })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => globalAdminCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("../../_actions/audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));
// Framework modules, stubbed with what the sibling component suites expose.
mock.module("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: ReactNode;
  } & Record<string, unknown>) => createElement("a", props, children),
}));
mock.module("next/navigation", () => ({
  notFound: () => undefined,
  redirect: () => undefined,
  usePathname: () => "/communications",
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => new URLSearchParams(""),
}));

const { AnnouncementStudioEditor } = await import(
  "./announcement-studio-editor"
);

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  installedDom.document.body.textContent = "";
});

afterAll(() => installedDom.restore());

/**
 * The one announcement row the mocked table holds. `listRows` returns a copy
 * and `updateRow` merges into it, as Appwrite does.
 */
let storedRow: Record<string, unknown> = {};

beforeEach(() => {
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) =>
      tableId === "announcements"
        ? { rows: [{ ...storedRow }], total: 1 }
        : { rows: [], total: 0 }
  );
  db.updateRow.mockImplementation(
    (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown> | undefined
    ) => {
      if (data) {
        storedRow = { ...storedRow, ...data };
      }
      return Promise.resolve({ $id: rowId, ...storedRow });
    }
  );
});

const draftBroadcastRow = {
  $id: "announcement-1",
  audience_type: "broadcast",
  audience_value: null,
  body_en: "<p>Body</p>",
  body_no: null,
  campus: null,
  campus_id: "1",
  category: "general",
  data: null,
  deep_link: null,
  department: null,
  event_id: null,
  push: true,
  scheduled_at: null,
  sent_at: null,
  status: "draft",
  title_en: "Title",
  title_no: null,
};

/** A topic announcement as dispatch leaves it: sent, its topic resolved. */
const sentTopicRow = {
  ...draftBroadcastRow,
  audience_type: "topic",
  audience_value: "events_oslo",
  sent_at: "2026-09-01T00:00:00.000Z",
  status: "sent",
};

/** Lets pending server-action promises, and the renders they cause, finish. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openInComposer(
  row: Record<string, unknown>
): Promise<TestElement> {
  storedRow = { ...row };
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(
      createElement(AnnouncementStudioEditor, {
        allowGlobalCampus: true,
        announcement: row as unknown as Announcements,
        campuses: [
          { id: "1", name: "Oslo" },
          { id: "2", name: "Bergen" },
        ],
        defaultCampusId: "1",
        isNew: false,
        lockDepartment: false,
        pinnedDepartmentId: null,
      })
    );
  });
  await settle();
  return container;
}

async function click(element: TestElement): Promise<void> {
  await act(() => {
    element.click();
  });
  await settle();
}

function findButtonWhere(
  container: TestElement,
  description: string,
  matches: (text: string) => boolean
): TestElement {
  const button = findElements(
    container,
    (element) => element.tagName === "BUTTON" && matches(element.textContent)
  )[0];
  if (!button) {
    throw new Error(`Button not found: ${description}`);
  }
  return button;
}

function openDistributionStep(container: TestElement): Promise<void> {
  // A step rail button reads as its number, then its name: "03Distribution".
  return click(
    findButtonWhere(container, "Distribution step", (text) =>
      text.endsWith("Distribution")
    )
  );
}

function chooseAudience(container: TestElement, label: string): Promise<void> {
  // An audience card reads as its label, then its description.
  return click(
    findButtonWhere(container, `${label} audience`, (text) =>
      text.startsWith(label)
    )
  );
}

async function chooseCampus(
  container: TestElement,
  campusId: string
): Promise<void> {
  const campusSelect = findElements(
    container,
    (element) =>
      element.tagName === "SELECT" &&
      element.options.some((option) => option.textContent === "Bergen")
  )[0];
  if (!campusSelect) {
    throw new Error("Campus select not found");
  }
  await act(() => {
    campusSelect.value = campusId;
    campusSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

async function saveDraft(container: TestElement): Promise<void> {
  await click(findButton(container, "Save draft"));
  // Exactly one write, or the save never reached the server.
  expect(db.updateRow).toHaveBeenCalledTimes(1);
}

describe("a Topic audience stores the topic its select shows", () => {
  // The select shows Events for an empty topic, but dispatch sends an empty
  // topic to `general` — every student. The form has to hold "events".
  test("switching an announcement to the Topic audience stores events", async () => {
    const composer = await openInComposer(draftBroadcastRow);

    await openDistributionStep(composer);
    await chooseAudience(composer, "Topic");
    await saveDraft(composer);

    expect(storedRow).toMatchObject({
      audience_type: "topic",
      audience_value: "events",
    });
  });

  test.each([
    ["no topic", null],
    ["an empty topic", ""],
    ["a blank topic", "   "],
  ])("opening a topic announcement with %s stores events", async (_label, audienceValue) => {
    const composer = await openInComposer({
      ...draftBroadcastRow,
      audience_type: "topic",
      audience_value: audienceValue,
    });

    await saveDraft(composer);

    expect(storedRow).toMatchObject({
      audience_type: "topic",
      audience_value: "events",
    });
  });
});

describe("re-saving a sent topic announcement from the composer", () => {
  test("a save with nothing changed keeps its campus-scoped topic", async () => {
    const composer = await openInComposer(sentTopicRow);

    await saveDraft(composer);

    expect(storedRow).toMatchObject({
      audience_value: "events_oslo",
      campus_id: "1",
      status: "sent",
    });
  });

  test("moving it to another campus scopes its topic to that campus", async () => {
    // This relies on the composer editing "events_oslo" as "events": the
    // server resolves a logical topic against the new campus, but passes an
    // already-scoped id through unchanged.
    const composer = await openInComposer(sentTopicRow);

    await openDistributionStep(composer);
    await chooseCampus(composer, "2");
    await saveDraft(composer);

    expect(storedRow).toMatchObject({
      audience_value: "events_bergen",
      campus_id: "2",
      status: "sent",
    });
  });
});
