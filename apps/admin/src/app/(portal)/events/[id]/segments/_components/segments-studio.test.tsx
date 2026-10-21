import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { act, createElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import type { UserAuthContext } from "@/lib/authorization";
import {
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";
import type { SegmentWithCount } from "./types";

// The studio imports the real segment actions; what they reach is stubbed the
// way the `_actions` suites stub it, since `mock.module` is process-wide.
mock.module("server-only", () => ({}));
const ctx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: {}, messaging: {}, users: {} })),
  createSessionClient: mock(async () => ({ db: {} })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ctx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
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
  usePathname: () => "/events/e1/segments",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(""),
}));

const { SegmentsStudio } = await import("./segments-studio");

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

const bus = {
  $id: "s1",
  campus_id: "2",
  capacity: 50,
  event_id: "e1",
  kind: "transport",
  member_count: 12,
  metadata: null,
  name: "Bus 2",
} as unknown as SegmentWithCount;

async function mount(canMessage: boolean): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(
      createElement(SegmentsStudio, {
        attendees: [],
        campusId: "2",
        canMessage,
        eventId: "e1",
        eventTitle: "Trondheim trip",
        segments: [bus],
      })
    );
  });
  return container;
}

function messageLinks(container: TestElement): TestElement[] {
  return findElements(
    container,
    (element) =>
      element.tagName === "A" && element.textContent.trim() === "Message"
  );
}

describe("messaging a segment", () => {
  test("campus and national admins get a link into the composer", async () => {
    const container = await mount(true);
    const links = messageLinks(container);
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/communications/new?group=s1");
  });

  test("department members cannot", async () => {
    const container = await mount(false);
    expect(messageLinks(container)).toHaveLength(0);
    expect(container.textContent).toContain("Bus 2");
  });
});
