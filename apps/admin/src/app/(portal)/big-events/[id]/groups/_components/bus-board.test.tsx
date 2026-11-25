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
  cloneElement,
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useState,
} from "react";
import type { Root } from "react-dom/client";
import type { AutoFillPreview } from "@/lib/big-events/buses/fill-run";
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
// harness lacks, so they render inline here: content only while open,
// Cancel closes it.
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

// Radix menus measure the page to place themselves, which this harness
// can't: a stand-in that is closed until its trigger is clicked, like the
// real one, and whose items are buttons.
interface MenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const MenuOpen = createContext<MenuState>({
  open: false,
  setOpen: () => undefined,
});
const actualMenu = await import("@repo/ui/components/ui/dropdown-menu");
mock.module("@repo/ui/components/ui/dropdown-menu", () => ({
  ...actualMenu,
  DropdownMenu({ children }: Slot) {
    const [open, setOpen] = useState(false);
    return createElement(
      MenuOpen.Provider,
      { value: { open, setOpen } },
      children
    );
  },
  DropdownMenuContent: ({ children }: Slot) =>
    useContext(MenuOpen).open
      ? createElement("div", { role: "menu" }, children)
      : null,
  DropdownMenuItem({ children, disabled, onSelect }: Slot) {
    const { setOpen } = useContext(MenuOpen);
    return createElement(
      "button",
      {
        disabled,
        onClick: () => {
          setOpen(false);
          (onSelect as (() => void) | undefined)?.();
        },
        role: "menuitem",
        type: "button",
      },
      children
    );
  },
  DropdownMenuLabel: passThrough("div"),
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger({ children }: Slot) {
    const { open, setOpen } = useContext(MenuOpen);
    return cloneElement(children as ReactElement<{ onClick: () => void }>, {
      onClick: () => setOpen(!open),
    });
  },
}));

// The server actions are replaced on their module, so the components' own
// imports see the stand-ins; restored after the suite.
const groupActions = await import("../../../../_actions/big-event-groups");
const deleteGroup = spyOn(groupActions, "deleteGroup").mockImplementation(
  async () => undefined
);
const busActions = await import("../../../../_actions/big-event-buses");
const emptyPreview: AutoFillPreview = {
  missingCapacity: [],
  perBus: [],
  placed: 0,
  unplaced: [],
};
const moveToBus = spyOn(busActions, "moveToBus").mockImplementation(
  async () => ({ moved: 1 })
);
const setPinned = spyOn(busActions, "setPinned").mockImplementation(
  async () => undefined
);
const previewAutoFill = spyOn(busActions, "previewAutoFill").mockImplementation(
  async () => emptyPreview
);
const applyAutoFill = spyOn(busActions, "applyAutoFill").mockImplementation(
  async () => ({ moved: 3, unplaced: 0 })
);
const publishBusLists = spyOn(busActions, "publishBusLists").mockImplementation(
  async () => ({ notices: 142 })
);
const moveToGroup = spyOn(busActions, "moveToGroup").mockImplementation(
  async () => ({ moved: 1 })
);
const spies = [
  deleteGroup,
  moveToBus,
  moveToGroup,
  setPinned,
  previewAutoFill,
  applyAutoFill,
  publishBusLists,
];
afterAll(() => {
  for (const spy of spies) {
    spy.mockRestore();
  }
});

const { GroupsTab } = await import("./groups-view");
const { BusBoard } = await import("./bus-board");
const { MoveConfirmProvider, useMoveConfirm } = await import("./move-confirm");

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
  for (const spy of spies) {
    spy.mockClear();
  }
  for (const fn of Object.values(toast)) {
    fn.mockClear();
  }
});

function seat(
  participantId: string,
  name: string,
  leg: "out" | "home",
  overrides: Partial<GroupMemberView> = {}
): GroupMemberView {
  return {
    campusId: "2",
    leg,
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
  return {
    ...row,
    members: [],
    openPlaces: null,
    riders: null,
    seats: null,
    ...overrides,
  };
}

const bus1 = view(
  {
    ...bus("bus-1", 50, "2"),
    name: "Bus 1",
    out_departs_at: "2027-01-24T07:30:00.000Z",
    out_meeting_point: "Main entrance",
  },
  {
    members: [
      seat("p1", "Ola Nordmann", "out", { pinned: true }),
      seat("p1", "Ola Nordmann", "home", { pinned: true }),
    ],
    riders: { home: 37, out: 38 },
    seats: { home: 37, out: 38 },
  }
);
// Three people on two seats out: some the caller can't see.
const bus2 = view(
  { ...bus("bus-2", 2, "2"), name: "Bus 2" },
  {
    members: [seat("p2", "Kari Nordmann", "out")],
    riders: { home: 0, out: 3 },
    seats: { home: 0, out: 3 },
  }
);
const bigRoom = view(
  room("room-1", 4, { campus_id: "2", name: "Ola Nordmann" }),
  { openPlaces: 3 }
);

function groupsView(overrides: Partial<GroupsView> = {}): GroupsView {
  return {
    campuses: ["2"],
    canPublish: true,
    groups: [bus1, bus2, bigRoom],
    manageableCampuses: ["2"],
    outRiders: 142,
    publishedAt: null,
    travel: true,
    unseated: [
      {
        campusId: "2",
        name: "Per Hansen",
        participantId: "p3",
        roomName: null,
      },
    ],
    ...overrides,
  };
}

const PUBLISHED = {
  canPublish: false,
  publishedAt: "2026-12-01T10:00:00.000Z",
};

async function mount(shown: GroupsView = groupsView()): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root?.render(
      createElement(GroupsTab, {
        allowsNoCampus: false,
        bigEventId: "b1",
        busBoard: createElement(BusBoard),
        eventCampusId: "2",
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

async function choose(select: TestElement, value: string): Promise<void> {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function submit(dialog: TestElement): Promise<void> {
  const [form] = findElements(dialog, (element) => element.tagName === "FORM");
  await act(async () => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function byRole(container: TestElement, role: string): TestElement {
  const found = findElements(
    container,
    (element) => element.getAttribute("role") === role
  )[0];
  if (!found) {
    throw new Error(`No ${role}`);
  }
  return found;
}

function column(container: TestElement, id: string): TestElement {
  const found = findElements(
    container,
    (element) => element.getAttribute("data-column") === id
  )[0];
  if (!found) {
    throw new Error(`No column ${id}`);
  }
  return found;
}

function checkbox(container: TestElement): TestElement {
  const found = findElements(
    container,
    (element) => element.tagName === "INPUT" && element.type === "checkbox"
  )[0];
  if (!found) {
    throw new Error("No checkbox");
  }
  return found;
}

describe("BusBoard", () => {
  test("a column per bus with seat counters, after the people with no bus", async () => {
    const container = await mount();
    const columns = findElements(container, (element) =>
      element.hasAttribute("data-column")
    ).map((element) => element.getAttribute("aria-label"));
    expect(columns).toEqual(["Not on a bus yet (1)", "Bus 1", "Bus 2"]);

    const first = column(container, "bus-1");
    expect(first.textContent).toContain("Out 38/50 · Home 37/50");
    expect(first.textContent).toContain("Leaves 24 Jan 08:30 · Main entrance");
    expect(first.textContent).toContain("Ola Nordmann");
    expect(column(container, "no-bus").textContent).toContain("Per Hansen");
  });

  test("an overfull bus is marked amber but still takes people", async () => {
    const container = await mount();
    const full = column(container, "bus-2");
    expect(full.textContent).toContain("Out 3/2 · Home 0/2");
    expect(full.textContent).toContain("More people than seats");
    expect(column(container, "bus-1").textContent).not.toContain(
      "More people than seats"
    );

    await click(findByAriaLabel(container, "Select Per Hansen"));
    // Per has no bus to be taken off.
    expect(
      findButton(container, "Take off the bus").hasAttribute("disabled")
    ).toBe(true);
    await click(findButton(container, "Move to…"));
    const dialog = byRole(container, "dialog");
    await choose(findByAriaLabel(dialog, "Bus"), "bus-2");
    await submit(dialog);
    expect(moveToBus).toHaveBeenCalledWith("b1", {
      busId: "bus-2",
      legs: "both",
      notify: false,
      participantIds: ["p3"],
    });
  });

  test("Move to… moves the selection on the legs chosen", async () => {
    const container = await mount();
    await click(findByAriaLabel(container, "Select Ola Nordmann"));
    await click(findByAriaLabel(container, "Select Kari Nordmann"));
    expect(container.textContent).toContain("2 people selected");
    await click(findButton(container, "Move to…"));
    const dialog = byRole(container, "dialog");
    expect(dialog.textContent).toContain("Move 2 people");
    await choose(findByAriaLabel(dialog, "Bus"), "bus-2");
    await choose(findByAriaLabel(dialog, "Which way"), "home");
    await submit(dialog);

    expect(moveToBus).toHaveBeenCalledTimes(1);
    expect(moveToBus.mock.calls[0]?.[1]).toMatchObject({
      busId: "bus-2",
      legs: "home",
      participantIds: ["p1", "p2"],
    });
    expect(toast.success).toHaveBeenCalledWith("2 people are now on Bus 2");
    // The selection is cleared after the move.
    expect(container.textContent).not.toContain("selected");
  });

  test("before publishing, taking someone off the bus doesn't ask", async () => {
    const container = await mount();
    await click(findByAriaLabel(container, "Select Kari Nordmann"));
    await click(findButton(container, "Take off the bus"));
    expect(moveToBus).toHaveBeenCalledWith("b1", {
      busId: null,
      legs: "both",
      notify: false,
      participantIds: ["p2"],
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Kari Nordmann was taken off the bus"
    );
  });

  test("after publishing, a move asks about telling the person, ticked by default", async () => {
    const container = await mount(groupsView(PUBLISHED));
    await click(findByAriaLabel(container, "Select Kari Nordmann"));
    await click(findButton(container, "Take off the bus"));

    expect(moveToBus).not.toHaveBeenCalled();
    const confirm = byRole(container, "alertdialog");
    expect(confirm.textContent).toContain("Move Kari Nordmann?");
    expect(confirm.textContent).toContain(
      "Tell Kari Nordmann about the change"
    );
    expect(checkbox(confirm).checked).toBe(true);
    await click(findButton(confirm, "Move"));
    expect(moveToBus.mock.calls[0]?.[1]).toMatchObject({
      busId: null,
      notify: true,
    });
  });

  test("after publishing, Move to… carries the box and can leave it unticked", async () => {
    const container = await mount(groupsView(PUBLISHED));
    await click(findByAriaLabel(container, "Select Ola Nordmann"));
    await click(findButton(container, "Move to…"));
    const dialog = byRole(container, "dialog");
    const box = checkbox(dialog);
    expect(box.checked).toBe(true);
    expect(dialog.textContent).toContain("Tell Ola Nordmann about the change");
    await click(box);
    await submit(dialog);
    expect(moveToBus.mock.calls[0]?.[1]).toMatchObject({
      busId: "bus-1",
      legs: "both",
      notify: false,
    });
  });

  test("a pinned person can be unpinned", async () => {
    const container = await mount();
    await click(findByAriaLabel(container, "Unpin Ola Nordmann"));
    expect(setPinned).toHaveBeenCalledWith("b1", {
      participantIds: ["p1"],
      pinned: false,
    });
    expect(
      findElements(
        container,
        (element) =>
          element.getAttribute("aria-label") === "Unpin Kari Nordmann"
      )
    ).toHaveLength(0);
  });

  test("the fill dialog shows the plan and why people have no seat", async () => {
    previewAutoFill.mockImplementationOnce(async () => ({
      missingCapacity: [],
      perBus: [
        { busId: "bus-1", campusId: "2", capacity: 50, name: "Bus 1", out: 50 },
        { busId: "bus-2", campusId: "2", capacity: 2, name: "Bus 2", out: 2 },
        { busId: "bus-3", campusId: "2", capacity: 90, name: "Bus 3", out: 90 },
      ],
      placed: 142,
      unplaced: [
        // Ten names is all the preview gives: two rooms and eight people.
        {
          count: 12,
          names: [
            "Room · Ola Nordmann",
            "Room · Kari Nordmann",
            "Anne B.",
            "Bo L.",
            "Eva S.",
            "Ida L.",
            "Kari N.",
            "Nils H.",
            "Oda L.",
            "Per H.",
          ],
          reason: "no_seat",
        },
        { count: 4, names: ["Room · Ola Nordmann"], reason: "too_big" },
        { count: 2, names: ["Room · Kari Nordmann"], reason: "split_room" },
      ],
    }));
    const container = await mount();
    await click(findButton(container, "Fill buses automatically"));
    const dialog = byRole(container, "dialog");

    expect(previewAutoFill).toHaveBeenCalledWith("b1", "2");
    // Ruling R21: taking someone off a bus doesn't keep them off it.
    expect(dialog.textContent).toContain(
      "People you take off a bus get a seat again the next time you fill."
    );
    expect(dialog.textContent).toContain("142 people on 3 buses");
    expect(dialog.textContent).toContain("50 of 50");
    // A room stands for the people named in it (at least one): both rooms
    // here show nobody, so the ten names cover ten of twelve.
    expect(dialog.textContent).toContain(
      "12 people have no seat. Add a bus. Including: Room · Ola Nordmann, Room · Kari Nordmann, Anne B., Bo L., Eva S., Ida L., Kari N., Nils H., Oda L., Per H. and 2 more"
    );
    expect(dialog.textContent).toContain(
      "Room · Ola Nordmann needs 4 seats; no bus has that many."
    );
    expect(dialog.textContent).toContain(
      "Room · Kari Nordmann is split across buses."
    );
    expect(dialog.textContent).not.toContain("only gives a seat");

    await click(findButton(dialog, "Fill the buses"));
    expect(applyAutoFill).toHaveBeenCalledWith("b1", "2");
    expect(toast.success).toHaveBeenCalledWith("3 people got a seat");
  });

  test("the fill dialog refuses buses without a seat count and says what publishing changes", async () => {
    previewAutoFill.mockImplementationOnce(async () => ({
      ...emptyPreview,
      missingCapacity: ["Bus 1", "Bus 2"],
      // Under ten names the list is whole, even if a room holds two people.
      unplaced: [{ count: 3, names: ["Kari N.", "Per H."], reason: "no_seat" }],
      perBus: [
        {
          busId: "bus-1",
          campusId: "2",
          capacity: null,
          name: "Bus 1",
          out: 0,
        },
        {
          busId: "bus-2",
          campusId: "2",
          capacity: null,
          name: "Bus 2",
          out: 0,
        },
      ],
    }));
    const container = await mount(
      groupsView({ ...PUBLISHED, manageableCampuses: ["1", "2"] })
    );
    await click(findButton(container, "Fill buses automatically"));
    const dialog = byRole(container, "dialog");
    expect(dialog.textContent).toContain(
      "Add a seat count to Bus 1 and Bus 2 first."
    );
    expect(dialog.textContent).toContain(
      "3 people have no seat. Add a bus. Including: Kari N., Per H."
    );
    expect(dialog.textContent).not.toContain("more");
    expect(dialog.textContent).toContain(
      "The bus lists are published, so this only gives a seat to people without a bus."
    );
    expect(findButton(dialog, "Fill the buses").hasAttribute("disabled")).toBe(
      true
    );

    await choose(findByAriaLabel(dialog, "Which campus"), "all");
    expect(previewAutoFill).toHaveBeenLastCalledWith("b1", "all");
  });

  test("publishing says how many people get a message", async () => {
    const container = await mount();
    await click(findButton(container, "Publish bus lists"));
    const dialog = byRole(container, "alertdialog");
    expect(dialog.textContent).toContain("Publish the bus lists?");
    expect(dialog.textContent).toContain(
      "142 people will get a message saying which bus they're on. You can still move people afterwards."
    );
    await click(findButton(dialog, "Publish"));
    expect(publishBusLists).toHaveBeenCalledWith("b1");
  });

  test("once published, a pill with the date replaces the button", async () => {
    const container = await mount(groupsView(PUBLISHED));
    expect(container.textContent).toContain("Published 1 Dec");
    expect(container.textContent).not.toContain("Publish bus lists");
  });

  test("an emptied published bus can be deleted even if a room still points at it", async () => {
    // The room's open places still hold seats on it, but nobody rides it.
    const emptied = view(
      { ...bus("bus-9", 50, "2"), name: "Bus 9" },
      { riders: { home: 0, out: 0 }, seats: { home: 4, out: 4 } }
    );
    const container = await mount(
      groupsView({ ...PUBLISHED, groups: [bus1, emptied] })
    );
    await click(findByAriaLabel(container, "Delete Bus 9"));
    const dialog = byRole(container, "alertdialog");
    expect(dialog.textContent).toContain("Everyone in it is taken out of it.");
    await click(findButton(dialog, "Delete"));
    expect(deleteGroup).toHaveBeenCalledWith("bus-9");
  });

  test("after publishing, a bus with people the caller can't see can't be deleted", async () => {
    const hidden = view(
      { ...bus("bus-9", 50, "2"), name: "Bus 9" },
      { riders: { home: 1, out: 1 }, seats: { home: 1, out: 1 } }
    );
    const container = await mount(
      groupsView({ ...PUBLISHED, groups: [bus1, hidden] })
    );
    await click(findByAriaLabel(container, "Delete Bus 9"));
    const dialog = byRole(container, "alertdialog");
    expect(dialog.textContent).toContain("Move the people off this bus first.");
    expect(findButton(dialog, "Delete").hasAttribute("disabled")).toBe(true);
  });
});

describe("moves into a room (ruling R14)", () => {
  // Kari rides Bus 2 both ways and is in Hall A; Hall B rides Bus 2, Hall C Bus 1.
  const kariOnBus2 = view(
    { ...bus("bus-2", 50, "2"), name: "Bus 2" },
    {
      members: [
        seat("p2", "Kari Nordmann", "out"),
        seat("p2", "Kari Nordmann", "home"),
      ],
      riders: { home: 1, out: 1 },
      seats: { home: 1, out: 1 },
    }
  );
  const hall = (id: string, name: string, busId: string | null) =>
    view(room(id, 4, { campus_id: "2", name, out_bus_id: busId }), {
      members:
        id === "hall-a"
          ? [{ ...seat("p2", "Kari Nordmann", "out"), leg: null }]
          : [],
      openPlaces: 3,
    });
  const halls = groupsView({
    ...PUBLISHED,
    groups: [
      bus1,
      kariOnBus2,
      hall("hall-a", "Hall A", null),
      hall("hall-b", "Hall B", "bus-2"),
      hall("hall-c", "Hall C", "bus-1"),
    ],
  });

  async function moveKariTo(container: TestElement, label: string) {
    await click(findByAriaLabel(container, "More for Kari Nordmann"));
    await click(findButton(container, label));
  }

  test("after publishing, a room move onto another bus asks with the room's name", async () => {
    const container = await mount(halls);
    await moveKariTo(container, "Hall C");

    expect(moveToGroup).not.toHaveBeenCalled();
    const confirm = byRole(container, "alertdialog");
    expect(confirm.textContent).toContain("Move Kari Nordmann?");
    expect(confirm.textContent).toContain("Room · Hall C");
    expect(checkbox(confirm).checked).toBe(true);
    await click(findButton(confirm, "Move"));
    expect(moveToGroup).toHaveBeenCalledWith("b1", {
      groupId: "hall-c",
      kind: "room",
      notify: true,
      participantIds: ["p2"],
    });
  });

  test("a room move that keeps the bus doesn't ask", async () => {
    const container = await mount(halls);
    await moveKariTo(container, "Hall B");

    expect(
      findElements(container, (el) => el.getAttribute("role") === "alertdialog")
    ).toHaveLength(0);
    // Ruling R20: after publishing it still runs with notify on, so a bus
    // change the board didn't foresee is told; the server marks only real
    // changes.
    expect(moveToGroup.mock.calls[0]?.[1]).toMatchObject({
      groupId: "hall-b",
      notify: true,
    });
  });

  function Mover({ ask }: { ask: boolean }) {
    const { confirmMove } = useMoveConfirm();
    return createElement(
      "button",
      {
        onClick: () =>
          confirmMove({
            ask,
            names: ["Ola Nordmann"],
            run: async (notify) => {
              await busActions.moveToGroup("b1", {
                groupId: "room-1",
                kind: "room",
                notify,
                participantIds: ["p1"],
              });
            },
            summary: "Room · Ola Nordmann",
          }),
        type: "button",
      },
      "Go"
    );
  }

  async function mountMover(ask: boolean, published: boolean) {
    const container = installedDom.document.createElement("div");
    installedDom.document.body.appendChild(container);
    root = createRoot(container as unknown as Element);
    await act(async () => {
      root?.render(
        createElement(
          MoveConfirmProvider,
          // `children` arrives as createElement's third argument.
          { published } as Parameters<typeof MoveConfirmProvider>[0],
          createElement(Mover, { ask })
        )
      );
      await Promise.resolve();
    });
    return container as unknown as TestElement;
  }

  test("after publishing, the same confirm asks before a room move that changes the bus", async () => {
    const container = await mountMover(true, true);
    await click(findButton(container, "Go"));
    expect(moveToGroup).not.toHaveBeenCalled();
    const confirm = byRole(container, "alertdialog");
    expect(checkbox(confirm).checked).toBe(true);
    expect(confirm.textContent).toContain("Room · Ola Nordmann");
    await click(findButton(confirm, "Move"));
    expect(moveToGroup.mock.calls[0]?.[1]).toMatchObject({ notify: true });
  });

  test("a move that can't change the bus, or one before publishing, runs at once", async () => {
    let container = await mountMover(false, true);
    await click(findButton(container, "Go"));
    expect(moveToGroup).toHaveBeenCalledTimes(1);
    // After publishing, notify stays on (ruling R20).
    expect(moveToGroup.mock.calls[0]?.[1]).toMatchObject({ notify: true });
    await act(async () => root?.unmount());
    root = null;

    container = await mountMover(true, false);
    await click(findButton(container, "Go"));
    expect(moveToGroup).toHaveBeenCalledTimes(2);
    expect(moveToGroup.mock.calls[1]?.[1]).toMatchObject({ notify: false });
  });
});
