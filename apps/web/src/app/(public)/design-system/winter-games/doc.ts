import type {
  Block,
  CardItem,
  FactItem,
  GalleryImage,
  PageDoc,
  Section,
  StatItem,
  TeamMember,
} from "@repo/editor/types";
import media from "./media.json";

/**
 * The Winter Games project page (spec D12, "The Winter Games page"), one
 * document per locale. Pure: no React and no data access, so the preview
 * routes and the seed script (`scripts/winter-games/seed-draft.ts`) both build
 * it.
 *
 * The Norwegian copy is the approved mockup's
 * (`winter-games-page-v3.html`); the English is hand-written (C10). Both
 * share every id, layout and media file, so the two drafts differ only in
 * their text.
 *
 * `meta.department` is empty here. The seed sets it to the national
 * Wintergames unit, and the events block (`source: "auto"`) follows the page's
 * department, so that one field binds the feed too. While it is empty (the
 * preview) the block has nothing to read and the page drops it.
 *
 * The arena photo is in the manifest but not on the page: the mockup places
 * it nowhere.
 */

export type WinterGamesLocale = "no" | "en";

const INSTAGRAM = "https://www.instagram.com/bisowintergames/";
const HANDLE = "@bisowintergames";
const AFTERMOVIE_ANCHOR = "aftermovie";
const SECONDS_PER_MINUTE = 60;

type MediaKey = keyof typeof media;

interface Copy {
  about: { eyebrow: string; paragraphs: [string, string]; title: string };
  aftermovie: { eyebrow: string; title: string };
  /** Alt text per still, describing what is in the frame. */
  alt: Record<StillKey, string>;
  cards: Record<CardStill, { body: string; title: string }>;
  cardsHeading: string;
  crumbs: [string, string];
  cta: { eyebrow: string; title: string };
  events: string;
  facts: FactItem[];
  header: { eyebrow: string; lede: string; watch: string };
  quote: string;
  roles: Record<PersonEmail, string>;
  stats: StatItem[];
  team: { eyebrow: string; title: string };
}

type StillKey =
  | "card-vinterleker"
  | "card-ski"
  | "card-afterski"
  | "gallery-aerial"
  | "gallery-selfie"
  | "gallery-friends"
  | "gallery-teepees"
  | "gallery-arrival";

const CARD_STILLS = [
  "card-vinterleker",
  "card-ski",
  "card-afterski",
] as const satisfies readonly StillKey[];

type CardStill = (typeof CARD_STILLS)[number];

/** The collage's big tile is the first: the aerial view at dusk. */
const GALLERY_STILLS = [
  "gallery-aerial",
  "gallery-selfie",
  "gallery-friends",
  "gallery-teepees",
  "gallery-arrival",
] as const satisfies readonly StillKey[];

/** The team, in the spec's order. Role emails only (C9): no phone numbers. */
const PEOPLE = [
  { email: "manager.wintergames@biso.no", name: "Emma Martinsen" },
  { email: "security.wintergames@biso.no", name: "Jørn Valaker" },
  { email: "program.wintergames@biso.no", name: "Sanne Skaarup" },
  { email: "entertainment.wintergames@biso.no", name: "Julie Leonie Finberg" },
  { email: "operations.wintergames@biso.no", name: "Noemi Kudla" },
  { email: "logistics.wintergames@biso.no", name: "Emily Guldvog" },
  { email: "communication.wintergames@biso.no", name: "Marielle Brenden" },
  { email: "finance.wintergames@biso.no", name: "Filip Riise" },
] as const;

type PersonEmail = (typeof PEOPLE)[number]["email"];

const COPY: Record<WinterGamesLocale, Copy> = {
  no: {
    crumbs: ["Prosjekter", "Winter Games"],
    header: {
      eyebrow: "Nasjonalt prosjekt",
      lede: "BISOs største nasjonale studentarrangement. Tre dager på Storefjell med studenter fra BI Oslo, Bergen, Trondheim og Stavanger.",
      watch: "Se aftermovien",
    },
    stats: [
      { num: "4", label: "campuser samlet på ett fjell" },
      { num: "3", label: "dager på Storefjell" },
      { num: "Alt", label: "inkludert: transport, overnatting og måltider" },
    ],
    about: {
      eyebrow: "Om Winter Games",
      title: "En møteplass på tvers av campus",
      paragraphs: [
        "Winter Games skal være en felles møteplass for studenter på tvers av campus, studier og årskull. Her møter du folk du kanskje ellers aldri ville blitt kjent med, enten du reiser med venner eller vil bli kjent med nye.",
        "Arrangementet gjennomføres tradisjonelt på høyfjellet, og har de siste årene blitt arrangert på Storefjell Resort Hotel på Golsfjellet i Hallingdal.",
      ],
    },
    facts: [
      { label: "Hvor", text: "Storefjell Resort Hotel, Golsfjellet" },
      {
        label: "Hvem",
        text: "Studenter fra BI Oslo, Bergen, Trondheim og Stavanger",
      },
      { label: "Varighet", text: "Tre dager" },
      { label: "Inkludert", text: "Transport, overnatting og måltider" },
    ],
    aftermovie: { eyebrow: "Aftermovie", title: "Winter Games 2026" },
    cardsHeading: "Tre dager, alt på ett sted",
    cards: {
      "card-vinterleker": {
        title: "Vinterleker og lagkonkurranser",
        body: "Konkurranser laget for engasjement, lagfølelse og god stemning. Du trenger verken være erfaren på ski eller spesielt konkurranseinnstilt.",
      },
      "card-ski": {
        title: "Ski og vinteraktiviteter",
        body: "Dagene fylles med ski og aktiviteter på fjellet, sammen med studenter fra hele landet.",
      },
      "card-afterski": {
        title: "Afterski, konserter og DJs",
        body: "Kveldene byr på afterski, konserter, DJs, temakvelder og andre sosiale aktiviteter.",
      },
    },
    quote:
      "Det som gjør Winter Games spesielt, er kombinasjonen av aktivitetene, stemningen og menneskene.",
    events: "Kommende arrangementer",
    team: { eyebrow: "Kontakt", title: "Teamet bak Winter Games" },
    roles: {
      "manager.wintergames@biso.no": "Prosjektleder",
      "security.wintergames@biso.no": "Sikkerhetsansvarlig",
      "program.wintergames@biso.no":
        "Event manager, dagsprogram og vinterleker",
      "entertainment.wintergames@biso.no":
        "Event manager, kveldsprogram og artister",
      "operations.wintergames@biso.no": "Logistikkansvarlig, operasjonell",
      "logistics.wintergames@biso.no": "Logistikkansvarlig, billett",
      "communication.wintergames@biso.no": "PR- og kommunikasjonsansvarlig",
      "finance.wintergames@biso.no": "Økonomi- og forretningsansvarlig",
    },
    cta: { eyebrow: "Følg eventyret", title: "Se mer på Instagram" },
    alt: {
      "card-vinterleker":
        "Studenter i fargerike retro-skidresser jubler med knyttnevene i været ved et sperrebånd i snøen",
      "card-ski":
        "En skiløper kjører gjennom en oppblåsbar portal i bakken mens tilskuere står langs løypa, sett fra lufta",
      "card-afterski":
        "En artist i blå fotballdrakt med nummer 8 på scenen, sett bakfra, foran et fullsatt publikum i lilla lys og røyk",
      "gallery-aerial":
        "Hotellet og tre snødekte lavvoer på fjellet i skumringen, sett fra lufta",
      "gallery-selfie":
        "En student i gul lue og rød jakke tar en selfie i solskinnet på fjellet",
      "gallery-friends":
        "To venninner ler mot kameraet på festen, og den ene peker",
      "gallery-teepees":
        "Tre store lavvoer, en tømmerhytte og leilighetsbygg i snøen, sett fra lufta",
      "gallery-arrival":
        "Studenter med kofferter og bager går gjennom snøen i kveldsmørket når de ankommer",
    },
  },
  en: {
    crumbs: ["Projects", "Winter Games"],
    header: {
      eyebrow: "National project",
      lede: "BISO's biggest national student event. Three days at Storefjell with students from BI Oslo, Bergen, Trondheim and Stavanger.",
      watch: "Watch the aftermovie",
    },
    stats: [
      { num: "4", label: "campuses together on one mountain" },
      { num: "3", label: "days at Storefjell" },
      { num: "All", label: "included: transport, accommodation and meals" },
    ],
    about: {
      eyebrow: "About Winter Games",
      title: "A meeting place across campuses",
      paragraphs: [
        "Winter Games is a shared meeting place for students across campuses, programmes and years. You meet people you might never have got to know otherwise, whether you travel with friends or want to make new ones.",
        "The event traditionally takes place in the mountains, and in recent years it has been held at Storefjell Resort Hotel on Golsfjellet in Hallingdal.",
      ],
    },
    facts: [
      { label: "Where", text: "Storefjell Resort Hotel, Golsfjellet" },
      {
        label: "Who",
        text: "Students from BI Oslo, Bergen, Trondheim and Stavanger",
      },
      { label: "Length", text: "Three days" },
      { label: "Included", text: "Transport, accommodation and meals" },
    ],
    aftermovie: { eyebrow: "Aftermovie", title: "Winter Games 2026" },
    cardsHeading: "Three days, all in one place",
    cards: {
      "card-vinterleker": {
        title: "Winter games and team competitions",
        body: "Competitions built for engagement, team spirit and a great atmosphere. You don't need to be an experienced skier or especially competitive.",
      },
      "card-ski": {
        title: "Skiing and winter activities",
        body: "The days are filled with skiing and activities in the mountains, together with students from all over the country.",
      },
      "card-afterski": {
        title: "Afterski, concerts and DJs",
        body: "The evenings bring afterski, concerts, DJs, theme nights and other social activities.",
      },
    },
    quote:
      "What makes Winter Games special is the combination of the activities, the atmosphere and the people.",
    events: "Upcoming events",
    team: { eyebrow: "Contact", title: "The team behind Winter Games" },
    roles: {
      "manager.wintergames@biso.no": "Project manager",
      "security.wintergames@biso.no": "Head of safety",
      "program.wintergames@biso.no":
        "Event manager, day programme and winter games",
      "entertainment.wintergames@biso.no":
        "Event manager, evening programme and artists",
      "operations.wintergames@biso.no": "Logistics manager, operations",
      "logistics.wintergames@biso.no": "Logistics manager, tickets",
      "communication.wintergames@biso.no": "PR and communications manager",
      "finance.wintergames@biso.no": "Finance and business manager",
    },
    cta: { eyebrow: "Follow the adventure", title: "See more on Instagram" },
    alt: {
      "card-vinterleker":
        "Students in bright retro ski suits cheer with raised fists at a barrier tape in the snow",
      "card-ski":
        "A skier passes through an inflatable arch on the slope while spectators line the course, seen from the air",
      "card-afterski":
        "A performer in a blue football shirt with the number 8 on stage, seen from behind, facing a packed crowd in purple light and haze",
      "gallery-aerial":
        "The hotel and three snow-covered teepees on the mountain at dusk, seen from the air",
      "gallery-selfie":
        "A student in a yellow beanie and a red jacket takes a selfie in the sunshine on the mountain",
      "gallery-friends":
        "Two friends laugh into the camera at the party, one of them pointing",
      "gallery-teepees":
        "Three large teepees, a log cabin and apartment buildings in the snow, seen from the air",
      "gallery-arrival":
        "Students with suitcases and bags walk through the snow in the evening dark as they arrive",
    },
  },
};

/** "1:18" for 78 seconds: the length pill on the aftermovie's poster. */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function file(key: MediaKey): { fileId: string; mime: string; src: string } {
  const entry = media[key];
  return { fileId: entry.fileId, mime: entry.mime, src: entry.url };
}

function still(key: StillKey, copy: Copy): GalleryImage {
  return { alt: copy.alt[key], ...file(key) };
}

type SectionOptions = Pick<Section["layout"], "background" | "columns"> &
  Partial<Section["layout"]>;

function section(
  id: string,
  options: SectionOptions,
  columns: Block[][],
  anchor?: string
): Section {
  return {
    ...(anchor ? { anchor } : {}),
    columns: columns.map((blocks, index) => ({
      blocks,
      id: `${id}-c${index + 1}`,
    })),
    id,
    layout: {
      align: "top",
      hideOnPhone: false,
      phoneReverse: false,
      spacing: "normal",
      tablet: "row",
      ...options,
    },
  };
}

function heading(
  id: string,
  eyebrow: string,
  title: string,
  size: "small" | "medium"
): Block {
  return { eyebrow, id, intro: "", size, title, type: "heading" };
}

function sections(copy: Copy): Section[] {
  const aftermovie = media.aftermovie;
  const poster = file("aftermovie-poster");
  const cards: CardItem[] = CARD_STILLS.map((key) => ({
    ...copy.cards[key],
    image: still(key, copy),
  }));
  const members: TeamMember[] = PEOPLE.map(({ email, name }) => ({
    email,
    name,
    role: copy.roles[email],
  }));

  return [
    // 2. Three figures under the header.
    section(
      "s-wg-stats",
      { background: "white", columns: "1", spacing: "tight" },
      [[{ id: "b-wg-stats", items: copy.stats, type: "stats" }]]
    ),

    // 3. About, wide on the left; the facts beside it.
    section("s-wg-about", { background: "white", columns: "2-1" }, [
      [
        heading(
          "b-wg-about-heading",
          copy.about.eyebrow,
          copy.about.title,
          "medium"
        ),
        {
          body: copy.about.paragraphs.map((text) => ({ text, type: "p" })),
          id: "b-wg-about-text",
          type: "text",
        },
      ],
      [{ id: "b-wg-facts", items: copy.facts, type: "facts" }],
    ]),

    // 4. The aftermovie: a poster and a play button until it is clicked, so
    // nothing loads before then and nothing plays with sound on its own.
    section(
      "s-wg-aftermovie",
      { background: "dark", columns: "1" },
      [
        [
          heading(
            "b-wg-aftermovie-heading",
            copy.aftermovie.eyebrow,
            copy.aftermovie.title,
            "medium"
          ),
          {
            caption: "",
            fileId: aftermovie.fileId,
            id: "b-wg-aftermovie",
            label: formatDuration(aftermovie.durationSeconds),
            poster: poster.src,
            posterFileId: poster.fileId,
            posterMime: poster.mime,
            ratio: "16/9",
            style: "featured",
            type: "video",
            url: aftermovie.url,
          },
        ],
      ],
      AFTERMOVIE_ANCHOR
    ),

    // 5. Three cards with aftermovie stills.
    section("s-wg-cards", { background: "white", columns: "1" }, [
      [
        heading("b-wg-cards-heading", "", copy.cardsHeading, "small"),
        {
          columns: 3,
          id: "b-wg-cards",
          items: cards,
          layout: "grid",
          style: "plain",
          type: "cards",
        },
      ],
    ]),

    // 6. The quote, without attribution.
    section("s-wg-quote", { background: "white", columns: "1" }, [
      [
        {
          author: "",
          id: "b-wg-quote",
          role: "",
          text: copy.quote,
          type: "quote",
        },
      ],
    ]),

    // 7. Five stills; the first is the collage's big tile.
    section("s-wg-gallery", { background: "white", columns: "1" }, [
      [
        {
          id: "b-wg-gallery",
          images: GALLERY_STILLS.map((key) => still(key, copy)),
          layout: "collage",
          type: "gallery",
        },
      ],
    ]),

    // 8. The unit's events. Hidden while there are none (C8).
    section("s-wg-events", { background: "white", columns: "1" }, [
      [
        {
          heading: copy.events,
          id: "b-wg-events",
          limit: 3,
          seeAll: false,
          source: "auto",
          type: "events",
        },
      ],
    ]),

    // 9. The team: initials (no photos), role emails (C9).
    section("s-wg-team", { background: "white", columns: "1" }, [
      [
        heading(
          "b-wg-team-heading",
          copy.team.eyebrow,
          copy.team.title,
          "medium"
        ),
        {
          heading: "",
          id: "b-wg-team",
          members,
          showContact: true,
          source: "manual",
          type: "team",
        },
      ],
    ]),

    // 10. Follow on Instagram.
    section("s-wg-follow", { background: "dark", columns: "1" }, [
      [
        {
          buttons: [{ href: INSTAGRAM, label: HANDLE, style: "primary" }],
          eyebrow: copy.cta.eyebrow,
          id: "b-wg-follow",
          text: "",
          title: copy.cta.title,
          type: "ctaBand",
        },
      ],
    ]),
  ];
}

/**
 * The Winter Games page in one locale, as an unbound draft. A fresh tree on
 * every call: the copy tables above are shared, so a caller that edits its
 * document (the seed binds the department) must not change the next one.
 */
export function winterGamesDoc(locale: WinterGamesLocale): PageDoc {
  const copy = COPY[locale];
  const loop = file("header-loop");
  const poster = file("header-poster");
  return structuredClone<PageDoc>({
    header: {
      buttons: [
        {
          href: `#${AFTERMOVIE_ANCHOR}`,
          label: copy.header.watch,
          style: "primary",
        },
        { href: INSTAGRAM, label: HANDLE, style: "secondary" },
      ],
      crumbs: [
        { href: "/projects", label: copy.crumbs[0] },
        { label: copy.crumbs[1] },
      ],
      eyebrow: copy.header.eyebrow,
      lede: copy.header.lede,
      // A muted loop; its poster stands in under reduced motion. The poster
      // is a stand-in for the video, so its alt is empty.
      media: {
        alt: "",
        fileId: loop.fileId,
        kind: "video",
        mime: loop.mime,
        poster: poster.src,
        posterFileId: poster.fileId,
        posterMime: poster.mime,
        src: loop.src,
      },
      title: "Winter Games",
      variant: "split",
    },
    meta: {
      campus: "5",
      department: "",
      description: copy.header.lede,
      slug: "projects/winter-games",
      status: "draft",
      title: "Winter Games",
    },
    sections: sections(copy),
    version: 2,
  });
}
