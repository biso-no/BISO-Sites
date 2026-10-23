import type { Block, PageDoc, Section } from "@repo/editor/types";

/**
 * A v2 page that uses every redesigned block, every section background and
 * every column layout once. `/design-system/page-blocks` renders it through the
 * real `RenderedPage`, so it is the place to check the page editor's visual
 * language against what the public site produces.
 *
 * Images are files already in `public/`; no binaries are added for it.
 */
const OSLO = "/images/campus/oslo.png";
const BERGEN = "/images/campus/bergen.png";
const STAVANGER = "/images/campus/stavanger.png";
const TRONDHEIM = "/images/campus/trondheim.png";
const HERO = "/images/hero-bg.png";
const BUSINESS = "/images/business-hotspot.png";
const GROUP_PHOTO = "/images/bedrift.png";

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

export const PAGE_BLOCKS_FIXTURE: PageDoc = {
  version: 2,
  meta: {
    accentColor: "#3DA9E0",
    department: "",
    description: "Alle blokkene i sidebyggeren, samlet på én side.",
    slug: "design-system/page-blocks",
    status: "draft",
    title: "Vinterleker på Storefjell",
  },
  header: {
    variant: "split",
    crumbs: [
      { label: "Hjem", href: "/" },
      { label: "Arrangementer", href: "/events" },
      { label: "Vinterleker" },
    ],
    eyebrow: "BISO Winter Games 2027",
    title: "Vinterleker på Storefjell",
    lede: "Tre dager med konkurranser, hytteliv og nye venner. Alle studenter fra BI er velkomne, uansett campus og skinivå.",
    buttons: [
      { label: "Meld deg på", href: "/events", style: "primary" },
      { label: "Se programmet", href: "#program", style: "secondary" },
    ],
    media: {
      kind: "image",
      src: GROUP_PHOTO,
      alt: "Studenter samlet utenfor hytta etter en dag i bakken",
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
          title: "Det største studentarrangementet i vinter",
          intro:
            "Winter Games samler over fire hundre studenter fra Oslo, Bergen, Stavanger og Trondheim.",
          size: "large",
        },
        {
          id: "b-intro-text",
          type: "text",
          body: [
            { type: "h", text: "Slik ble det til" },
            {
              type: "p",
              text: "Det begynte som en tur for én fadderkomité. I dag er Winter Games BISOs fremste møtested på tvers av campus, og i år reiser vi til Storefjell for tredje gang.",
            },
            { type: "h3", text: "Dette får du" },
            { type: "li", text: "Overnatting i hytte med fullpensjon" },
            { type: "li", text: "Heldagspass i alpinbakken" },
            { type: "li", text: "Quiz, kveldsarrangement og premieutdeling" },
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
            src: OSLO,
            alt: "Oslo-gjengen på vei opp til heisen",
            caption: "Oslo-laget åpner konkurransen fredag formiddag.",
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
                text: "Fredag er ankomstdag med felles middag. Lørdag går i bakken og avsluttes med festmiddag. Søndag er det brunsj, premieutdeling og buss hjem.",
              },
            ],
          },
        ],
        [
          {
            id: "b-program-facts",
            type: "facts",
            items: [
              { label: "Dato", text: "12.–14. februar 2027" },
              { label: "Sted", text: "Storefjell Resort & Spa, Gol" },
              { label: "Pris", text: "2 450 kr for medlemmer" },
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
            title: "Påmeldingen stenger 20. januar",
            body: "Det er begrenset med plasser, og vi fyller opp i den rekkefølgen dere melder dere på.",
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
          text: "Jeg kom alene fra Trondheim og dro hjem med en vennegjeng fra hele landet.",
          author: "Ingrid Solberg",
          role: "Deltaker 2026, BI Trondheim",
        },
      ],
      [
        {
          id: "b-dark-stats",
          type: "stats",
          items: [
            { num: "420", label: "deltakere i fjor" },
            { num: "4", label: "campus samlet" },
            { num: "3", label: "dager på fjellet" },
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
            title: "Sikre deg plassen på Winter Games",
            text: "Billetten inkluderer overnatting, mat og heiskort. Pris og program finner du under.",
            buttons: [
              { label: "Meld deg på", href: "/events", style: "primary" },
              { label: "Spør oss", href: "/contact", style: "secondary" },
            ],
          },
        ],
      ]
    ),

    // White, 1-2: heading and highlights beside a collage.
    section("s-gallery", { background: "white", columns: "1-2" }, [
      [
        {
          id: "b-gallery-heading",
          type: "heading",
          eyebrow: "Fra fjor",
          title: "Bilder fra Storefjell",
          intro: "Et utvalg fra de siste to årene.",
          size: "medium",
        },
        {
          id: "b-gallery-highlights",
          type: "highlights",
          items: [
            { text: "Sosiale konkurranser på tvers av campus" },
            { text: "Skiopplæring for dem som aldri har stått på ski" },
            { text: "Hyttekveld med quiz og premier" },
          ],
        },
      ],
      [
        {
          id: "b-gallery-collage",
          type: "gallery",
          layout: "collage",
          images: [
            { src: BERGEN, alt: "Bergen-laget i bakken" },
            { src: STAVANGER, alt: "Stavanger-laget feirer etter staffetten" },
            { src: TRONDHEIM, alt: "Trondheim-laget på hyttetrappa" },
            { src: BUSINESS, alt: "Studenter som jobber med en caseoppgave" },
          ],
        },
      ],
    ]),

    // Tinted, three columns: one callout per tone.
    section("s-tones", { background: "tinted", columns: "1-1-1" }, [
      [
        {
          id: "b-tone-info",
          type: "callout",
          tone: "info",
          title: "Transport",
          body: "Bussen går fra Oslo S fredag klokken 12.",
        },
      ],
      [
        {
          id: "b-tone-tip",
          type: "callout",
          tone: "tip",
          title: "Ta med",
          body: "Skiklær, badetøy og gode sko til hyttekvelden.",
        },
      ],
      [
        {
          id: "b-tone-warn",
          type: "callout",
          tone: "warn",
          title: "Husk",
          body: "Du må være medlem i BISO for å få medlemspris.",
        },
      ],
    ]),

    // White, one column: video in two styles, then a button row.
    section("s-video", { background: "white", columns: "1" }, [
      [
        {
          id: "b-video-featured",
          type: "video",
          style: "featured",
          ratio: "16/9",
          url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          poster: GROUP_PHOTO,
          label: "Film fra Winter Games 2026",
          caption: "Tre dager på fjellet i tre minutter.",
        },
        {
          id: "b-video-inline",
          type: "video",
          style: "inline",
          ratio: "21/9",
          url: "https://vimeo.com/76979871",
          poster: OSLO,
          caption: "Velkommen fra komiteen.",
        },
        {
          id: "b-video-buttons",
          type: "buttons",
          align: "center",
          items: [
            { label: "Meld deg på", href: "/events", style: "primary" },
            { label: "Les vilkårene", href: "/terms", style: "secondary" },
          ],
        },
      ],
    ]),

    // Tinted, four columns of narrow blocks.
    section("s-narrow", { background: "tinted", columns: "1-1-1-1" }, [
      [
        {
          id: "b-narrow-facts",
          type: "facts",
          items: [
            { label: "Start", text: "Fredag 14:00" },
            { label: "Slutt", text: "Søndag 15:00" },
          ],
        },
      ],
      [
        {
          id: "b-narrow-stats",
          type: "stats",
          items: [
            { num: "12", label: "lag" },
            { num: "8", label: "øvelser" },
          ],
        },
      ],
      [
        {
          id: "b-narrow-highlights",
          type: "highlights",
          items: [{ text: "Fullpensjon" }, { text: "Heiskort inkludert" }],
        },
      ],
      [
        {
          id: "b-narrow-buttons",
          type: "buttons",
          align: "start",
          items: [
            { label: "Påmelding", href: "/events", style: "primary" },
            { label: "Program", href: "#program", style: "secondary" },
          ],
        },
      ],
    ]),
  ],
};
