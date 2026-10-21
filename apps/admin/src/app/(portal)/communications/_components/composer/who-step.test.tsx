import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { act, createElement, useState } from "react";
import type { Root } from "react-dom/client";
import type { UserAuthContext } from "@/lib/authorization";
import {
  findButton,
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";
import type { ComposerValues } from "./composer-state";

mock.module("server-only", () => ({}));
const adminCtx: UserAuthContext = {
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
  createAdminClient: mock(async () => ({ db: {}, messaging: {}, users: {} })),
  createSessionClient: mock(async () => ({ db: {} })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => adminCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
}));

const { WhoStep } = await import("./who-step");
const { ReachBox } = await import("./reach-box");
const { GroupPicker } = await import("./group-picker");

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

const baseValues: ComposerValues = {
  audience_type: "topic",
  audience_value: "events",
  body_en: null,
  body_no: null,
  campus_id: "2",
  category: "general",
  content_id: null,
  content_type: null,
  department_id: null,
  event_id: null,
  push: true,
  scheduled_at: null,
  title_en: "Hello",
  title_no: null,
};

async function wait(ms = 450): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function click(element: TestElement): Promise<void> {
  await act(() => {
    element.click();
  });
}

async function mount(node: ReturnType<typeof createElement>) {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(node);
  });
  return container;
}

const getReach = mock(async (_req: unknown) => ({
  count: 412 as number | null,
  sentence: "Bergen students who follow Events.",
}));

/** Holds the values the way the editor does. */
function Harness({
  initial = baseValues,
  isGlobalAdmin,
  managedCampusIds,
  onValues,
  tappingOpens = null,
}: {
  initial?: ComposerValues;
  isGlobalAdmin: boolean;
  managedCampusIds: string[];
  onValues?: (values: ComposerValues) => void;
  tappingOpens?: string | null;
}) {
  const [values, setValues] = useState(initial);
  const apply = (next: ComposerValues) => {
    setValues(next);
    onValues?.(next);
  };
  return createElement(WhoStep, {
    audienceContext: {
      managedCampusIds,
      roles: isGlobalAdmin ? ["globaladmin"] : ["campusadmin"],
    },
    getReach,
    listEvents: async () => [],
    listGroups: async () => [],
    loadDepartments: async () => [],
    lockDepartment: true,
    resolve: async () => [],
    search: async () => [],
    set: (key: keyof ComposerValues, value: unknown) =>
      apply({ ...values, [key]: value } as ComposerValues),
    setAudience: (patch: Partial<ComposerValues>) =>
      apply({ ...values, ...patch }),
    tappingOpens,
    values,
  });
}

function hasButton(container: TestElement, label: string): boolean {
  return (
    findElements(
      container,
      (element) =>
        element.tagName === "BUTTON" && element.textContent.trim() === label
    ).length > 0
  );
}

describe("WhoStep", () => {
  test("a campus admin gets no All campuses pill and sees why", async () => {
    const container = await mount(
      createElement(Harness, {
        isGlobalAdmin: false,
        managedCampusIds: ["2", "3"],
      })
    );
    expect(hasButton(container, "All campuses")).toBe(false);
    expect(hasButton(container, "Bergen")).toBe(true);
    expect(hasButton(container, "Trondheim")).toBe(true);
    expect(hasButton(container, "Oslo")).toBe(false);
    expect(container.textContent).toContain(
      "Only national admins can send to every campus."
    );
  });

  test("a global admin sees All campuses and it clears the campus", async () => {
    const onValues = mock((_values: ComposerValues) => undefined);
    const container = await mount(
      createElement(Harness, {
        isGlobalAdmin: true,
        managedCampusIds: [],
        onValues,
      })
    );
    expect(hasButton(container, "Oslo")).toBe(true);
    await click(findButton(container, "All campuses"));
    expect(onValues.mock.lastCall?.[0].campus_id).toBeNull();
  });

  test("only the selected card shows its controls", async () => {
    const container = await mount(
      createElement(Harness, { isGlobalAdmin: true, managedCampusIds: [] })
    );
    expect(hasButton(container, "News")).toBe(true);
    expect(
      findElements(
        container,
        (element) => element.getAttribute("aria-label") === "Search people"
      )
    ).toHaveLength(0);
  });

  test("choosing Specific people stores ids as the audience", async () => {
    const onValues = mock((_values: ComposerValues) => undefined);
    const container = await mount(
      createElement(Harness, {
        initial: { ...baseValues, audience_type: "broadcast" },
        isGlobalAdmin: false,
        managedCampusIds: ["2"],
        onValues,
      })
    );
    await click(
      findButton(container, "Specific peopleSearch by name or email")
    );
    const last = onValues.mock.lastCall?.[0];
    expect(last?.audience_type).toBe("users");
    expect(last?.campus_id).toBe("2");
  });

  test("shows reach under the choice, with where a tap lands", async () => {
    const container = await mount(
      createElement(Harness, {
        isGlobalAdmin: true,
        managedCampusIds: [],
        tappingOpens: "Autumn party (Fri 24 Oct)",
      })
    );
    await wait();
    expect(container.textContent).toContain("About 412 phones");
    expect(container.textContent).toContain(
      "Bergen students who follow Events."
    );
    expect(container.textContent).toContain(
      "Tapping opens: Autumn party (Fri 24 Oct)"
    );
  });
});

describe("ReachBox", () => {
  test("says reach is unavailable when the count is unknown", async () => {
    const container = await mount(
      createElement(ReachBox, {
        getReach: async () => ({ count: null, sentence: "x" }),
        request: {
          audienceType: "broadcast",
          audienceValue: "",
          campusId: "2",
        },
        tappingOpens: null,
      })
    );
    await wait();
    expect(container.textContent).toContain("Reach unavailable right now");
    expect(container.textContent).not.toContain("Tapping opens");
  });

  test("a people audience shows just the sentence", async () => {
    const container = await mount(
      createElement(ReachBox, {
        getReach: async () => ({ count: 2, sentence: "2 people" }),
        request: {
          audienceType: "users",
          audienceValue: '["a","b"]',
          campusId: "2",
          userIds: ["a", "b"],
        },
        tappingOpens: null,
      })
    );
    await wait();
    expect(container.textContent).toContain("2 people");
    expect(container.textContent).not.toContain("phones");
  });
});

describe("GroupPicker", () => {
  const event = {
    campusName: "Trondheim",
    dateLabel: "Sat 1 Nov",
    id: "ev-1",
    title: "Trondheim trip",
  };

  test("lists groups only after an event is chosen", async () => {
    const listGroups = mock(async (_eventId: string) => [
      { campusId: null, id: "g1", memberCount: 34, name: "Bus 2" },
    ]);
    const onChange = mock(
      (_id: string | null, _campus: string | null) => undefined
    );
    const container = await mount(
      createElement(GroupPicker, {
        listEvents: async () => [event],
        listGroups,
        onChange,
        value: null,
      })
    );
    expect(listGroups).not.toHaveBeenCalled();
    expect(findElements(container, (e) => e.tagName === "SELECT")).toHaveLength(
      0
    );

    await click(findButton(container, "Choose event…"));
    await wait();
    const rows = findElements(
      container,
      (element) => element.getAttribute("role") === "option"
    );
    await click(rows[0] as TestElement);
    await wait(0);

    expect(listGroups).toHaveBeenCalledWith("ev-1");
    expect(container.textContent).toContain("Bus 2 (34 people)");
    const select = findElements(
      container,
      (e) => e.tagName === "SELECT"
    )[0] as TestElement;
    await act(() => {
      select.value = "g1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // The group has no campus of its own, so the event's campus is used.
    expect(onChange).toHaveBeenLastCalledWith("g1", "3");
  });
});
