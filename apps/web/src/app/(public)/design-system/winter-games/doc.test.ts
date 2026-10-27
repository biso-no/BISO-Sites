import { collectPageFeedRequests, pageFeedKey } from "@repo/editor/page-feeds";
import { allBlocks, normalizePageDoc, walkBlocks } from "@repo/editor/render";
import { pruneEmptyFeedBlocks } from "@repo/editor/serialize";
import type { Block, PageDoc } from "@repo/editor/types";
import { describe, expect, test, vi } from "vitest";
import { winterGamesDoc } from "./doc";
import media from "./media.json";

vi.mock("server-only", () => ({}));

type Locale = "no" | "en";
const LOCALES: Locale[] = ["no", "en"];

// ── Expected copy ────────────────────────────────────────────────────────────
// Typed out from the spec ("The Winter Games page", Norwegian) and the Task 3
// brief (English, C10), never read back from the builder. The two "about"
// paragraphs are the approved mockup's text, which the spec names by phrase.

const INSTAGRAM = "https://www.instagram.com/bisowintergames/";
const HANDLE = "@bisowintergames";

const INTRO: Record<Locale, string> = {
  no: "BISOs største nasjonale studentarrangement. Tre dager på Storefjell med studenter fra BI Oslo, Bergen, Trondheim og Stavanger.",
  en: "BISO's biggest national student event. Three days at Storefjell with students from BI Oslo, Bergen, Trondheim and Stavanger.",
};

const WATCH: Record<Locale, string> = {
  no: "Se aftermovien",
  en: "Watch the aftermovie",
};

const CRUMBS: Record<Locale, string[]> = {
  no: ["Prosjekter", "Winter Games"],
  en: ["Projects", "Winter Games"],
};

const STATS: Record<Locale, { label: string; num: string }[]> = {
  no: [
    { num: "4", label: "campuser samlet på ett fjell" },
    { num: "3", label: "dager på Storefjell" },
    { num: "Alt", label: "inkludert: transport, overnatting og måltider" },
  ],
  en: [
    { num: "4", label: "campuses together on one mountain" },
    { num: "3", label: "days at Storefjell" },
    { num: "All", label: "included: transport, accommodation and meals" },
  ],
};

const ABOUT: Record<Locale, string[]> = {
  no: [
    "Winter Games skal være en felles møteplass for studenter på tvers av campus, studier og årskull. Her møter du folk du kanskje ellers aldri ville blitt kjent med, enten du reiser med venner eller vil bli kjent med nye.",
    "Arrangementet gjennomføres tradisjonelt på høyfjellet, og har de siste årene blitt arrangert på Storefjell Resort Hotel på Golsfjellet i Hallingdal.",
  ],
  en: [
    "Winter Games is a shared meeting place for students across campuses, programmes and years. You meet people you might never have got to know otherwise, whether you travel with friends or want to make new ones.",
    "The event traditionally takes place in the mountains, and in recent years it has been held at Storefjell Resort Hotel on Golsfjellet in Hallingdal.",
  ],
};

const FACTS: Record<Locale, { label: string; text: string }[]> = {
  no: [
    { label: "Hvor", text: "Storefjell Resort Hotel, Golsfjellet" },
    {
      label: "Hvem",
      text: "Studenter fra BI Oslo, Bergen, Trondheim og Stavanger",
    },
    { label: "Varighet", text: "Tre dager" },
    { label: "Inkludert", text: "Transport, overnatting og måltider" },
  ],
  en: [
    { label: "Where", text: "Storefjell Resort Hotel, Golsfjellet" },
    {
      label: "Who",
      text: "Students from BI Oslo, Bergen, Trondheim and Stavanger",
    },
    { label: "Length", text: "Three days" },
    { label: "Included", text: "Transport, accommodation and meals" },
  ],
};

const EVENTS_HEADING: Record<Locale, string> = {
  no: "Kommende arrangementer",
  en: "Upcoming events",
};

const CARDS: Record<Locale, { body: string; title: string }[]> = {
  no: [
    {
      title: "Vinterleker og lagkonkurranser",
      body: "Konkurranser laget for engasjement, lagfølelse og god stemning. Du trenger verken være erfaren på ski eller spesielt konkurranseinnstilt.",
    },
    {
      title: "Ski og vinteraktiviteter",
      body: "Dagene fylles med ski og aktiviteter på fjellet, sammen med studenter fra hele landet.",
    },
    {
      title: "Afterski, konserter og DJs",
      body: "Kveldene byr på afterski, konserter, DJs, temakvelder og andre sosiale aktiviteter.",
    },
  ],
  en: [
    {
      title: "Winter games and team competitions",
      body: "Competitions built for engagement, team spirit and a great atmosphere. You don't need to be an experienced skier or especially competitive.",
    },
    {
      title: "Skiing and winter activities",
      body: "The days are filled with skiing and activities in the mountains, together with students from all over the country.",
    },
    {
      title: "Afterski, concerts and DJs",
      body: "The evenings bring afterski, concerts, DJs, theme nights and other social activities.",
    },
  ],
};

/** Strings that must appear as whole values somewhere in the document. */
const STRINGS: Record<Locale, string[]> = {
  no: [
    ...CRUMBS.no,
    "Nasjonalt prosjekt",
    "Winter Games",
    INTRO.no,
    WATCH.no,
    HANDLE,
    "Om Winter Games",
    "En møteplass på tvers av campus",
    ...ABOUT.no,
    "Aftermovie",
    "Winter Games 2026",
    "Tre dager, alt på ett sted",
    "Det som gjør Winter Games spesielt, er kombinasjonen av aktivitetene, stemningen og menneskene.",
    EVENTS_HEADING.no,
    "Kontakt",
    "Teamet bak Winter Games",
    "Følg eventyret",
    "Se mer på Instagram",
  ],
  en: [
    ...CRUMBS.en,
    "National project",
    "Winter Games",
    INTRO.en,
    WATCH.en,
    HANDLE,
    "About Winter Games",
    "A meeting place across campuses",
    ...ABOUT.en,
    "Aftermovie",
    "Winter Games 2026",
    "Three days, all in one place",
    "What makes Winter Games special is the combination of the activities, the atmosphere and the people.",
    EVENTS_HEADING.en,
    "Contact",
    "The team behind Winter Games",
    "Follow the adventure",
    "See more on Instagram",
  ],
};

const TEAM = [
  {
    name: "Emma Martinsen",
    no: "Prosjektleder",
    en: "Project manager",
    email: "manager.wintergames@biso.no",
  },
  {
    name: "Jørn Valaker",
    no: "Sikkerhetsansvarlig",
    en: "Head of safety",
    email: "security.wintergames@biso.no",
  },
  {
    name: "Sanne Skaarup",
    no: "Event manager, dagsprogram og vinterleker",
    en: "Event manager, day programme and winter games",
    email: "program.wintergames@biso.no",
  },
  {
    name: "Julie Leonie Finberg",
    no: "Event manager, kveldsprogram og artister",
    en: "Event manager, evening programme and artists",
    email: "entertainment.wintergames@biso.no",
  },
  {
    name: "Noemi Kudla",
    no: "Logistikkansvarlig, operasjonell",
    en: "Logistics manager, operations",
    email: "operations.wintergames@biso.no",
  },
  {
    name: "Emily Guldvog",
    no: "Logistikkansvarlig, billett",
    en: "Logistics manager, tickets",
    email: "logistics.wintergames@biso.no",
  },
  {
    name: "Marielle Brenden",
    no: "PR- og kommunikasjonsansvarlig",
    en: "PR and communications manager",
    email: "communication.wintergames@biso.no",
  },
  {
    name: "Filip Riise",
    no: "Økonomi- og forretningsansvarlig",
    en: "Finance and business manager",
    email: "finance.wintergames@biso.no",
  },
] as const;

/** Norwegian words the English page must not contain (brief, step 1). */
const NORWEGIAN_WORDS = [
  "Prosjekter",
  "campuser",
  "dager",
  "Kontakt",
  "Følg",
  "arrangementer",
];

const PHONE_DIGITS = /(?:\d[\s.-]?){7}\d/;
const COUNTRY_CODE = /\+\s*47/;
const NORWEGIAN_LETTERS = /[æøå]/i;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Every string value in the document, at any depth. */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringsOf);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(stringsOf);
  }
  return [];
}

function blocksOf<T extends Block["type"]>(
  doc: PageDoc,
  type: T
): Extract<Block, { type: T }>[] {
  return walkBlocks(doc).filter(
    (block): block is Extract<Block, { type: T }> => block.type === type
  );
}

function only<T extends Block["type"]>(
  doc: PageDoc,
  type: T
): Extract<Block, { type: T }> {
  const found = blocksOf(doc, type);
  expect(found, `one ${type} block`).toHaveLength(1);
  return found[0] as Extract<Block, { type: T }>;
}

// ── Structure ────────────────────────────────────────────────────────────────

/**
 * Sections 2–10 of the spec, as columns of block types. Section 1 is the page
 * header. The cards, the team's eyebrow and title, and the aftermovie's title
 * are Heading blocks because those blocks carry no eyebrow or heading of
 * their own; the events block carries its own heading, so it leaves with it.
 */
const SPEC_SECTIONS: string[][][] = [
  [["stats"]],
  [["heading", "text"], ["facts"]],
  [["heading", "video"]],
  [["heading", "cards"]],
  [["quote"]],
  [["gallery"]],
  [["events"]],
  [["heading", "team"]],
  [["ctaBand"]],
];

describe.each(LOCALES)("winterGamesDoc(%s)", (locale) => {
  const doc = winterGamesDoc(locale);

  test("the header and sections follow the spec's order and block types", () => {
    expect(doc.version).toBe(2);
    expect(doc.header?.variant).toBe("split");
    const shape = doc.sections.map((section) =>
      section.columns.map((column) => column.blocks.map((b) => b.type))
    );
    expect(shape).toEqual(SPEC_SECTIONS);
  });

  test("the about section is two columns, wide on the left", () => {
    expect(doc.sections[1]?.layout.columns).toBe("2-1");
  });

  test("the aftermovie and the call to action sit on dark sections", () => {
    expect(doc.sections[2]?.layout.background).toBe("dark");
    expect(doc.sections[8]?.layout.background).toBe("dark");
  });

  test("meta: slug, no department yet, national campus, title and description", () => {
    expect(doc.meta).toEqual({
      campus: "5",
      department: "",
      description: INTRO[locale],
      slug: "projects/winter-games",
      status: "draft",
      title: "Winter Games",
    });
  });

  test("there is no theme key", () => {
    expect("theme" in doc.meta).toBe(false);
  });

  test("normalizePageDoc leaves the document as it is", () => {
    expect(normalizePageDoc(doc)).toStrictEqual(doc);
  });

  test("the sanitizer the save action uses leaves the document as it is", async () => {
    const { sanitizePageDocHtml } = await import("@repo/editor/sanitize");
    expect(sanitizePageDocHtml(doc)).toStrictEqual(doc);
  });

  test("every block type is in the registry", () => {
    const registered = new Set(allBlocks().map((def) => def.type));
    for (const block of walkBlocks(doc)) {
      expect(registered.has(block.type), block.type).toBe(true);
    }
  });

  test("each call builds a fresh tree, so a caller's edits never leak", () => {
    const pristine = structuredClone(winterGamesDoc(locale));
    const first = winterGamesDoc(locale);
    only(first, "stats").items[0] = { label: "changed", num: "0" };
    only(first, "facts").items.pop();
    expect(winterGamesDoc(locale)).toStrictEqual(pristine);
  });

  test("block, column and section ids are unique", () => {
    const ids = doc.sections.flatMap((section) => [
      section.id,
      ...section.columns.flatMap((column) => [
        column.id,
        ...column.blocks.map((block) => block.id),
      ]),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ── Copy ───────────────────────────────────────────────────────────────────

  test("every expected string appears verbatim", () => {
    const strings = stringsOf(doc);
    for (const expected of STRINGS[locale]) {
      expect(strings, expected).toContain(expected);
    }
  });

  test("the header: crumbs, eyebrow, title, intro and buttons", () => {
    const header = doc.header;
    expect(header?.crumbs.map((crumb) => crumb.label)).toEqual(CRUMBS[locale]);
    expect(header?.crumbs[0]?.href).toBe("/projects");
    expect(header?.crumbs[1]?.href).toBeUndefined();
    expect(header?.title).toBe("Winter Games");
    expect(header?.lede).toBe(INTRO[locale]);
    expect(header?.buttons).toEqual([
      { href: "#aftermovie", label: WATCH[locale], style: "primary" },
      { href: INSTAGRAM, label: HANDLE, style: "secondary" },
    ]);
  });

  test("the stats, facts and cards pair their copy as written", () => {
    expect(only(doc, "stats").items).toEqual(STATS[locale]);
    expect(only(doc, "facts").items).toEqual(FACTS[locale]);
    expect(
      only(doc, "cards").items.map(({ body, title }) => ({ body, title }))
    ).toEqual(CARDS[locale]);
  });

  test("the about text is the two paragraphs, in order", () => {
    expect(only(doc, "text").body).toEqual(
      ABOUT[locale].map((text) => ({ text, type: "p" }))
    );
  });

  test("the quote has no attribution", () => {
    const quote = only(doc, "quote");
    expect(quote.author).toBe("");
    expect(quote.role).toBe("");
  });

  // ── Anchors and links ──────────────────────────────────────────────────────

  test("the aftermovie section has its anchor, and the header button points to it", () => {
    const target = doc.sections.find((s) => s.anchor === "aftermovie");
    expect(target).toBeDefined();
    expect(
      target?.columns.some((c) => c.blocks.some((b) => b.type === "video"))
    ).toBe(true);
    expect(doc.header?.buttons[0]?.href).toBe("#aftermovie");
  });

  test("the call to action links to Instagram", () => {
    const band = only(doc, "ctaBand");
    expect(band.buttons).toEqual([
      { href: INSTAGRAM, label: HANDLE, style: "primary" },
    ]);
  });

  // ── Media ──────────────────────────────────────────────────────────────────

  test("the header media is the muted loop with its poster", () => {
    expect(doc.header?.media).toEqual({
      alt: "",
      fileId: media["header-loop"].fileId,
      kind: "video",
      mime: "video/mp4",
      poster: media["header-poster"].url,
      posterFileId: media["header-poster"].fileId,
      posterMime: "image/jpeg",
      src: media["header-loop"].url,
    });
  });

  test("the aftermovie is the featured web encode with its poster", () => {
    const video = only(doc, "video");
    expect(video.style).toBe("featured");
    expect(video.url).toBe(media.aftermovie.url);
    expect(video.fileId).toBe(media.aftermovie.fileId);
    expect(video.poster).toBe(media["aftermovie-poster"].url);
    expect(video.posterFileId).toBe(media["aftermovie-poster"].fileId);
    expect(video.posterMime).toBe("image/jpeg");
  });

  test("the cards and the gallery use their stills, in the spec's order", () => {
    expect(only(doc, "cards").items.map((item) => item.image?.src)).toEqual([
      media["card-vinterleker"].url,
      media["card-ski"].url,
      media["card-afterski"].url,
    ]);
    const gallery = only(doc, "gallery");
    expect(gallery.layout).toBe("collage");
    expect(gallery.images.map((image) => image.src)).toEqual([
      media["gallery-aerial"].url,
      media["gallery-selfie"].url,
      media["gallery-friends"].url,
      media["gallery-teepees"].url,
      media["gallery-arrival"].url,
    ]);
  });

  test("every still has alt text", () => {
    const stills = [
      ...only(doc, "cards").items.map((item) => item.image),
      ...only(doc, "gallery").images,
    ];
    expect(stills).toHaveLength(8);
    for (const still of stills) {
      expect(still?.alt?.trim().length, still?.src).toBeGreaterThan(0);
      expect(still?.fileId, still?.src).toBeTruthy();
      expect(still?.mime).toBe("image/jpeg");
    }
  });

  test("every media URL is one from the manifest", () => {
    const urls = new Set(Object.values(media).map((entry) => entry.url));
    const used = stringsOf(doc).filter((s) => s.startsWith("https://appwrite"));
    expect(used.length).toBeGreaterThan(0);
    for (const url of used) {
      expect(urls.has(url), url).toBe(true);
    }
  });

  // ── Live blocks ────────────────────────────────────────────────────────────

  test("the events block follows the page's department", () => {
    const events = only(doc, "events");
    expect(events.heading).toBe(EVENTS_HEADING[locale]);
    // Bound once the seed sets the unit: the feed asks for that department.
    const bound: PageDoc = {
      ...doc,
      meta: { ...doc.meta, department: "wintergames-unit" },
    };
    const requests = collectPageFeedRequests(bound, locale).filter(
      (request) => request.kind === "events"
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.department).toBe("wintergames-unit");
  });

  test("the events block is hidden while the unit has no events (C8)", () => {
    const bound: PageDoc = {
      ...doc,
      meta: { ...doc.meta, department: "wintergames-unit" },
    };
    const key = pageFeedKey("events", "wintergames-unit", locale, 3);
    const pruned = pruneEmptyFeedBlocks(bound, { [key]: [] }, locale);
    expect(blocksOf(pruned, "events")).toHaveLength(0);
    // Unbound (the preview), the block has no department and is dropped too.
    expect(
      blocksOf(pruneEmptyFeedBlocks(doc, {}, locale), "events")
    ).toHaveLength(0);
  });

  // ── People ─────────────────────────────────────────────────────────────────

  test("the team is the eight people, manual, with role emails and no photos", () => {
    const team = only(doc, "team");
    expect(team.source).toBe("manual");
    expect(team.showContact).toBe(true);
    expect(team.members).toEqual(
      TEAM.map((person) => ({
        email: person.email,
        name: person.name,
        role: person[locale],
      }))
    );
  });

  test("the team's emails are exactly the eight from the spec", () => {
    expect(only(doc, "team").members.map((member) => member.email)).toEqual(
      TEAM.map((person) => person.email)
    );
  });

  test("no string anywhere looks like a phone number", () => {
    for (const value of [...stringsOf(doc), JSON.stringify(doc)]) {
      expect(value).not.toMatch(PHONE_DIGITS);
      expect(value).not.toMatch(COUNTRY_CODE);
    }
    for (const member of only(doc, "team").members) {
      expect("phone" in member).toBe(false);
    }
  });
});

// ── Between the two languages ────────────────────────────────────────────────

describe("the English page", () => {
  const en = winterGamesDoc("en");
  const no = winterGamesDoc("no");

  test("contains none of the Norwegian words", () => {
    const text = stringsOf(en).join("\n").toLowerCase();
    for (const word of NORWEGIAN_WORDS) {
      expect(text, word).not.toContain(word.toLowerCase());
    }
  });

  test("uses æ, ø or å only in people's names", () => {
    const names = new Set<string>(TEAM.map((person) => person.name));
    for (const value of stringsOf(en)) {
      if (NORWEGIAN_LETTERS.test(value)) {
        expect(names.has(value), value).toBe(true);
      }
    }
  });

  test("has its own alt text for every still", () => {
    const alts = (doc: PageDoc) => [
      ...only(doc, "cards").items.map((item) => item.image?.alt),
      ...only(doc, "gallery").images.map((image) => image.alt),
    ];
    const english = alts(en);
    const norwegian = alts(no);
    for (const [i, alt] of english.entries()) {
      expect(alt).not.toBe(norwegian[i]);
    }
  });

  test("shares the Norwegian page's structure, ids and media", () => {
    const skeleton = (doc: PageDoc) =>
      doc.sections.map((section) => ({
        anchor: section.anchor,
        columns: section.columns.map((column) => ({
          blocks: column.blocks.map((block) => [block.id, block.type]),
          id: column.id,
        })),
        id: section.id,
        layout: section.layout,
      }));
    expect(skeleton(en)).toEqual(skeleton(no));
    const urls = (doc: PageDoc) =>
      stringsOf(doc).filter((s) => s.startsWith("https://appwrite"));
    expect(urls(en)).toEqual(urls(no));
  });
});
