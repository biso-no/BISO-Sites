import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { isoToOsloWallClock } from "@repo/shared/utils/oslo-time";
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

const { CheckStep } = await import("./check-step");

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
  audience_type: "broadcast",
  audience_value: "",
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
  title_en: "Welcome week",
  title_no: "Fadderuke",
};

const campusOptions = [
  { label: "All campuses (app-wide)", value: "" },
  { label: "Oslo", value: "1" },
  { label: "Bergen", value: "2" },
];

// 23:00 Oslo (CET), a Wednesday in January.
const LATE_NIGHT = new Date("2026-01-14T22:00:00.000Z");
// 12:00 Oslo.
const MIDDAY = new Date("2026-01-14T11:00:00.000Z");

async function click(element: TestElement): Promise<void> {
  await act(() => {
    element.click();
  });
}

async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

const getReach = mock(async (_req: unknown) => ({
  count: 412 as number | null,
  sentence: "Everyone at Bergen.",
}));

interface HarnessProps {
  initial?: Partial<ComposerValues>;
  link?: { label?: string; title: string } | null;
  now?: Date;
  onEdit?: (step: number) => void;
  onSend?: () => void;
  reach?: typeof getReach;
  saving?: boolean;
}

function Harness({
  initial,
  link = null,
  now = MIDDAY,
  onEdit,
  onSend,
  reach = getReach,
  saving = false,
}: HarnessProps) {
  const [values, setValues] = useState<ComposerValues>({
    ...baseValues,
    ...initial,
  });
  return createElement(CheckStep, {
    campusOptions,
    confirmTranslationOverwrite: false,
    getReach: reach,
    link,
    locale: "en",
    now: () => now,
    onEdit: onEdit ?? (() => undefined),
    onSend: onSend ?? (() => undefined),
    onTranslate: () => undefined,
    saving,
    sending: false,
    set: (key: keyof ComposerValues, value: never) =>
      setValues((previous) => ({ ...previous, [key]: value })),
    translating: false,
    values,
  } as never);
}

async function mount(props: HarnessProps = {}): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  // Async so the first reach count lands inside act.
  await act(async () => {
    root?.render(createElement(Harness, props));
    await Promise.resolve();
  });
  await settle();
  return container as unknown as TestElement;
}

function isDisabled(element: TestElement): boolean {
  return element.disabled || element.hasAttribute("disabled");
}

function sendButton(container: TestElement): TestElement {
  return findButton(container, "Send");
}

describe("the summary", () => {
  test("names what, who, languages and timing in plain sentences", async () => {
    const container = await mount();
    const text = container.textContent;
    expect(text).toContain("General: Welcome week");
    expect(text).toContain("About 412 phones");
    expect(text).toContain("Everyone at Bergen.");
    expect(text).toContain("Norwegian and English");
    expect(text).toContain("Sends right away");
  });

  test("says where a tap opens when content is linked", async () => {
    const container = await mount({
      link: { label: "Quiz night (Fri 24 Oct)", title: "Quiz night" },
    });
    expect(container.textContent).toContain("Opens Quiz night (Fri 24 Oct)");
  });

  test("a single language says which one students get", async () => {
    const container = await mount({ initial: { title_no: null } });
    expect(container.textContent).toContain(
      "English only — students get it in English"
    );
  });

  test("the Who sentence for people is the count itself", async () => {
    const people = mock(async (_req: unknown) => ({
      count: 2 as number | null,
      sentence: "2 people",
    }));
    const container = await mount({
      initial: {
        audience_type: "users",
        audience_value: JSON.stringify(["a", "b"]),
      },
      reach: people,
    });
    expect(container.textContent).toContain("2 people");
    expect(container.textContent).not.toContain("phones");
  });

  test("an unknown reach says so", async () => {
    const unknown = mock(async (_req: unknown) => ({
      count: null as number | null,
      sentence: "",
    }));
    const container = await mount({ reach: unknown });
    expect(container.textContent).toContain("Reach unavailable right now");
  });

  test("Edit links jump back to their step", async () => {
    const onEdit = mock((_step: number) => undefined);
    const container = await mount({ onEdit });
    const edits = findElements(
      container,
      (element) =>
        element.tagName === "BUTTON" && element.textContent === "Edit"
    );
    await click(edits[0] as TestElement);
    await click(edits[1] as TestElement);
    await click(edits[2] as TestElement);
    expect(onEdit.mock.calls.map(([step]) => step)).toEqual([0, 2, 1]);
  });
});

describe("the late-night offer", () => {
  test("shows at 23:00 for a General announcement", async () => {
    const container = await mount({ now: LATE_NIGHT });
    expect(container.textContent).toContain(
      "It's late. Students may be asleep."
    );
    findButton(container, "Send at 08:00 instead");
  });

  test("does not show for an Urgent one", async () => {
    const container = await mount({
      initial: { category: "urgent" },
      now: LATE_NIGHT,
    });
    expect(container.textContent).not.toContain("It's late.");
  });

  test("does not show in the daytime", async () => {
    const container = await mount({ now: MIDDAY });
    expect(container.textContent).not.toContain("It's late.");
  });

  test("clicking it switches to Schedule at 08:00 the next morning", async () => {
    const container = await mount({ now: LATE_NIGHT });
    await click(findButton(container, "Send at 08:00 instead"));
    const input = findElements(
      container,
      (element) =>
        element.tagName === "INPUT" && element.type === "datetime-local"
    )[0] as TestElement;
    expect(input.value).toBe("2026-01-15T08:00");
    expect(isoToOsloWallClock("2026-01-15T07:00:00.000Z")).toBe(
      "2026-01-15T08:00"
    );
    expect(container.textContent).not.toContain("It's late.");
    expect(container.textContent).toContain(
      "Sends Thu 15 Jan, 08:00 (Oslo time)"
    );
    findButton(container, "Schedule send");
  });
});

describe("sending", () => {
  test("an Everyone send asks first, naming the campus and the reach", async () => {
    const onSend = mock(() => undefined);
    const container = await mount({ onSend });
    await click(sendButton(container));
    expect(onSend).not.toHaveBeenCalled();
    const dialog = findElements(
      container,
      (element) => element.getAttribute("role") === "alertdialog"
    )[0] as TestElement;
    expect(dialog.textContent).toContain("Send to everyone at Bergen?");
    expect(dialog.textContent).toContain("This reaches about 412 phones.");
    await click(findButton(dialog, "Send"));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  test("it asks about every student when no campus is set", async () => {
    const container = await mount({ initial: { campus_id: null } });
    await click(sendButton(container));
    expect(container.textContent).toContain("Send to every student?");
  });

  test("it drops the phones sentence when the reach is unknown", async () => {
    const unknown = mock(async (_req: unknown) => ({
      count: null as number | null,
      sentence: "",
    }));
    const container = await mount({ reach: unknown });
    await click(sendButton(container));
    expect(container.textContent).toContain("Send to everyone at Bergen?");
    expect(container.textContent).not.toContain("This reaches about");
  });

  test("Cancel sends nothing", async () => {
    const onSend = mock(() => undefined);
    const container = await mount({ onSend });
    await click(sendButton(container));
    await click(findButton(container, "Cancel"));
    expect(onSend).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Send to everyone");
  });

  test("a topic send goes straight out", async () => {
    const onSend = mock(() => undefined);
    const container = await mount({
      initial: { audience_type: "topic", audience_value: "events" },
      onSend,
    });
    await click(sendButton(container));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  test("a news announcement without its link cannot be sent", async () => {
    const container = await mount({ initial: { category: "news" } });
    expect(isDisabled(sendButton(container))).toBe(true);
    expect(container.textContent).toContain("Pick the article to link.");
  });

  test("people with nobody added cannot be sent", async () => {
    const container = await mount({
      initial: { audience_type: "users", audience_value: "[]" },
    });
    expect(isDisabled(sendButton(container))).toBe(true);
    expect(container.textContent).toContain("Add at least one person.");
  });
});

describe("scheduling", () => {
  test("a time in the past cannot be sent", async () => {
    const container = await mount({
      initial: { scheduled_at: "2026-01-14T10:00:00.000Z" },
    });
    expect(isDisabled(findButton(container, "Schedule send"))).toBe(true);
    expect(container.textContent).toContain("Pick a time in the future.");
  });

  test("a time ahead can be sent", async () => {
    const container = await mount({
      initial: { scheduled_at: "2026-01-15T07:00:00.000Z" },
    });
    expect(isDisabled(findButton(container, "Schedule send"))).toBe(false);
  });
});

describe("while a draft is saving", () => {
  test("Send is disabled", async () => {
    const container = await mount({ saving: true });
    expect(isDisabled(sendButton(container))).toBe(true);
  });
});

describe("the Everyone dialog", () => {
  function press(key: string, extra: Record<string, unknown> = {}) {
    const event = Object.assign(new Event("keydown", { cancelable: true }), {
      key,
      ...extra,
    });
    installedDom.document.dispatchEvent(event);
  }

  test("a re-render does not steal focus", async () => {
    let resolveReach: (value: { count: number; sentence: string }) => void =
      () => undefined;
    const slow = mock(
      (_req: unknown) =>
        new Promise<{ count: number | null; sentence: string }>((resolve) => {
          resolveReach = resolve;
        })
    );
    const container = await mount({ reach: slow });
    await click(sendButton(container));
    const dialog = findElements(
      container,
      (element) => element.getAttribute("role") === "alertdialog"
    )[0] as TestElement;
    const confirm = findButton(dialog, "Send");
    await act(() => {
      confirm.focus();
    });
    await act(async () => {
      resolveReach({ count: 7, sentence: "Everyone at Bergen." });
      await Promise.resolve();
    });
    expect(dialog.textContent).toContain("about 7 phones");
    expect(installedDom.document.activeElement).toBe(confirm);
  });

  test("Tab wraps between its buttons", async () => {
    const container = await mount();
    await click(sendButton(container));
    const cancel = findButton(container, "Cancel");
    const dialog = findElements(
      container,
      (element) => element.getAttribute("role") === "alertdialog"
    )[0] as TestElement;
    const confirm = findButton(dialog, "Send");
    expect(installedDom.document.activeElement).toBe(cancel);
    await act(() => press("Tab", { shiftKey: true }));
    expect(installedDom.document.activeElement).toBe(confirm);
    await act(() => press("Tab", { shiftKey: false }));
    expect(installedDom.document.activeElement).toBe(cancel);
  });

  test("Escape cancels, sends nothing and returns focus to Send", async () => {
    const onSend = mock(() => undefined);
    const container = await mount({ onSend });
    const send = sendButton(container);
    await click(send);
    await act(() => press("Escape"));
    expect(container.textContent).not.toContain("Send to everyone");
    expect(onSend).not.toHaveBeenCalled();
    expect(installedDom.document.activeElement).toBe(send);
  });

  test("a click on the backdrop cancels without sending", async () => {
    const onSend = mock(() => undefined);
    const container = await mount({ onSend });
    await click(sendButton(container));
    const dialog = findElements(
      container,
      (element) => element.getAttribute("role") === "alertdialog"
    )[0] as TestElement;
    await click(dialog.parentNode as TestElement);
    expect(container.textContent).not.toContain("Send to everyone");
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("delivery options", () => {
  test("the push toggle switches between Push + inbox and Inbox only", async () => {
    const container = await mount();
    const inboxOnly = findButton(container, "Inbox only");
    await click(inboxOnly);
    expect(
      findButton(container, "Inbox only").getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      findButton(container, "Push + inbox").getAttribute("aria-pressed")
    ).toBe("false");
  });

  test("choosing Schedule shows the date and time input", async () => {
    const container = await mount();
    await click(findButton(container, "Schedule"));
    expect(
      findElements(
        container,
        (element) =>
          element.tagName === "INPUT" && element.type === "datetime-local"
      )
    ).toHaveLength(1);
  });
});
