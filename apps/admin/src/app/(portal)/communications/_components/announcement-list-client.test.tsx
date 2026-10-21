import {
  afterAll,
  afterEach,
  beforeAll,
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
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";

// The list imports the real announcement actions; what they reach is stubbed
// the way the `_actions` suites stub it, since `mock.module` is process-wide.
mock.module("server-only", () => ({}));

const db = { listRows: mock(), updateRow: mock() };
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
  unstable_cache: (fn: unknown) => fn,
}));
mock.module("../../_actions/audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));
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
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(""),
}));
mock.module("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

const { AnnouncementListClient } = await import("./announcement-list-client");

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

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    $id: id,
    audience_type: "broadcast",
    audience_value: null,
    campus_id: "1",
    category: "general",
    sent_at: null,
    source: "manual",
    status: "draft",
    title_en: `Title ${id}`,
    title_no: null,
    ...overrides,
  } as unknown as Announcements;
}

async function mount(rows: Announcements[]): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(
      createElement(AnnouncementListClient, {
        initialAnnouncements: rows,
        page: 1,
        total: rows.length,
      })
    );
  });
  return container;
}

function reviewLinks(container: TestElement): TestElement[] {
  return findElements(
    container,
    (element) =>
      element.tagName === "A" && element.textContent.includes("Review & send")
  );
}

describe("sending from the history list", () => {
  test("an unsent row links to its Check & send step", async () => {
    const container = await mount([
      row("a1"),
      row("a2", { status: "scheduled" }),
      row("a3", { status: "failed" }),
    ]);

    expect(
      reviewLinks(container).map((link) => link.getAttribute("href"))
    ).toEqual([
      "/communications/a1?step=check",
      "/communications/a2?step=check",
      "/communications/a3?step=check",
    ]);
  });

  test("there is no one-click Send", async () => {
    const container = await mount([row("a1")]);

    const sendButtons = findElements(
      container,
      (element) =>
        element.tagName === "BUTTON" && element.textContent.trim() === "Send"
    );
    expect(sendButtons).toHaveLength(0);
  });

  test("a sent row has no Review & send", async () => {
    const container = await mount([
      row("a1", { sent_at: "2026-10-01T10:00:00.000Z", status: "sent" }),
    ]);

    expect(reviewLinks(container)).toHaveLength(0);
  });
});
