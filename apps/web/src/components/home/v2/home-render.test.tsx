import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The front page rendered with the real message bundles.
 *
 * `home.test.ts` guards the design rules in the source; this renders the
 * campus overview (Branding Committee, batch G) and checks what a visitor
 * gets: the sections, their scoping, the member rule — and that every key
 * the page asks for exists in both bundles, which `t()` would otherwise paper
 * over by printing the key path.
 */
const MESSAGES = join(
  import.meta.dirname,
  "../../../../../../packages/i18n/messages"
);
const NAMESPACES = [
  "about",
  "common",
  "events",
  "home",
  "jobs",
  "membership",
  "units",
];

const state = vi.hoisted(() => ({
  errors: [] as string[],
  locale: "en" as "en" | "no",
  messages: {} as Record<string, unknown>,
}));
const board = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: state.locale,
      messages: state.messages,
      namespace: namespace as never,
      onError: (error) => {
        state.errors.push(error.message);
      },
    }),
}));
vi.mock("@/lib/data/unit-board", () => ({ cachedUnitBoard: board }));

import { HomeV2, type HomeV2Props } from "./home-v2";

function bundle(locale: "en" | "no"): Record<string, unknown> {
  return Object.fromEntries(
    NAMESPACES.map((namespace) => [
      namespace,
      JSON.parse(
        readFileSync(join(MESSAGES, locale, `${namespace}.json`), "utf8")
      ),
    ])
  );
}

/**
 * Awaits the async Server Components in the tree, which `react-dom/server`
 * cannot render, and leaves everything else to it.
 */
async function resolve(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) {
    return await Promise.all(node.map(resolve));
  }
  if (!isValidElement(node)) {
    return node;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  const { type } = element;
  if (typeof type === "function" && type.constructor.name === "AsyncFunction") {
    const render = type as (props: unknown) => Promise<ReactNode>;
    return await resolve(await render(element.props));
  }
  if (element.props && "children" in element.props) {
    const children = await resolve(element.props.children);
    return cloneElement(
      element,
      undefined,
      ...(Array.isArray(children) ? children : [children])
    );
  }
  return element;
}

const EMPTY: HomeV2Props = {
  campus: null,
  counts: { departmentCount: 0, eventCount: 0, jobCount: 0 },
  events: [],
  focusAreas: [],
  isMember: false,
  jobs: [],
  joinItems: null,
  leadership: { campusId: "5", teamHref: null },
  locale: "en",
  news: [],
  partners: [],
  scopeCampusId: null,
  units: [],
};

const BERGEN: Partial<HomeV2Props> = {
  campus: { id: "2", name: "Bergen" },
  counts: { departmentCount: 12, eventCount: 3, jobCount: 1 },
  events: [
    {
      $id: "e1",
      category: "party",
      image: null,
      location: "Bergen",
      member_only: true,
      slug: "fest",
      start_date: "2026-11-01T18:00:00.000Z",
      ticket_url: null,
      translation_refs: [{ locale: "en", title: "Semesterfest" }],
    } as never,
  ],
  jobs: [
    {
      $id: "j1",
      application_deadline: "2026-10-20T21:59:00.000Z",
      department: { $id: "301", Name: "Bergen Ledelse" },
      metadata: { employment_type: null, paid: true },
      slug: "leder",
      translations: [{ locale: "en", title: "Leder" }],
    } as never,
  ],
  leadership: { campusId: "2", teamHref: "/units/bergen/ledelse" },
  partners: [
    {
      $id: "p1",
      image_url: "https://biso.no/partner.png",
      name: "Partner",
      url: "https://example.com",
    } as never,
  ],
  scopeCampusId: "2",
  units: [
    {
      campusId: "2",
      campusLabel: "Bergen",
      category: "staff_function",
      graphName: "Bergen Ledelse",
      href: "/units/bergen/ledelse",
      id: "301",
      logoUrl: null,
      name: "Ledelse",
      summary: null,
    } as never,
  ],
};

const people = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    email: `person${i}@biso.no`,
    imageUrl: null,
    name: `Person ${i}`,
    role: "Styremedlem",
  }));

async function render(
  props: Partial<HomeV2Props>,
  locale: "en" | "no" = "en"
): Promise<string> {
  state.locale = locale;
  state.messages = bundle(locale);
  const tree = await resolve(await HomeV2({ ...EMPTY, ...props, locale }));
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={state.messages}>
      {tree}
    </NextIntlClientProvider>
  );
}

const H1 = /<h1[\s>]/g;

describe("the front page as the campus overview", () => {
  beforeEach(() => {
    state.errors = [];
    board.mockReset();
    board.mockResolvedValue(people(8));
  });

  it.each([
    "en",
    "no",
  ] as const)("renders every section from real copy in %s", async (locale) => {
    const html = await render(BERGEN, locale);
    expect(html.match(H1)).toHaveLength(1);
    for (const id of ["about", "leadership", "jobs", "units", "join"]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(state.errors).toEqual([]);
  });

  it("names the campus and keeps every listing link on it", async () => {
    const html = await render(BERGEN);
    expect(html).toContain("Bergen");
    for (const path of ["/events", "/news", "/jobs", "/units"]) {
      expect(html).toContain(`href="${path}?campus=bergen"`);
      expect(html).not.toContain(`href="${path}"`);
    }
    expect(html).toContain('href="/campus/bergen"');
  });

  it("asks a member to the portal rather than to join", async () => {
    const html = await render({ ...BERGEN, isMember: true });
    expect(html).toContain('href="/member"');
    expect(html).not.toContain('href="/membership"');
    expect(html).not.toContain('id="join"');
  });

  it("lists a members-only event and marks it", async () => {
    const html = await render(BERGEN);
    expect(html).toContain("Semesterfest");
    expect(html).toContain("Members Only");
  });

  it("leads to the whole board only when there is more of it", async () => {
    // No unit cards, so the management unit's link can only be the board's.
    const noUnits = { ...BERGEN, units: [] };
    expect(await render(noUnits)).toContain('href="/units/bergen/ledelse"');
    board.mockResolvedValue(people(3));
    const html = await render(noUnits);
    expect(html).toContain('id="leadership"');
    expect(html).not.toContain('href="/units/bergen/ledelse"');
  });

  it("drops the leadership section, not the page, when the directory fails", async () => {
    board.mockRejectedValue(new Error("Graph timeout"));
    const html = await render(BERGEN);
    expect(html).not.toContain('id="leadership"');
    expect(html).toContain('id="about"');
  });

  it("omits every section whose source is empty", async () => {
    board.mockResolvedValue([]);
    const html = await render(EMPTY);
    for (const id of ["leadership", "jobs", "units"]) {
      expect(html, id).not.toContain(`id="${id}"`);
    }
    // No figures at all rather than three zeros.
    expect(html).not.toContain("<dl");
    expect(state.errors).toEqual([]);
  });
});
