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
import { act, createElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import type { BenefitAccess } from "@/lib/benefit-access";
import {
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";
import type {
  BenefitBoardData,
  BoardBenefit,
  BoardPartner,
} from "../../_actions/benefits";

// `mock.module` is process-wide, so every framework module keeps whatever
// exports it already has and only the hooks this board needs are replaced.
// Translations read the real Norwegian bundle, so the assertions read what a
// committee member sees rather than message keys. The lookup is local: an
// earlier suite may already have swapped `next-intl` for a stub, so its own
// formatter cannot be relied on here.
const messages = await loadMessages("no");
const PLACEHOLDER = /\{(\w+)\}/g;

function translator(namespace?: string) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const path = [...(namespace?.split(".") ?? []), ...key.split(".")];
    let node: unknown = messages;
    for (const part of path) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (typeof node !== "string") {
      throw new Error(`Missing message: ${path.join(".")}`);
    }
    return node.replace(PLACEHOLDER, (_, name: string) =>
      String(values[name] ?? `{${name}}`)
    );
  };
}

const actualIntl = await import("next-intl");
mock.module("next-intl", () => ({
  ...actualIntl,
  useLocale: () => "no",
  useTranslations: translator,
}));

const actualNavigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...actualNavigation,
  usePathname: () => "/benefits",
  useRouter: () => ({
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
  }),
  useSearchParams: () => new URLSearchParams("campus=2"),
}));

const actualLink = await import("next/link");
mock.module("next/link", () => ({
  ...actualLink,
  default: ({
    children,
    href,
    ...props
  }: { children: ReactNode; href: string } & Record<string, unknown>) =>
    createElement(
      "a",
      { className: props.className, href, style: props.style },
      children
    ),
}));

// The board's only server action sits behind a thin module this suite owns,
// so the shared `_actions/benefits` module is never replaced process-wide.
const reorderCalls: unknown[][] = [];
mock.module("./board-actions", () => ({
  saveBenefitOrder: (...args: unknown[]) => {
    reorderCalls.push(args);
    return Promise.resolve({ data: true });
  },
}));

const { BenefitBoard } = await import("./benefit-board");

const installedDom = installReactDom();
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
  reorderCalls.length = 0;
  installedDom.document.body.textContent = "";
});

afterAll(() => installedDom.restore());

async function mount(element: ReturnType<typeof createElement>) {
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(element);
  });
}

function benefit(overrides: Partial<BoardBenefit>): BoardBenefit {
  return {
    $createdAt: "2026-01-01T00:00:00Z",
    $id: "b1",
    campus_id: "2",
    category: null,
    image_url: null,
    is_featured: false,
    partner_id: null,
    publish_end: null,
    publish_start: null,
    redemption_type: "none",
    section: "member",
    sort_order: 0,
    status: "published",
    title_en: "",
    title_nb: "",
    ...overrides,
  };
}

const partner: BoardPartner = {
  campus_id: "2",
  id: "partner-loft",
  is_active: true,
  logo_url: null,
  name: "Løft studios",
};

const OWN_TILE = "20 % hos Løft studios";
const CAREER_LINE = "1-1-veiledning med Econa";
const NATIONAL_TILE = "40 % på Fadderullan";

const bergenData: BenefitBoardData = {
  benefits: [
    benefit({
      $id: "own-tile",
      category: "health_fitness",
      partner_id: partner.id,
      title_nb: OWN_TILE,
    }),
    benefit({
      $id: "career-line",
      section: "career",
      status: "draft",
      title_nb: CAREER_LINE,
    }),
    benefit({
      $id: "national-tile",
      campus_id: "5",
      category: "events",
      title_nb: NATIONAL_TILE,
    }),
  ],
  campusId: "2",
  editable: true,
  partners: [partner],
};

const SECOND_TILE = "15–20 % hos Dogtails";

/** Two own member tiles can trade places; the single career line cannot. */
const bergenWithTwoTiles: BenefitBoardData = {
  ...bergenData,
  benefits: [
    ...bergenData.benefits,
    benefit({ $id: "second-tile", sort_order: 1, title_nb: SECOND_TILE }),
  ],
};

const bergenEditor: BenefitAccess = {
  editableCampusIds: ["2"],
  visibleCampusIds: ["2", "5"],
};

const bergenViewer: BenefitAccess = {
  editableCampusIds: [],
  visibleCampusIds: ["2", "5"],
};

const READ_ONLY_NOTE =
  "Disse gjelder alle campuser. Bare administratorer kan endre dem.";

function anchors(): TestElement[] {
  return findElements(
    container as unknown as TestNode,
    (element) => element.tagName === "A"
  );
}

function addLinks(): TestElement[] {
  return anchors().filter((anchor) => anchor.textContent === "+ Legg til");
}

function dragHandleLabels(): (string | null)[] {
  return findElements(
    container as unknown as TestNode,
    (element) => element.tagName === "BUTTON"
  ).map((handle) => handle.getAttribute("aria-label"));
}

function itemLink(id: string): TestElement {
  const link = anchors().find(
    (anchor) => anchor.getAttribute("href") === `/benefits/${id}?campus=2`
  );
  if (!link) {
    throw new Error(`No link to ${id}`);
  }
  return link;
}

describe("BenefitBoard", () => {
  test("shows the five sections in the website's order", async () => {
    await mount(
      <BenefitBoard access={bergenEditor} data={bergenData} locale="no" />
    );

    const headings = findElements(
      container as unknown as TestNode,
      (element) => element.tagName === "H2"
    ).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Medlemsfordeler",
      "Karrierefordeler",
      "Sosialt nettverk",
      "Trygghet og støtte",
      "For bedrifter",
    ]);
  });

  test("renders a member tile with its partner, category and state", async () => {
    await mount(
      <BenefitBoard access={bergenEditor} data={bergenData} locale="no" />
    );

    const tile = itemLink("own-tile");
    expect(tile.textContent).toContain(OWN_TILE);
    expect(tile.textContent).toContain("Løft studios · Trening og helse");
    expect(tile.textContent).toContain("Synlig");
    expect(itemLink("career-line").textContent).toContain("Utkast");
  });

  test("lists Hele BISO items after a quiet divider", async () => {
    await mount(
      <BenefitBoard access={bergenEditor} data={bergenData} locale="no" />
    );

    const text = container.textContent;
    const divider = text.indexOf("Fra Hele BISO");
    expect(divider).toBeGreaterThan(text.indexOf(OWN_TILE));
    expect(divider).toBeLessThan(text.indexOf(NATIONAL_TILE));
    expect(itemLink("national-tile").textContent).toContain(NATIONAL_TILE);
  });

  test("offers an add link per section", async () => {
    await mount(
      <BenefitBoard access={bergenEditor} data={bergenData} locale="no" />
    );

    const hrefs = addLinks().map((link) => link.getAttribute("href"));
    expect(hrefs).toHaveLength(5);
    expect(hrefs).toContain("/benefits/new?campus=2&section=career");
    expect(container.textContent).not.toContain(READ_ONLY_NOTE);
  });

  test("lets own items move only where there is something to swap", async () => {
    await mount(
      <BenefitBoard
        access={bergenEditor}
        data={bergenWithTwoTiles}
        locale="no"
      />
    );

    // The single career line has nothing to trade places with, and the Hele
    // BISO item belongs to another tab.
    expect(dragHandleLabels()).toEqual([
      `Flytt «${OWN_TILE}»`,
      `Flytt «${SECOND_TILE}»`,
    ]);
    expect(container.textContent).toContain("Dra for å endre rekkefølgen.");
    expect(reorderCalls).toHaveLength(0);
  });

  test("never shows ids or raw values on the board", async () => {
    await mount(
      <BenefitBoard access={bergenEditor} data={bergenData} locale="no" />
    );

    const text = container.textContent;
    for (const raw of [
      "own-tile",
      "career-line",
      "national-tile",
      "partner-loft",
      "health_fitness",
      "published",
    ]) {
      expect(text).not.toContain(raw);
    }
  });

  test("a read-only tab has no add links, no handles and says why", async () => {
    await mount(
      <BenefitBoard
        access={bergenViewer}
        data={{ ...bergenWithTwoTiles, editable: false }}
        locale="no"
      />
    );

    expect(addLinks()).toHaveLength(0);
    expect(container.textContent).toContain(READ_ONLY_NOTE);
    expect(dragHandleLabels()).toEqual([]);
    expect(container.textContent).not.toContain("Dra for å endre");
    expect(itemLink("own-tile").textContent).toContain(OWN_TILE);
  });
});
