import { type PageFeedSnapshot, pageFeedKey } from "@repo/editor/page-feeds";
import type { Block, PageDoc, Section } from "@repo/editor/types";

/**
 * A v2 page that uses every redesigned block, every section background and
 * every column layout once. `/design-system/page-blocks` renders it through the
 * real `RenderedPage`, so it is the place to check the page editor's visual
 * language against what the public site produces.
 *
 * Images are files already in `public/`; no binaries are added for it. The
 * copy is about a career fair because that is what the photos show (BI's
 * campus buildings, a handshake at a fair stand, a sketch of a lounge), and
 * every alt text describes its image. The collage has five images so its big
 * tile, which has its own cut rule, is exercised.
 *
 * The fair is made up, so every button links to an anchor on this page, never
 * to a real sign-up or terms page, and the page says it is sample content.
 */
const OSLO = "/images/campus/oslo.png";
const BERGEN = "/images/campus/bergen.png";
const STAVANGER = "/images/campus/stavanger.png";
const TRONDHEIM = "/images/campus/trondheim.png";
const HERO = "/images/hero-bg.png";
const LOUNGE_SKETCH = "/images/business-hotspot.png";
const FAIR_PHOTO = "/images/bedrift.png";

type SectionOptions = Pick<Section["layout"], "background" | "columns"> &
  Partial<Section["layout"]>;

function section(
  id: string,
  options: SectionOptions,
  columns: Block[][],
  anchor?: string
): Section {
  return {
    id,
    anchor,
    layout: {
      align: "top",
      hideOnPhone: false,
      phoneReverse: false,
      spacing: "normal",
      tablet: "row",
      ...options,
    },
    columns: columns.map((blocks, index) => ({
      id: `${id}-c${index + 1}`,
      blocks,
    })),
  };
}

/** The made-up department the live blocks below read from. */
const FAIR_DEPARTMENT = "karrieredagene";

/**
 * Feed rows for the events, news and jobs blocks, keyed the way the blocks
 * read them. Every link is an anchor on this page, never a real route.
 */
export const PAGE_BLOCKS_FEEDS: PageFeedSnapshot = {
  [pageFeedKey("events", FAIR_DEPARTMENT, "no", 3)]: [
    {
      category: "career",
      date: "10. nov.",
      going: 0,
      href: "#program",
      id: "fx-event-1",
      image: FAIR_PHOTO,
      startsAt: "2026-11-10T08:00:00.000Z",
      ticketUrl: "https://example.com/pamelding",
      title: "Karrieredagene: åpning og standrunde",
      where: "BI Nydalen, Oslo",
    },
    {
      category: "workshop",
      date: "11. nov.",
      going: 0,
      href: "#program",
      id: "fx-event-2",
      image: OSLO,
      memberOnly: true,
      startsAt: "2026-11-11T09:30:00.000Z",
      title: "CV-verksted med bedriftene",
      where: "BI Nydalen, Oslo",
    },
    {
      date: "12. nov.",
      going: 0,
      href: "#program",
      id: "fx-event-3",
      startsAt: "2026-11-12T16:00:00.000Z",
      title: "Etterfest for utstillerne",
      where: "Studentpuben",
    },
  ],
  [pageFeedKey("news", FAIR_DEPARTMENT, "no", 3)]: [
    {
      department: "Karrieredagene",
      href: "#program",
      id: "fx-news-1",
      image: LOUNGE_SKETCH,
      publishedAt: "3. nov. 2026",
      publishedAtIso: "2026-11-03T09:00:00.000Z",
      summary:
        "Programmet er klart, og 64 bedrifter står på standlisten. Her er det du bør vite før du kommer.",
      title: "Programmet for Karrieredagene er klart",
    },
    {
      department: "Karrieredagene",
      href: "#program",
      id: "fx-news-2",
      image: BERGEN,
      publishedAt: "28. okt. 2026",
      publishedAtIso: "2026-10-28T09:00:00.000Z",
      summary:
        "Studenter fra Bergen, Stavanger og Trondheim får reisen dekket.",
      title: "Gratis reise for alle campus",
    },
    {
      department: "Karrieredagene",
      href: "#program",
      id: "fx-news-3",
      image: HERO,
      publishedAt: "20. okt. 2026",
      publishedAtIso: "2026-10-20T09:00:00.000Z",
      summary: "",
      title: "Slik forbereder du deg til standrunden",
    },
  ],
  [pageFeedKey("jobs", FAIR_DEPARTMENT, "no", 3)]: [
    {
      commitment: "",
      deadline: "1. des. 2026",
      deadlineIso: "2026-12-01T10:00:00.000Z",
      department: "Karrieredagene",
      employmentType: "Frivillig",
      href: "#program",
      id: "fx-job-1",
      paid: false,
      title: "Standvert",
    },
    {
      commitment: "",
      deadline: "1. des. 2026",
      deadlineIso: "2026-12-01T10:00:00.000Z",
      department: "Karrieredagene",
      employmentType: "Deltid",
      href: "#program",
      id: "fx-job-2",
      paid: true,
      title: "Prosjektleder for Karrieredagene 2027",
    },
    {
      commitment: "",
      deadline: "",
      department: "Karrieredagene",
      href: "#program",
      id: "fx-job-3",
      title: "Medlem av programkomiteen",
    },
  ],
};

export const PAGE_BLOCKS_FIXTURE: PageDoc = {
  version: 2,
  meta: {
    accentColor: "#3DA9E0",
    department: "",
    description: "Alle blokkene i sidebyggeren, samlet på én side.",
    slug: "design-system/page-blocks",
    status: "draft",
    title: "Karrieredagene i Nydalen",
  },
  header: {
    variant: "split",
    crumbs: [
      { label: "Hjem", href: "/" },
      { label: "Arrangementer", href: "/events" },
      { label: "Karrieredagene" },
    ],
    eyebrow: "BISO Karrieredagene 2027",
    title: "Karrieredagene i Nydalen",
    lede: "To dager med bedriftsstander, foredrag og intervjuer på stedet. Alle studenter fra BI er velkomne, uansett campus og studieretning.",
    buttons: [
      { label: "Meld deg på", href: "#pamelding", style: "primary" },
      { label: "Se programmet", href: "#program", style: "secondary" },
    ],
    media: {
      kind: "image",
      src: FAIR_PHOTO,
      alt: "En student håndhilser på en representant ved EYs stand på en karrieremesse",
    },
  },
  sections: [
    // White, one column: heading, rich text, divider.
    section("s-intro", { background: "white", columns: "1" }, [
      [
        {
          id: "b-intro-heading",
          type: "heading",
          eyebrow: "Om arrangementet",
          title: "Den største karrieremessen for BI-studenter",
          intro:
            "Karrieredagene samler over seksti bedrifter og studenter fra Oslo, Bergen, Stavanger og Trondheim.",
          size: "large",
        },
        {
          id: "b-intro-text",
          type: "text",
          body: [
            { type: "h", text: "Slik ble det til" },
            {
              type: "p",
              text: "Det begynte som en stand-dag i kantina. I dag er Karrieredagene BISOs største møteplass mellom studenter og arbeidsliv, og i år arrangeres messen for tredje gang.",
            },
            { type: "h3", text: "Dette får du" },
            { type: "li", text: "Samtaler med over seksti bedrifter" },
            { type: "li", text: "Gratis gjennomgang av CV-en din" },
            {
              type: "li",
              text: "Foredrag, bedriftspresentasjoner og mingling",
            },
          ],
        },
        { id: "b-intro-divider", type: "divider", spacing: "small" },
      ],
    ]),

    // Tinted, two columns 2-1: image and text beside facts and callout.
    section(
      "s-program",
      { background: "tinted", columns: "2-1" },
      [
        [
          {
            id: "b-program-image",
            type: "image",
            src: LOUNGE_SKETCH,
            alt: "Skisse av en lounge med lenestoler, ståbord, planter og lette gardiner, med håndskrevne merknader",
            caption: "Skisse av loungen der intervjuene holdes.",
            frame: "chevron",
            lean: "left",
            ratio: "3/2",
          },
          {
            id: "b-program-text",
            type: "text",
            body: [
              { type: "h", text: "Programmet" },
              {
                type: "p",
                text: "Torsdag står bedriftene på stand hele dagen, med foredrag i auditoriet. Fredag er satt av til intervjuer og CV-hjelp, og dagen avsluttes med mingling.",
              },
            ],
          },
        ],
        [
          {
            id: "b-program-facts",
            type: "facts",
            items: [
              { label: "Dato", text: "11.–12. februar 2027" },
              { label: "Sted", text: "BI Nydalen, Oslo" },
              { label: "Pris", text: "Gratis for studenter" },
              {
                label: "Kontakt",
                text: "events@biso.no",
                href: "mailto:events@biso.no",
              },
            ],
          },
          {
            id: "b-program-callout",
            type: "callout",
            tone: "warn",
            title: "Påmeldingen til intervjuer stenger 20. januar",
            body: "Det er begrenset med intervjutider, og vi fordeler dem i den rekkefølgen dere melder dere på.",
          },
        ],
      ],
      "program"
    ),

    // Dark, two equal columns: quote beside stats.
    section("s-dark", { background: "dark", columns: "1-1" }, [
      [
        {
          id: "b-dark-quote",
          type: "quote",
          text: "Jeg kom for å se meg rundt og dro hjem med en sommerjobb.",
          author: "Ingrid Solberg",
          role: "Deltaker 2026, BI Trondheim",
        },
      ],
      [
        {
          id: "b-dark-stats",
          type: "stats",
          items: [
            { num: "64", label: "bedrifter i fjor" },
            { num: "4", label: "campus samlet" },
            { num: "2", label: "dager med messe" },
          ],
        },
      ],
    ]),

    // Photo background with a call to action.
    section(
      "s-photo",
      {
        background: "photo",
        columns: "1",
        spacing: "roomy",
        align: "middle",
        backgroundImage: {
          src: HERO,
          alt: "",
        },
      },
      [
        [
          {
            id: "b-photo-cta",
            type: "ctaBand",
            eyebrow: "Bli med",
            title: "Sikre deg plass på Karrieredagene",
            text: "Påmeldingen er gratis og gir deg tilgang til stands, foredrag og intervjuer. Programmet står lenger opp på siden, og praktisk informasjon følger rett under.",
            buttons: [
              { label: "Meld deg på", href: "#praktisk", style: "primary" },
              { label: "Spør oss", href: "#program", style: "secondary" },
            ],
          },
        ],
      ],
      "pamelding"
    ),

    // Tinted, three columns: one callout per tone.
    section(
      "s-tones",
      { background: "tinted", columns: "1-1-1" },
      [
        [
          {
            id: "b-tone-info",
            type: "callout",
            tone: "info",
            title: "Reise",
            body: "Bor du utenfor Oslo, dekker vi flybilletten. Søk innen 10. januar.",
          },
        ],
        [
          {
            id: "b-tone-tip",
            type: "callout",
            tone: "tip",
            title: "Ta med",
            body: "CV på papir og noen spørsmål du vil stille bedriftene.",
          },
        ],
        [
          {
            id: "b-tone-warn",
            type: "callout",
            tone: "warn",
            title: "Husk",
            body: "Du må være medlem i BISO for å melde deg på intervjuer.",
          },
        ],
      ],
      "praktisk"
    ),

    // White, 1-2: heading and highlights beside a collage.
    section("s-gallery", { background: "white", columns: "1-2" }, [
      [
        {
          id: "b-gallery-heading",
          type: "heading",
          eyebrow: "Fire campus",
          title: "Én messe for hele BI",
          intro:
            "Messen holdes i Oslo, og studenter fra Bergen, Stavanger og Trondheim får reisen dekket.",
          size: "medium",
          // A link draws the marker under the title.
          link: { href: "#program", label: "Se programmet" },
        },
        {
          id: "b-gallery-highlights",
          type: "highlights",
          items: [
            { text: "Bedrifter fra finans, konsulent og teknologi" },
            { text: "Gratis reise for studenter utenfor Oslo" },
            { text: "Intervjuer på stedet for sommerjobb og trainee" },
          ],
        },
      ],
      [
        {
          id: "b-gallery-collage",
          type: "gallery",
          layout: "collage",
          images: [
            {
              src: OSLO,
              alt: "BI-bygget i Nydalen i Oslo, med glassfasader og BI-logoer, en sommerdag",
            },
            {
              src: BERGEN,
              alt: "BI-bygget i Bergen ved sjøkanten, med fasade i betong og mørkt treverk",
            },
            {
              src: STAVANGER,
              alt: "Nye bygg med grønne tak ved sjøen i Stavanger, sett fra lufta",
            },
            {
              src: TRONDHEIM,
              alt: "BI-bygget i Trondheim ved kaia, med båter og speilbilde i vannet",
            },
            {
              src: FAIR_PHOTO,
              alt: "En student håndhilser på en representant ved EYs stand på en karrieremesse",
            },
          ],
        },
      ],
    ]),

    // White right after white, so the hairline between them shows. One
    // column: video in two styles, then a button row.
    section("s-video", { background: "white", columns: "1" }, [
      [
        {
          id: "b-video-featured",
          type: "video",
          style: "featured",
          ratio: "21/9",
          url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          poster: FAIR_PHOTO,
          label: "Film fra Karrieredagene 2026",
          caption: "To dager på messen på tre minutter.",
        },
        {
          id: "b-video-inline",
          type: "video",
          style: "inline",
          ratio: "16/9",
          url: "https://vimeo.com/76979871",
          poster: OSLO,
          caption: "Velkommen fra komiteen.",
        },
        {
          id: "b-video-buttons",
          type: "buttons",
          align: "center",
          items: [
            { label: "Meld deg på", href: "#pamelding", style: "primary" },
            { label: "Les vilkårene", href: "#praktisk", style: "secondary" },
          ],
        },
      ],
    ]),

    // Tinted, one column: the three live feed blocks, with the rows above.
    section("s-live", { background: "tinted", columns: "1" }, [
      [
        {
          id: "b-live-events",
          type: "events",
          heading: "På programmet",
          limit: 3,
          seeAll: true,
          source: FAIR_DEPARTMENT,
        },
        {
          id: "b-live-news",
          type: "news",
          heading: "Siste nytt",
          limit: 3,
          seeAll: true,
          source: FAIR_DEPARTMENT,
        },
        {
          id: "b-live-jobs",
          type: "jobs",
          heading: "Bli med i komiteen",
          limit: 3,
          seeAll: true,
          source: FAIR_DEPARTMENT,
        },
      ],
    ]),

    // Tinted, four columns of narrow blocks. A long compound and an email
    // address, neither with a break opportunity, check that narrow columns
    // wrap them instead of overflowing.
    section("s-narrow", { background: "tinted", columns: "1-1-1-1" }, [
      [
        {
          id: "b-narrow-heading",
          type: "heading",
          eyebrow: "",
          title: "Samarbeidspartnere",
          intro: "",
          size: "medium",
        },
        {
          id: "b-narrow-facts",
          type: "facts",
          items: [
            { label: "Start", text: "Torsdag 10:00" },
            { label: "Slutt", text: "Fredag 16:00" },
            { label: "E-post", text: "communication.wintergames@biso.no" },
          ],
        },
      ],
      [
        {
          id: "b-narrow-stats",
          type: "stats",
          items: [
            { num: "64", label: "stands" },
            { num: "18", label: "foredrag" },
          ],
        },
      ],
      [
        {
          id: "b-narrow-highlights",
          type: "highlights",
          items: [{ text: "Gratis inngang" }, { text: "Lunsj inkludert" }],
        },
      ],
      [
        {
          id: "b-narrow-buttons",
          type: "buttons",
          align: "start",
          items: [
            { label: "Påmelding", href: "#pamelding", style: "primary" },
            { label: "Program", href: "#program", style: "secondary" },
          ],
        },
      ],
    ]),
  ],
};
