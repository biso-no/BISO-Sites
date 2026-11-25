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
import { IntlMessageFormat } from "intl-messageformat";
import {
  act,
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from "react";
import type { Root } from "react-dom/client";
import type {
  ParticipantList,
  ParticipantListItem,
} from "@/lib/big-events/participant-list";
import {
  findButton,
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";

// Real English messages through the ICU formatter next-intl uses, so a
// missing key or a broken plural fails here. The lookup is local because an
// earlier suite may already have swapped `next-intl` for a stub.
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

// Radix dialogs portal into `document.body` and lean on browser APIs this
// harness lacks, so the alert dialog renders inline here (as in
// benefit-panel.test.tsx): content only while open, Cancel closes it.
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
const actualAlertDialog = await import("@repo/ui/components/ui/alert-dialog");
mock.module("@repo/ui/components/ui/alert-dialog", () => ({
  ...actualAlertDialog,
  AlertDialog: ({ children, onOpenChange, open }: Slot) =>
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
    ),
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
  AlertDialogContent({ children }: Slot) {
    return useContext(DialogOpen).open
      ? createElement("div", { role: "alertdialog" }, children)
      : null;
  },
  AlertDialogDescription: passThrough("p"),
  AlertDialogFooter: passThrough("div"),
  AlertDialogHeader: passThrough("div"),
  AlertDialogTitle: passThrough("h2"),
  AlertDialogTrigger: ({ children }: Slot) => children,
}));
const actualIntl = await import("next-intl");
mock.module("next-intl", () => ({
  ...actualIntl,
  useLocale: () => "en",
  useTranslations: translator,
}));

// The server action is replaced on its module, so the table's own import
// sees the stand-in; restored after the suite.
const participantActions = await import(
  "../../../../_actions/big-event-participants"
);
const sendConnectEmails = spyOn(
  participantActions,
  "sendConnectEmails"
).mockImplementation(async () => ({ addresses: 1, queued: 1, waiting: 0 }));
afterAll(() => sendConnectEmails.mockRestore());

const { ParticipantTable } = await import("./participant-table");

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
  sendConnectEmails.mockClear();
  for (const fn of Object.values(toast)) {
    fn.mockClear();
  }
});

function item(overrides: Partial<ParticipantListItem>): ParticipantListItem {
  return {
    $id: "p",
    accountEmail: null,
    accountName: null,
    busName: null,
    campus_id: "2",
    connect_sent_at: null,
    first_name: "Kari",
    last_name: "Nordmann",
    homeBusName: null,
    membership_valid: null,
    needsNewLink: false,
    phone: null,
    pile: "email",
    roomName: null,
    suggestion: null,
    ticket_email: null,
    user_id: null,
    ...overrides,
  };
}

const list: ParticipantList = {
  counts: { app_no_push: 0, email: 2, push: 1 },
  hasBuses: true,
  hasRooms: true,
  noCampus: 0,
  rows: [
    item({
      $id: "p1",
      accountEmail: "s1@bi.no",
      membership_valid: false,
      pile: "push",
      roomName: "Ola Hansen",
      user_id: "u1",
    }),
    item({
      $id: "p2",
      connect_sent_at: "2026-12-03T09:00:00.000+00:00",
      first_name: "Ola",
      last_name: "Hansen",
    }),
    item({
      $id: "p3",
      first_name: "Anne",
      last_name: "Berg",
      suggestion: { email: "anne@bi.no", name: "Anne Berg", reason: "phone" },
    }),
  ],
};

/**
 * Not connected: Per and Liv (one shared address) were never emailed, Ola
 * was; Kari is connected and Nils has no email.
 */
const sendList: ParticipantList = {
  counts: { app_no_push: 0, email: 4, push: 1 },
  hasBuses: false,
  hasRooms: false,
  noCampus: 0,
  rows: [
    item({ $id: "k", pile: "push", ticket_email: "k@x.no", user_id: "u1" }),
    item({ $id: "p", first_name: "Per", ticket_email: "family@x.no" }),
    item({ $id: "l", first_name: "Liv", ticket_email: "Family@x.no" }),
    item({
      $id: "o",
      connect_sent_at: "2026-12-03T09:00:00.000+00:00",
      first_name: "Ola",
      ticket_email: "ola@x.no",
    }),
    item({ $id: "n", first_name: "Nils" }),
  ],
};

async function mount(shown: ParticipantList = list): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root?.render(
      createElement(ParticipantTable, {
        bigEventId: "b1",
        campusOptions: [{ label: "Bergen", value: "2" }],
        defaultCampusId: "2",
        isPublished: true,
        list: shown,
      })
    );
    await Promise.resolve();
  });
  return container as unknown as TestElement;
}

async function click(element: TestElement): Promise<void> {
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
}

function alertDialog(root: TestElement): TestElement | undefined {
  return findElements(
    root,
    (element) => element.getAttribute("role") === "alertdialog"
  )[0];
}

function buttonStartingWith(root: TestElement, text: string): TestElement {
  const [button] = findElements(
    root,
    (element) =>
      element.tagName === "BUTTON" && element.textContent.startsWith(text)
  );
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button;
}

describe("ParticipantTable", () => {
  test("shows each person's room, connect state and membership", async () => {
    const text = (await mount()).textContent;
    expect(text).toContain("Room · Ola Hansen");
    expect(text).toContain("No valid membership");
    expect(text).toContain("Connect email sent 3 Dec");
    expect(text).toContain("Not connected");
    expect(text).toContain("Not in a room yet (2)");
    expect(text).toContain("Gets push notifications1");
    expect(text.toLowerCase()).not.toContain("in the app");
  });

  test("an unlinked person shows a possible match to link or dismiss", async () => {
    const container = await mount();
    expect(container.textContent).toContain(
      "Possible match: Anne Berg (anne@bi.no) · same phone"
    );
    expect(buttonStartingWith(container, "Link")).toBeDefined();
    expect(buttonStartingWith(container, "Not them")).toBeDefined();
  });

  test("the toolbar links to the import", async () => {
    const container = await mount();
    const [importLink] = findElements(
      container,
      (element) =>
        element.tagName === "A" && element.textContent === "Import list"
    );
    expect(importLink?.getAttribute("href")).toBe(
      "/big-events/b1/participants/import"
    );
  });

  test("a reach chip narrows the list to that pile", async () => {
    const container = await mount();
    await act(() => {
      buttonStartingWith(container, "Not connected yet, gets email").click();
    });
    expect(container.textContent).not.toContain("Kari Nordmann");
    expect(container.textContent).toContain("Ola Hansen");
    expect(container.textContent).toContain("Showing 2 of 3");
  });
});

describe("sending connect emails (R37)", () => {
  test("the main button asks first, then sends only to people never emailed", async () => {
    const container = await mount(sendList);

    await click(buttonStartingWith(container, "Send connect emails (2)"));

    expect(sendConnectEmails).not.toHaveBeenCalled();
    const dialog = alertDialog(container);
    // Per and Liv share an address: two people, one email.
    expect(dialog?.textContent).toContain("Send 1 email?");
    expect(dialog?.textContent).toContain("2 people");
    await click(findButton(dialog as TestElement, "Send"));
    expect(sendConnectEmails).toHaveBeenCalledWith("b1", undefined, "new");
  });

  test("sending again to everyone not connected asks first too", async () => {
    const container = await mount(sendList);

    await click(
      buttonStartingWith(container, "Send again to everyone not connected (3)")
    );

    expect(sendConnectEmails).not.toHaveBeenCalled();
    const dialog = alertDialog(container);
    expect(dialog?.textContent).toContain("Send 2 emails?");
    expect(dialog?.textContent).toContain("3 people");
    await click(findButton(dialog as TestElement, "Send"));
    expect(sendConnectEmails).toHaveBeenCalledWith("b1", undefined, "all");
  });

  test("cancel sends nothing", async () => {
    const container = await mount(sendList);
    await click(buttonStartingWith(container, "Send connect emails (2)"));
    await click(findButton(alertDialog(container) as TestElement, "Cancel"));
    expect(alertDialog(container)).toBeUndefined();
    expect(sendConnectEmails).not.toHaveBeenCalled();
  });

  test("with nobody emailed yet there is no second button", async () => {
    const container = await mount({
      ...sendList,
      rows: sendList.rows.filter((row) => row.$id !== "o"),
    });
    expect(container.textContent).not.toContain("Send again to everyone");
  });

  test("the toast counts emails, not people", async () => {
    sendConnectEmails.mockImplementationOnce(async () => ({
      addresses: 1,
      queued: 2,
      waiting: 0,
    }));
    const container = await mount(sendList);
    await click(buttonStartingWith(container, "Send connect emails (2)"));
    await click(findButton(alertDialog(container) as TestElement, "Send"));
    expect(toast.success).toHaveBeenCalledWith("Queued 1 email");
  });

  test("says so when the emails are already waiting to be sent", async () => {
    sendConnectEmails.mockImplementationOnce(async () => ({
      addresses: 0,
      queued: 0,
      waiting: 2,
    }));
    const container = await mount(sendList);
    await click(buttonStartingWith(container, "Send connect emails (2)"));
    await click(findButton(alertDialog(container) as TestElement, "Send"));
    expect(toast.info).toHaveBeenCalledWith("Already waiting to be sent");
  });

  test("with Travel on, each row shows its bus and a Not on a bus yet chip", async () => {
    const container = await mount({
      ...list,
      hasBuses: true,
      rows: [
        item({ $id: "b1", busName: "Bus 2" }),
        item({
          $id: "b2",
          busName: "Bus 2",
          first_name: "Ola",
          homeBusName: "Bus 3",
        }),
        item({ $id: "b3", first_name: "Anne" }),
      ],
    });
    const text = container.textContent;
    expect(text).toContain("Bus 2 · Home: Bus 3");
    expect(text).toContain("No bus");
    expect(text).toContain("Not on a bus yet (1)");
    await act(() => {
      buttonStartingWith(container, "Not on a bus yet").click();
    });
    expect(container.textContent).toContain("Showing 1 of 3");
  });

  test("with Travel off there is no bus column or chip", async () => {
    const text = (await mount({ ...list, hasBuses: false })).textContent;
    expect(text).not.toContain("Not on a bus yet");
    expect(text).not.toContain("No bus");
  });

  test("the Needs a new link chip shows only when someone does", async () => {
    expect((await mount()).textContent).not.toContain("Needs a new link");
  });

  test("the Needs a new link chip counts and filters those people", async () => {
    const container = await mount({
      ...list,
      rows: [
        item({ $id: "n1", needsNewLink: true, ticket_email: "a@x.no" }),
        item({ $id: "n2", first_name: "Ola" }),
      ],
    });
    expect(container.textContent).toContain("Needs a new link (1)");
    await act(() => {
      buttonStartingWith(container, "Needs a new link").click();
    });
    expect(container.textContent).toContain("Showing 1 of 2");
  });
});
