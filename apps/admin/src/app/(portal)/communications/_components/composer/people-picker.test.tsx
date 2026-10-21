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
import type { PersonResult } from "@/lib/announcements/composer-lookups";
import type { UserAuthContext } from "@/lib/authorization";
import {
  findByAriaLabel,
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";

// The picker's default `search` and `resolve` are server actions; their import
// chain needs the same stubs the other composer suites use.
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

const { PeoplePicker } = await import("./people-picker");

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

const kari: PersonResult = {
  campusName: "Bergen",
  email: "kari@biso.no",
  id: "u1",
  name: "Kari Nordmann",
};
const ola: PersonResult = {
  campusName: "Oslo",
  email: "ola@biso.no",
  id: "u2",
  name: "Ola Hansen",
};

async function wait(ms = 400): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function type(input: TestElement, value: string): Promise<void> {
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function options(container: TestElement): TestElement[] {
  return findElements(
    container,
    (element) => element.getAttribute("role") === "option"
  );
}

/** Holds the id list the way the editor does. */
function Harness({
  initial,
  onValue,
  resolve,
  search,
}: {
  initial: string[];
  onValue: (value: string[]) => void;
  resolve: (ids: string[]) => Promise<PersonResult[]>;
  search: (query: string) => Promise<PersonResult[]>;
}) {
  const [value, setValue] = useState(initial);
  return createElement(PeoplePicker, {
    onChange: (next: string[]) => {
      setValue(next);
      onValue(next);
    },
    resolve,
    search,
    value,
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

describe("PeoplePicker", () => {
  test("searches after two characters and shows name, email and campus", async () => {
    const search = mock(async (_query: string) => [kari, ola]);
    const container = await mount(
      createElement(Harness, {
        initial: [],
        onValue: () => undefined,
        resolve: async () => [],
        search,
      })
    );
    const input = findByAriaLabel(container, "Search people");
    await type(input, "k");
    await wait();
    expect(search).not.toHaveBeenCalled();

    await type(input, "ka");
    await wait();
    expect(search).toHaveBeenCalledWith("ka");
    const rows = options(container);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Kari Nordmann");
    expect(rows[0]?.textContent).toContain("kari@biso.no");
    expect(rows[0]?.textContent).toContain("Bergen");
  });

  test("picking a result adds a chip and stores the id", async () => {
    const onValue = mock((_value: string[]) => undefined);
    const container = await mount(
      createElement(Harness, {
        initial: [],
        onValue,
        resolve: async () => [],
        search: async () => [kari, ola],
      })
    );
    await type(findByAriaLabel(container, "Search people"), "ka");
    await wait();
    const first = options(container)[0] as TestElement;
    await act(() => {
      first.click();
    });
    expect(onValue).toHaveBeenLastCalledWith(["u1"]);
    expect(findByAriaLabel(container, "Remove Kari Nordmann")).toBeTruthy();
  });

  test("removing a chip updates the stored ids", async () => {
    const onValue = mock((_value: string[]) => undefined);
    const container = await mount(
      createElement(Harness, {
        initial: ["u1", "u2"],
        onValue,
        resolve: async () => [kari, ola],
        search: async () => [],
      })
    );
    await wait(0);
    await act(() => {
      findByAriaLabel(container, "Remove Kari Nordmann").click();
    });
    expect(onValue).toHaveBeenLastCalledWith(["u2"]);
    expect(container.textContent).toContain("Ola Hansen");
    expect(container.textContent).not.toContain("Kari Nordmann");
  });

  test("reopened ids resolve to names", async () => {
    const resolve = mock(async (_ids: string[]) => [kari, ola]);
    const container = await mount(
      createElement(Harness, {
        initial: ["u1", "u2"],
        onValue: () => undefined,
        resolve,
        search: async () => [],
      })
    );
    await wait(0);
    expect(resolve).toHaveBeenCalledWith(["u1", "u2"]);
    expect(container.textContent).toContain("Kari Nordmann");
    expect(container.textContent).toContain("Ola Hansen");
  });

  test("an id that never resolves becomes Unknown person", async () => {
    const container = await mount(
      createElement(Harness, {
        initial: ["gone"],
        onValue: () => undefined,
        resolve: async () => [],
        search: async () => [],
      })
    );
    await wait(0);
    expect(findByAriaLabel(container, "Remove Unknown person")).toBeTruthy();
    expect(container.textContent).not.toContain("Loading");
  });
});
