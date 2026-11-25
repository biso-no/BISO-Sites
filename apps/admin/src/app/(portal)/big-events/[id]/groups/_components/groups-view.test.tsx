import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { loadMessages } from "@repo/i18n/messages";
import type { BigEventGroupRow } from "@repo/shared/big-events/types";
import { IntlMessageFormat } from "intl-messageformat";
import {
  act,
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from "react";
import type { Root } from "react-dom/client";
import { bus, room } from "@/lib/big-events/buses/test-rows";
import {
  findButton,
  findByAriaLabel,
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";
import type {
  GroupMemberView,
  GroupsView,
  GroupView,
} from "../../../../_actions/big-event-groups";

// Real English messages through the ICU formatter next-intl uses, so a
// missing key or a broken plural fails here.
const messages = await loadMessages("en");

function translator(namespace: string) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const path = [...namespace.split("."), ...key.split(".")];
    let node: unknown = messages;
    for (const part of path) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (typeof node !== "string") {
      throw new Error(`Missing message: ${path.join(".")}`);
    }
    return String(new IntlMessageFormat(node, "en").format(values));
  };
}

mock.module("server-only", () => ({}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: {}, users: {} })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ({})),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  revalidateTag: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
}));
// `mock.module` is process-wide: shared modules keep their other exports.
const actualNavigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...actualNavigation,
  useRouter: () => ({ refresh: mock(() => undefined) }),
}));
const toast = {
  error: mock((_message: string) => undefined),
  info: mock((_message: string) => undefined),
  success: mock((_message: string) => undefined),
  warning: mock((_message: string) => undefined),
};
const actualSonner = await import("sonner");
mock.module("sonner", () => ({ ...actualSonner, toast }));
const actualIntl = await import("next-intl");
mock.module("next-intl", () => ({
  ...actualIntl,
  useLocale: () => "en",
  useTranslations: translator,
}));

// Radix dialogs portal into `document.body` and lean on browser APIs this
// harness lacks, so both dialogs render inline here: content only while
// open, Cancel closes it.
type Slot = { children?: ReactNode } & Record<string, unknown>;
interface DialogState {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}
const DialogOpen = createContext<DialogState>({
  onOpenChange: () => undefined,
  open: false,
});
const passThrough =
  (tag: string) =>
  ({ children }: Slot) =>
    createElement(tag, {}, children);
const dialogRoot = ({ children, onOpenChange, open }: Slot) =>
  createElement(
    DialogOpen.Provider,
    {
      value: {
        onOpenChange:
          (onOpenChange as DialogState["onOpenChange"]) ?? (() => undefined),
        open: Boolean(open),
      },
    },
    children
  );
const dialogContent =
  (role: string) =>
  ({ children }: Slot) =>
    useContext(DialogOpen).open
      ? createElement("div", { role }, children)
      : null;
const actualAlertDialog = await import("@repo/ui/components/ui/alert-dialog");
mock.module("@repo/ui/components/ui/alert-dialog", () => ({
  ...actualAlertDialog,
  AlertDialog: dialogRoot,
  AlertDialogAction: ({ children, disabled, onClick }: Slot) =>
    createElement("button", { disabled, onClick, type: "button" }, children),
  AlertDialogCancel({ children, disabled }: Slot) {
    const { onOpenChange } = useContext(DialogOpen);
    return createElement(
      "button",
      { disabled, onClick: () => onOpenChange(false), type: "button" },
      children
    );
  },
  AlertDialogContent: dialogContent("alertdialog"),
  AlertDialogDescription: passThrough("p"),
  AlertDialogFooter: passThrough("div"),
  AlertDialogHeader: passThrough("div"),
  AlertDialogTitle: passThrough("h2"),
  AlertDialogTrigger: ({ children }: Slot) => children,
}));
const actualDialog = await import("@repo/ui/components/ui/dialog");
mock.module("@repo/ui/components/ui/dialog", () => ({
  ...actualDialog,
  Dialog: dialogRoot,
  DialogContent: dialogContent("dialog"),
  DialogDescription: passThrough("p"),
  DialogFooter: passThrough("div"),
  DialogHeader: passThrough("div"),
  DialogTitle: passThrough("h2"),
}));

// The server actions are replaced on their module, so the components' own
// imports see the stand-ins; restored after the suite.
const groupActions = await import("../../../../_actions/big-event-groups");
const createGroup = spyOn(groupActions, "createGroup").mockImplementation(
  async () => ({ id: "new" })
);
const deleteGroup = spyOn(groupActions, "deleteGroup").mockImplementation(
  async () => undefined
);
afterAll(() => {
  createGroup.mockRestore();
  deleteGroup.mockRestore();
});

const { GroupsTab } = await import("./groups-view");
const { moveTargets } = await import("./move-menu");

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
beforeEach(() => {
  createGroup.mockClear();
  deleteGroup.mockClear();
  for (const fn of Object.values(toast)) {
    fn.mockClear();
  }
});

function person(
  participantId: string,
  name: string,
  overrides: Partial<GroupMemberView> = {}
): GroupMemberView {
  return {
    campusId: "2",
    leg: null,
    name,
    participantId,
    pinned: false,
    roomName: null,
    ...overrides,
  };
}

function view(
  row: BigEventGroupRow,
  overrides: Partial<GroupView> = {}
): GroupView {
  return { ...row, members: [], openPlaces: null, seats: null, ...overrides };
}

const bergenRoom = view(
  room("room-1", 4, {
    campus_id: "2",
    name: "Ola Nordmann",
    room_number: "214",
  }),
  {
    // One more person is in it whom this caller can't see.
    members: [person("p1", "Ola Nordmann"), person("p2", "Kari Nordmann")],
    openPlaces: 1,
  }
);
const bergenBus = view(bus("bus-1", 50, "2"), {
  members: [
    person("p1", "Ola Nordmann", { leg: "out" }),
    person("p1", "Ola Nordmann", { leg: "home" }),
    person("p3", "Per Hansen", { leg: "out" }),
  ],
  seats: { home: 1, out: 2 },
});

function groupsView(overrides: Partial<GroupsView> = {}): GroupsView {
  return {
    campuses: ["2"],
    canPublish: true,
    groups: [bergenBus, bergenRoom],
    manageableCampuses: ["2"],
    publishedAt: null,
    travel: true,
    ...overrides,
  };
}

async function mount(
  shown: GroupsView = groupsView(),
  eventCampusId = "2"
): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root?.render(
      createElement(GroupsTab, {
        allowsNoCampus: false,
        bigEventId: "b1",
        eventCampusId,
        view: shown,
      })
    );
    await Promise.resolve();
  });
  return container as unknown as TestElement;
}

async function click(element: TestElement): Promise<void> {
  await act(async () => {
    element.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function type(element: TestElement, text: string): Promise<void> {
  await act(() => {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The harness has no implicit submission, so the form gets the event itself. */
async function submit(dialog: TestElement): Promise<void> {
  const [form] = findElements(dialog, (element) => element.tagName === "FORM");
  await act(async () => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function choose(select: TestElement, value: string): Promise<void> {
  await act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function byRole(container: TestElement, role: string): TestElement | undefined {
  return findElements(
    container,
    (element) => element.getAttribute("role") === role
  )[0];
}

function headings(container: TestElement): string[] {
  return findElements(container, (element) => element.tagName === "H2").map(
    (element) => element.textContent
  );
}

function optionLabels(select: TestElement): string[] {
  return select.options.map((option) => option.textContent);
}

describe("GroupsTab", () => {
  test("shows a section per kind, with Buses only while Travel is on", async () => {
    let container = await mount();
    expect(headings(container)).toEqual([
      "Buses",
      "Rooms",
      "Buddy groups",
      "Teams",
      "Other",
    ]);
    await act(async () => root?.unmount());
    root = null;

    container = await mount(
      groupsView({ groups: [bergenRoom], travel: false })
    );
    expect(headings(container)).toEqual([
      "Rooms",
      "Buddy groups",
      "Teams",
      "Other",
    ]);
    expect(container.textContent).not.toContain("Add bus");
  });

  test("a room shows its places taken, open places, room number and people", async () => {
    const text = (await mount()).textContent;
    // Three of four are taken although only two people are visible.
    expect(text).toContain("3 of 4");
    expect(text).toContain("1 open place");
    expect(text).toContain("Room 214");
    expect(text).toContain("Kari Nordmann");
    expect(text).toContain("Bergen");
  });

  test("the bus list shows seats per leg and each person once", async () => {
    const container = await mount();
    expect(container.textContent).toContain("Out 2 of 50 · Home 1 of 50");
    expect(container.textContent).toContain("Only out");
    const perNames = findElements(
      container,
      (element) =>
        element.tagName === "LI" && element.textContent.includes("Ola Nordmann")
    );
    // Once on the bus (both legs) and once in the room.
    expect(perNames).toHaveLength(2);
  });

  test("the dialog shows the out and home legs only for a bus", async () => {
    const container = await mount();
    await click(findButton(container, "Add room"));
    let dialog = byRole(container, "dialog") as TestElement;
    expect(dialog.textContent).toContain("Room number");
    expect(dialog.textContent).not.toContain("Meeting point");
    expect(dialog.textContent).not.toContain("Arrives around");

    await choose(findByAriaLabel(dialog, "Type"), "bus");
    dialog = byRole(container, "dialog") as TestElement;
    expect(dialog.textContent).toContain("Out");
    expect(dialog.textContent).toContain("Home");
    expect(dialog.textContent).toContain("Meeting point");
    expect(dialog.textContent).toContain("Arrives around");
    expect(dialog.textContent).not.toContain("Room number");
  });

  test("a new bus saves its departure as an instant from the Oslo date and time", async () => {
    const container = await mount();
    await click(findButton(container, "Add bus"));
    const dialog = byRole(container, "dialog") as TestElement;
    await type(findByAriaLabel(dialog, "Name"), "Bus 1");
    await type(findByAriaLabel(dialog, "Out · Leaves: date"), "2027-01-24");
    await type(findByAriaLabel(dialog, "Out · Leaves: time"), "08:30");
    await type(findByAriaLabel(dialog, "Seats"), "50");
    await submit(dialog);

    expect(createGroup).toHaveBeenCalledTimes(1);
    expect(createGroup.mock.calls[0]?.[0]).toBe("b1");
    expect(createGroup.mock.calls[0]?.[1]).toMatchObject({
      campus_id: "2",
      capacity: 50,
      home_departs_at: "",
      kind: "bus",
      name: "Bus 1",
      out_departs_at: "2027-01-24T07:30:00.000Z",
    });
    expect(toast.success).toHaveBeenCalledWith("Bus 1 was added");
  });

  test("a date without a time is refused before saving", async () => {
    const container = await mount();
    await click(findButton(container, "Add bus"));
    const dialog = byRole(container, "dialog") as TestElement;
    await type(findByAriaLabel(dialog, "Name"), "Bus 1");
    await type(findByAriaLabel(dialog, "Home · Leaves: date"), "2027-01-27");
    await submit(dialog);

    expect(createGroup).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain("Choose both a date and a time.");
  });

  test("buses can't be on National; other groups start on it on a National big event", async () => {
    const national = groupsView({
      manageableCampuses: ["1", "2", "3", "4", "5"],
    });
    const container = await mount(national, "5");
    await click(findButton(container, "Add bus"));
    let campus = findByAriaLabel(
      byRole(container, "dialog") as TestElement,
      "Campus"
    );
    expect(optionLabels(campus)).toEqual([
      "Oslo",
      "Bergen",
      "Trondheim",
      "Stavanger",
    ]);
    await click(
      findButton(byRole(container, "dialog") as TestElement, "Cancel")
    );

    await click(findButton(container, "Add room"));
    const dialog = byRole(container, "dialog") as TestElement;
    campus = findByAriaLabel(dialog, "Campus");
    expect(optionLabels(campus)).toContain("National");
    await type(findByAriaLabel(dialog, "Name"), "Kari Nordmann");
    await submit(dialog);
    expect(createGroup.mock.calls[0]?.[1]).toMatchObject({
      campus_id: "5",
      kind: "room",
    });
  });

  test("deleting a group asks first", async () => {
    const container = await mount();
    await click(findByAriaLabel(container, "Delete Ola Nordmann"));

    expect(deleteGroup).not.toHaveBeenCalled();
    const dialog = byRole(container, "alertdialog") as TestElement;
    expect(dialog.textContent).toContain("Delete Ola Nordmann?");
    expect(dialog.textContent).toContain("Everyone in it is taken out of it.");
    await click(findButton(dialog, "Delete"));
    expect(deleteGroup).toHaveBeenCalledWith("room-1");
  });

  test("after publishing, a bus with people on it can't be deleted", async () => {
    const container = await mount(
      groupsView({ canPublish: false, publishedAt: "2026-12-01T10:00:00.000Z" })
    );
    await click(findByAriaLabel(container, "Delete bus-1"));
    const dialog = byRole(container, "alertdialog") as TestElement;
    expect(dialog.textContent).toContain("Move the people off this bus first.");
    expect(findButton(dialog, "Delete").hasAttribute("disabled")).toBe(true);
  });
});

describe("moveTargets", () => {
  const roomOslo = view(
    room("r-oslo", 2, { campus_id: "1", name: "Oslo room" })
  );
  const roomNone = view(room("r-none", 2, { campus_id: null, name: "Anyone" }));
  const roomNational = view(
    room("r-nat", 2, { campus_id: "5", name: "National room" })
  );
  const buddy = view(room("b-1", null, { campus_id: "2", kind: "buddy" }));
  const rooms = [bergenRoom, roomOslo, roomNone, roomNational, buddy];
  const other = view(
    room("room-2", 4, { campus_id: "2", name: "Kari Hansen" })
  );

  test("offers other groups of the same kind on the person's campus, plus campus-wide ones", () => {
    const targets = moveTargets(
      [...rooms, other],
      bergenRoom,
      person("p1", "Ola")
    );
    expect(targets.map((group) => group.$id)).toEqual([
      "r-none",
      "r-nat",
      "room-2",
    ]);
  });

  test("a person with no campus is offered only campus-wide groups", () => {
    const targets = moveTargets(
      [...rooms, other],
      roomNone,
      person("p9", "Nils", { campusId: null })
    );
    expect(targets.map((group) => group.$id)).toEqual(["r-nat"]);
  });
});
