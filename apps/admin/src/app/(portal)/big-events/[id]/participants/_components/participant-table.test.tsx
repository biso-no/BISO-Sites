import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { loadMessages } from "@repo/i18n/messages";
import { IntlMessageFormat } from "intl-messageformat";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import type {
  ParticipantList,
  ParticipantListItem,
} from "@/lib/big-events/participant-list";
import {
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
const actualSonner = await import("sonner");
mock.module("sonner", () => ({
  ...actualSonner,
  toast: {
    error: mock(() => undefined),
    info: mock(() => undefined),
    success: mock(() => undefined),
    warning: mock(() => undefined),
  },
}));
const actualIntl = await import("next-intl");
mock.module("next-intl", () => ({
  ...actualIntl,
  useLocale: () => "en",
  useTranslations: translator,
}));

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

function item(overrides: Partial<ParticipantListItem>): ParticipantListItem {
  return {
    $collectionId: "big_event_participants",
    $createdAt: "",
    $databaseId: "app",
    $id: "p",
    $permissions: [],
    $sequence: 1,
    $tableId: "big_event_participants",
    $updatedAt: "",
    accountEmail: null,
    accountName: null,
    big_event_id: "b1",
    campus_id: "2",
    connect_reminded_at: null,
    connect_sent_at: null,
    dismissed_user_id: null,
    first_name: "Kari",
    last_import_id: null,
    last_name: "Nordmann",
    link_method: null,
    linked_at: null,
    membership_checked_at: null,
    membership_valid: null,
    phone: null,
    pile: "email",
    room_size: null,
    roomName: null,
    suggested_reason: null,
    suggested_user_id: null,
    ticket_category: null,
    ticket_email: null,
    ticket_ref: null,
    user_id: null,
    ...overrides,
  } as ParticipantListItem;
}

const list: ParticipantList = {
  counts: { app_no_push: 0, email: 2, push: 1 },
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
    item({ $id: "p3", first_name: "Anne", last_name: "Berg" }),
  ],
};

async function mount(): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root?.render(
      createElement(ParticipantTable, {
        bigEventId: "b1",
        campusOptions: [{ label: "Bergen", value: "2" }],
        defaultCampusId: "2",
        list,
      })
    );
    await Promise.resolve();
  });
  return container as unknown as TestElement;
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
    expect(text).toContain("In the app with notifications1");
  });

  test("a reach chip narrows the list to that pile", async () => {
    const container = await mount();
    await act(() => {
      buttonStartingWith(container, "Not in the app yet").click();
    });
    expect(container.textContent).not.toContain("Kari Nordmann");
    expect(container.textContent).toContain("Ola Hansen");
    expect(container.textContent).toContain("Showing 2 of 3");
  });
});
