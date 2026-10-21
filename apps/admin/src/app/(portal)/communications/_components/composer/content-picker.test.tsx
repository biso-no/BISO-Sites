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
import type { LinkableItem } from "@/lib/announcements/composer-lookups";
import type { UserAuthContext } from "@/lib/authorization";
import {
  findButton,
  findByAriaLabel,
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";
import type { ComposerValues } from "./composer-state";

// The picker's default `search` is a server action; its import chain needs the
// same stubs the composer suite uses. Tests inject `search` and `loadPrefill`.
mock.module("server-only", () => ({}));
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
  createAdminClient: mock(async () => ({ db: {}, messaging: {}, users: {} })),
  createSessionClient: mock(async () => ({ db: {} })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => globalAdminCtx),
}));
// `unstable_cache` is read at import by the composer lookups the What step uses.
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
}));

const { ContentPicker } = await import("./content-picker");
const { WhatStep } = await import("./what-step");
const { buildLinkState } = await import("./link-state");

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

const party: LinkableItem = {
  campusId: "2",
  campusName: "Bergen",
  date: "2026-10-24T20:00:00Z",
  dateLabel: "Fri 24 Oct",
  id: "ev-1",
  image: null,
  linkable: true,
  status: "published",
  title: "Autumn party",
  type: "event",
};
const draftFair: LinkableItem = {
  ...party,
  campusId: "1",
  campusName: "Oslo",
  id: "ev-2",
  linkable: false,
  status: "draft",
  title: "Autumn career fair",
};

const search = mock(async (_type: string, _query: string) => [
  party,
  draftFair,
]);

async function mount(node: ReturnType<typeof createElement>) {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(node);
  });
  return container;
}

/** Mounts and lets the first lookups land inside act, so none escapes it. */
async function mountSettled(
  node: ReturnType<typeof createElement>
): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root?.render(node);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

async function wait(ms = 400): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function click(element: TestElement): Promise<void> {
  await act(() => {
    element.click();
  });
  await wait(0);
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

describe("ContentPicker", () => {
  test("typing shows matching results with their details", async () => {
    const container = await mount(
      createElement(ContentPicker, {
        onClear: () => undefined,
        onPick: () => undefined,
        search,
        type: "event",
        value: null,
      })
    );
    await click(findButton(container, "Search by name…"));
    await type(findByAriaLabel(container, "Search events"), "autumn");
    await wait();

    expect(search).toHaveBeenCalledWith("event", "autumn");
    const rows = options(container);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Autumn party");
    expect(rows[0]?.textContent).toContain("Fri 24 Oct · Bergen · Published");
  });

  test("a draft row says it cannot be linked and cannot be picked", async () => {
    const onPick = mock(() => undefined);
    const container = await mount(
      createElement(ContentPicker, {
        onClear: () => undefined,
        onPick,
        search,
        type: "event",
        value: null,
      })
    );
    await click(findButton(container, "Search by name…"));
    await wait();

    const draft = options(container)[1];
    expect(draft?.textContent).toContain("Draft (can't link drafts)");
    expect(draft?.getAttribute("aria-disabled")).toBe("true");
    await click(draft as TestElement);
    expect(onPick).not.toHaveBeenCalled();
  });

  test("a linked value shows its card with a Change link", async () => {
    const onClear = mock(() => undefined);
    const container = await mount(
      createElement(ContentPicker, {
        onClear,
        onPick: () => undefined,
        search,
        type: "event",
        value: {
          id: "ev-1",
          image: null,
          meta: "Fri 24 Oct · Bergen",
          title: "Autumn party",
        },
      })
    );
    expect(container.textContent).toContain("Autumn party");
    expect(container.textContent).toContain("Fri 24 Oct · Bergen");
    await click(findButton(container, "Change"));
    expect(onClear).toHaveBeenCalled();
  });
});

const baseValues: ComposerValues = {
  audience_type: "broadcast",
  audience_value: "",
  body_en: null,
  body_no: null,
  campus_id: "1",
  category: "event",
  content_id: null,
  content_type: null,
  department_id: null,
  event_id: null,
  push: true,
  scheduled_at: null,
  title_en: "",
  title_no: null,
};

function Harness({
  initial,
  loadPrefill,
  searchFn = search,
  storedLink,
}: {
  initial?: Partial<ComposerValues>;
  searchFn?: (type: string, query: string) => Promise<LinkableItem[]>;
  loadPrefill: (type: "event" | "news" | "job", id: string) => Promise<unknown>;
  storedLink?: { image: string | null; title: string } | null;
}) {
  const [values, setValues] = useState<ComposerValues>({
    ...baseValues,
    ...initial,
  });
  const [link, setLink] = useState(buildLinkState());
  const [locale, setLocale] = useState<"en" | "no">("no");
  const step = createElement(WhatStep, {
    audienceContext: { managedCampusIds: [], roles: ["globaladmin"] },
    audienceTouched: false,
    link,
    loadPrefill: loadPrefill as never,
    locale,
    search: searchFn,
    set: (key: keyof ComposerValues, value: unknown) =>
      setValues((prev) => ({ ...prev, [key]: value })),
    setLink,
    setLocale,
    storedLink,
    update: (fn: (prev: ComposerValues) => ComposerValues) =>
      setValues((prev) => fn(prev)),
    values,
  } as never);
  return createElement(
    "div",
    null,
    step,
    createElement(
      "p",
      { "aria-label": "probe" },
      `BODY:${values.body_no ?? ""}|CAT:${values.category}|ID:${values.content_id ?? ""}`
    )
  );
}

const prefill = {
  body_en: "<p>Come celebrate</p>",
  body_no: "<p>Kom og feir</p>",
  campusId: "2",
  item: party,
  label: "Autumn party (Fri 24 Oct)",
  title_en: "Autumn party",
  title_no: "Høstfest",
  topic: "events",
};

describe("WhatStep", () => {
  test("choosing News asks which article", async () => {
    const container = await mount(
      createElement(Harness, { loadPrefill: async () => null })
    );
    expect(container.textContent).toContain("Which event?");
    await click(findButton(container, "NewsLinks to an article"));
    expect(container.textContent).toContain("Which article?");
  });

  test("choosing General hides the picker and clears the link", async () => {
    const container = await mount(
      createElement(Harness, {
        initial: { content_id: "ev-1", content_type: "event" },
        loadPrefill: async () => prefill,
      })
    );
    expect(container.textContent).toContain("Which event?");
    await click(findButton(container, "GeneralAn update from BISO"));
    expect(container.textContent).not.toContain("Which event?");
    expect(container.textContent).not.toContain("Autumn party (Fri 24 Oct)");
  });

  test("picking content shows the linked card, fills the text and says so", async () => {
    const container = await mount(
      createElement(Harness, { loadPrefill: async () => prefill })
    );
    await click(findButton(container, "Search by name…"));
    await wait();
    await click(options(container)[0] as TestElement);
    await wait(0);

    expect(findButton(container, "Change")).toBeDefined();
    const title = findElements(
      container,
      (element) => element.tagName === "INPUT" && element.value === "Høstfest"
    );
    expect(title).toHaveLength(1);
    expect(container.textContent).toContain(
      "✓ Title and text filled in from the event. Edit freely. Audience set to Events · Bergen."
    );
  });

  test("linking keeps a title the admin already typed", async () => {
    const container = await mount(
      createElement(Harness, {
        initial: { title_no: "Min egen tittel" },
        loadPrefill: async () => prefill,
      })
    );
    await click(findButton(container, "Search by name…"));
    await wait();
    await click(options(container)[0] as TestElement);
    await wait(0);

    const title = findElements(
      container,
      (element) =>
        element.tagName === "INPUT" && element.value === "Min egen tittel"
    );
    expect(title).toHaveLength(1);
  });

  describe("late prefill responses", () => {
    const talk: LinkableItem = {
      ...party,
      id: "ev-3",
      title: "Guest talk",
    };
    const talkPrefill = {
      ...prefill,
      body_no: "<p>Foredrag</p>",
      item: talk,
      label: "Guest talk (Fri 24 Oct)",
      title_no: "Foredrag",
    };
    const searchBoth = () => Promise.resolve([party, talk]);

    function deferred() {
      let resolve: (value: unknown) => void = () => undefined;
      const promise = new Promise((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    function probe(container: TestElement): string {
      return findByAriaLabel(container, "probe").textContent;
    }

    test("the last pick wins when responses arrive out of order", async () => {
      const a = deferred();
      const b = deferred();
      const container = await mount(
        createElement(Harness, {
          loadPrefill: (_type: string, id: string) =>
            (id === "ev-1" ? a : b).promise,
          searchFn: searchBoth,
        })
      );
      await click(findButton(container, "Search by name…"));
      await wait();
      await click(options(container)[0] as TestElement);
      await click(findButton(container, "Change"));
      await wait();
      await click(options(container)[1] as TestElement);

      await act(async () => {
        b.resolve(talkPrefill);
        await new Promise((r) => setTimeout(r, 0));
      });
      await act(async () => {
        a.resolve(prefill);
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(probe(container)).toContain("ID:ev-3");
      expect(probe(container)).toContain("BODY:<p>Foredrag</p>");
      expect(container.textContent).toContain("Guest talk");
      expect(container.textContent).not.toContain("Autumn party");
    });

    test("choosing General before the response lands leaves no link", async () => {
      const a = deferred();
      const container = await mount(
        createElement(Harness, {
          loadPrefill: () => a.promise,
          searchFn: searchBoth,
        })
      );
      await click(findButton(container, "Search by name…"));
      await wait();
      await click(options(container)[0] as TestElement);
      await click(findButton(container, "GeneralAn update from BISO"));
      await act(async () => {
        a.resolve(prefill);
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(probe(container)).toContain("CAT:general");
      expect(probe(container).endsWith("ID:")).toBe(true);
      expect(probe(container)).not.toContain("Kom og feir");
      expect(container.textContent).not.toContain("Which event?");
    });
  });

  test("a failed prefill keeps the link and says to write the text", async () => {
    const container = await mount(
      createElement(Harness, {
        loadPrefill: () => Promise.reject(new Error("down")),
      })
    );
    await click(findButton(container, "Search by name…"));
    await wait();
    await click(options(container)[0] as TestElement);
    await wait(0);

    expect(findButton(container, "Change")).toBeDefined();
    expect(probe0(container)).toContain("ID:ev-1");
    expect(container.textContent).toContain(
      "Couldn't fill in the text from the event. Write it yourself."
    );
  });

  test("a reopened draft shows the card with its meta", async () => {
    const container = await mount(
      createElement(Harness, {
        initial: { content_id: "ev-1", content_type: "event" },
        loadPrefill: async () => prefill,
      })
    );
    await wait(0);
    expect(container.textContent).toContain("Autumn party");
    expect(container.textContent).toContain("Fri 24 Oct · Bergen");
  });

  describe("a reopened draft whose content can't be loaded", () => {
    test.each([
      ["the lookup fails", () => Promise.reject(new Error("down"))],
      ["the content is gone", async () => null],
    ])("keeps a card when %s, and says so", async (_label, loadPrefill) => {
      const container = await mountSettled(
        createElement(Harness, {
          initial: { content_id: "ev-1", content_type: "event" },
          loadPrefill,
        })
      );

      expect(findButton(container, "Change")).toBeDefined();
      expect(container.textContent).toContain("Linked event");
      expect(container.textContent).toContain(
        "Couldn't load the linked event."
      );
      expect(probe0(container)).toContain("ID:ev-1");
    });

    test("the card uses the title the row was saved with", async () => {
      const container = await mountSettled(
        createElement(Harness, {
          initial: { content_id: "ev-1", content_type: "event" },
          loadPrefill: () => Promise.reject(new Error("down")),
          storedLink: { image: null, title: "Autumn party" },
        })
      );

      expect(container.textContent).toContain("Autumn party");
      expect(container.textContent).not.toContain("Linked event");
    });
  });

  test("re-linking replaces only the fields still holding the last prefill", async () => {
    const talk: LinkableItem = { ...party, id: "ev-3", title: "Guest talk" };
    const container = await mount(
      createElement(Harness, {
        loadPrefill: async (_type: string, id: string) =>
          id === "ev-1"
            ? prefill
            : {
                ...prefill,
                body_no: "<p>Foredrag</p>",
                item: talk,
                title_no: "Foredrag",
              },
        searchFn: async () => [party, talk],
      })
    );
    await click(findButton(container, "Search by name…"));
    await wait();
    await click(options(container)[0] as TestElement);
    await wait(0);
    const titleInput = findElements(
      container,
      (element) => element.tagName === "INPUT" && element.value === "Høstfest"
    )[0] as TestElement;
    await act(() => {
      titleInput.value = "Min tittel";
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(findButton(container, "Change"));
    await wait();
    await click(options(container)[1] as TestElement);
    await wait(0);

    expect(
      findElements(
        container,
        (element) =>
          element.tagName === "INPUT" && element.value === "Min tittel"
      )
    ).toHaveLength(1);
    expect(probe0(container)).toContain("BODY:<p>Foredrag</p>");
  });
});

function probe0(container: TestElement): string {
  return findByAriaLabel(container, "probe").textContent;
}
