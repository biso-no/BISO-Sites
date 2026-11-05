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
import {
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";

// Pins how the job studio's steps are wired to its state: the rail, the
// title and slug, the tag limit, the campus/department pair and the review.
// Runs in its own process (see job-studio.test.ts): the actions are mocked.

const listJobDepartmentsForCampus = mock((campusId: string) =>
  Promise.resolve(
    campusId === "c2"
      ? [{ $id: "d-bergen", Name: "Bergen Board" }]
      : [{ $id: "d-oslo", Name: "Oslo Board" }]
  )
);

mock.module("server-only", () => ({}));
mock.module("../../../_actions/jobs", () => ({
  createJob: mock(() => Promise.resolve({ data: "new-id" })),
  duplicateJob: mock(() => Promise.resolve({ data: "copy-id" })),
  generateJobTranslationDraft: mock(() => Promise.resolve({})),
  suggestJobDescriptionSection: mock(() => Promise.resolve({})),
  updateJob: mock(() => Promise.resolve({})),
}));
mock.module("../../../_actions/lookups", () => ({
  listJobDepartmentsForCampus,
}));
const actualUploadClient = await import("@/lib/upload-client");
mock.module("@/lib/upload-client", () => ({
  ...actualUploadClient,
  uploadMediaFile: mock(() => Promise.resolve({ error: "no uploads" })),
}));
mock.module("sonner", () => ({
  toast: {
    error: () => undefined,
    message: () => undefined,
    success: () => undefined,
    warning: () => undefined,
  },
}));
mock.module("next/navigation", () => ({
  usePathname: () => "/jobs/new",
  useRouter: () => ({
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
  }),
  useSearchParams: () => new URLSearchParams(),
}));
mock.module("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
mock.module("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  }) => createElement("a", { ...rest, href }, children),
}));

mock.module("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) =>
    createElement("img", { alt, src }),
}));

const installedDom = installReactDom();
// The studio guards unsaved work with a beforeunload listener.
Object.assign(globalThis.window, {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});
const { JobStudioEditor } = await import("./job-studio-editor");

const campuses = [
  { $id: "c1", name: "Oslo" },
  { $id: "c2", name: "Bergen" },
];

const props = {
  campuses,
  initialDepartments: [{ $id: "d-oslo", Name: "Oslo Board" }],
  isNew: true,
  job: null,
  labels: {
    back: "Back",
    publish: "Publish",
    publishSuccess: "Published",
    saveDraft: "Save draft",
    saveError: "Could not save",
    saveSuccess: "Saved",
  },
};

let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  installedDom.document.body.textContent = "";
  listJobDepartmentsForCampus.mockClear();
});

afterAll(() => installedDom.restore());

async function mount() {
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(createElement(JobStudioEditor, props as never));
  });
}

const page = () => container as unknown as TestNode;
const text = () => container.textContent ?? "";

function button(label: string): TestElement {
  const found = findElements(
    page(),
    (element) =>
      element.tagName === "BUTTON" &&
      (element.textContent ?? "").trim() === label
  )[0];
  if (!found) {
    throw new Error(`Button not found: ${label}`);
  }
  return found;
}

/**
 * A step in the rail: "02Description" (number, name), or just the name once
 * the step is done and its number became a check mark.
 */
function railStep(name: string): TestElement {
  const found = findElements(
    page(),
    (element) =>
      element.tagName === "BUTTON" &&
      new RegExp(`^(\\d\\d)?${name}$`).test(element.textContent ?? "")
  )[0];
  if (!found) {
    throw new Error(`Rail step not found: ${name}`);
  }
  return found;
}

async function click(element: TestElement) {
  await act(async () => {
    element.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Calls a handler React rendered on `element`, with the event fields read. */
async function fire(element: TestElement, handler: string, value?: string) {
  const key = Object.keys(element).find((k) => k.startsWith("__reactProps"));
  const rendered = key
    ? (element as unknown as Record<string, Record<string, unknown>>)[key]
    : undefined;
  const fn = rendered?.[handler] as ((event: unknown) => unknown) | undefined;
  if (!fn) {
    throw new Error(`No ${handler} on <${element.tagName}>`);
  }
  await act(async () => {
    if (value !== undefined) {
      element.value = value;
    }
    await fn({ currentTarget: element, target: element });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function byPlaceholder(placeholder: string): TestElement {
  const found = findElements(
    page(),
    (element) => element.getAttribute("placeholder") === placeholder
  )[0];
  if (!found) {
    throw new Error(`No field with placeholder: ${placeholder}`);
  }
  return found;
}

function selects(): TestElement[] {
  return findElements(page(), (element) => element.tagName === "SELECT");
}

const heading = () =>
  findElements(page(), (element) => element.tagName === "H1")[0]?.textContent;

describe("job studio", () => {
  test("the rail moves between the six steps", async () => {
    await mount();
    expect(text()).toContain("Step 1 of 6 · Essentials");
    for (const [index, name] of [
      "Description",
      "Logistics",
      "Screening",
      "Visibility",
      "Review",
      "Essentials",
    ].entries()) {
      await click(railStep(name));
      const number = index === 5 ? 1 : index + 2;
      expect(text()).toContain(`Step ${number} of 6 · ${name}`);
    }
  });

  test("the title heads the page and fills an empty slug on blur", async () => {
    await mount();
    expect(heading()).toBe("New vacancy");
    const title = byPlaceholder("A job title that excites...");
    await fire(title, "onChange", "Event Lead");
    await fire(title, "onBlur");
    // A new vacancy keeps its "New vacancy" heading.
    expect(heading()).toBe("New vacancy");
    const prefix = findElements(
      page(),
      (element) =>
        element.tagName === "SPAN" && element.textContent === "biso.no/jobs/"
    )[0];
    const slug = findElements(
      prefix?.parentNode as TestNode,
      (element) => element.tagName === "INPUT"
    )[0];
    expect(slug?.value).toBe("event-lead");
    expect(text()).toContain("Unsaved");
  });

  test("tags stop at four", async () => {
    await mount();
    for (const tag of [
      "Volunteer",
      "Paid",
      "Leadership",
      "International",
      "Marketing",
    ]) {
      await click(button(tag));
    }
    const active = [
      "Volunteer",
      "Paid",
      "Leadership",
      "International",
      "Marketing",
    ].filter((tag) => button(tag).style.color === "#fff");
    expect(active).toEqual([
      "Volunteer",
      "Paid",
      "Leadership",
      "International",
    ]);
    await click(button("Paid"));
    expect(button("Paid").style.color).toBe("#475569");
  });

  test("a new campus clears the department and loads its departments", async () => {
    await mount();
    const [campus, department] = selects();
    await fire(department as TestElement, "onChange", "d-oslo");
    expect(text()).toContain("Oslo Board · Oslo");
    await fire(campus as TestElement, "onChange", "c2");
    expect(listJobDepartmentsForCampus.mock.calls).toEqual([["c2"]]);
    expect(text()).toContain("Bergen Board");
    expect(text()).not.toContain("Oslo Board");
    expect(text()).toContain("Any department · Bergen");
  });

  test("each step shows its own content", async () => {
    await mount();
    await click(railStep("Description"));
    expect(text()).toContain("The whole story.");
    await click(railStep("Logistics"));
    expect(text()).toContain("Time, place, paperwork.");
    await click(railStep("Review"));
    expect(text()).not.toContain("The whole story.");
  });
});
