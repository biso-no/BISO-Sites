// Starting layouts for pages the admin app creates on a unit's behalf. Pure:
// no React, no store — safe to import from a server action.
//
// A template is a plain page header over a list of single-column sections of
// ordinary blocks, so the board edits or removes anything it does not want.
// The point is that a new page is never a blank canvas: a project board
// opening its page for the first time sees where the programme, the gallery
// and the company pitch go.

import { emptyHeader } from "../header/empty-header";
import { emptyBlock } from "./operations";

// The admin seeds a new page's blank document with it (`blankPageDoc`).
export { emptyHeader } from "../header/empty-header";

import { sectionOf } from "./sections";
import type { Block, EditorLocale, PageHeader, Section } from "./types";

export type UnitPageKind = "project" | "unit";

export interface UnitPageTemplateInput {
  /** "Oslo", "National"… or null when the campus is unknown. */
  campusLabel: string | null;
  kind: UnitPageKind;
  locale: EditorLocale;
  /** Display name, campus prefix already stripped. */
  name: string;
}

interface TemplateCopy {
  about: (name: string) => string;
  aboutBody: string;
  companies: string;
  companiesBody: string;
  contact: string;
  events: string;
  subtitle: string;
}

const COPY: Record<EditorLocale, TemplateCopy> = {
  en: {
    about: (name) => `About ${name}`,
    aboutBody:
      "Tell new students what you do, when it happens and why they should join.",
    companies: "For companies",
    companiesBody:
      "Describe how a company can take part, sponsor or meet students here.",
    contact: "Get in touch",
    events: "Upcoming events",
    subtitle: "One sentence about what you do.",
  },
  no: {
    about: (name) => `Om ${name}`,
    aboutBody:
      "Fortell nye studenter hva dere gjør, når det skjer og hvorfor de bør bli med.",
    companies: "For bedrifter",
    companiesBody:
      "Beskriv hvordan en bedrift kan delta, sponse eller møte studenter her.",
    contact: "Ta kontakt",
    events: "Kommende arrangementer",
    subtitle: "Én setning om hva dere gjør.",
  },
};

function header(input: UnitPageTemplateInput, copy: TemplateCopy): PageHeader {
  return {
    ...emptyHeader(input.name),
    eyebrow: input.campusLabel ? `BISO ${input.campusLabel}` : "BISO",
    lede: copy.subtitle,
  };
}

/**
 * Plain text made safe for a text block's body, which is HTML: `&`, `<` and
 * `>` escaped as a browser serializes them, so both sanitizers keep it as is.
 */
function htmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function text(heading: string, paragraph: string): Block {
  const block = emptyBlock("text");
  if (block.type === "text") {
    block.body = [
      { text: heading, type: "h" },
      { text: paragraph, type: "p" },
    ];
  }
  return block;
}

function events(copy: TemplateCopy): Block {
  const block = emptyBlock("events");
  if (block.type === "events") {
    block.heading = copy.events;
    // "auto" binds the feed to the page's department, so the block shows the
    // unit's own published events without the board setting anything up.
    block.source = "auto";
    block.items = [];
  }
  return block;
}

function contact(input: UnitPageTemplateInput, copy: TemplateCopy): Block {
  const block = emptyBlock("contact");
  if (block.type === "contact") {
    block.heading = copy.contact;
    block.email = "";
    block.instagram = "";
    block.address = input.campusLabel ?? "";
    block.hours = "";
  }
  return block;
}

/**
 * What a freshly created unit page starts with: a plain header carrying the
 * unit's name and campus, over sections of one block each.
 */
export function unitPageTemplate(input: UnitPageTemplateInput): {
  header: PageHeader;
  sections: Section[];
} {
  const copy = COPY[input.locale];
  // The name comes from the accounting system: text, not markup.
  const about = text(copy.about(htmlText(input.name)), copy.aboutBody);

  const blocks: Block[] =
    input.kind === "unit"
      ? [about, events(copy), contact(input, copy)]
      : [
          about,
          events(copy),
          emptyBlock("gallery"),
          text(copy.companies, copy.companiesBody),
          contact(input, copy),
        ];

  return {
    header: header(input, copy),
    sections: blocks.map((b) => sectionOf(b)),
  };
}
