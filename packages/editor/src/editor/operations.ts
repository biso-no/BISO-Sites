// Pure document mutations. Every UI action and AI tool call goes through here.
// Takes an immer draft of PageDoc (or a WritableDraft via zustand/immer).

import { current, type Draft, isDraft } from "immer";
import { newId } from "./ids";
import { emptySection, resizeColumns } from "./sections";
import { findBlock, findColumn, findSection } from "./tree";
import type {
  Block,
  BlockType,
  Column,
  InsertTarget,
  PageDoc,
  PageHeader,
  PageMeta,
  SectionColumns,
  SectionLayout,
} from "./types";

export function emptyBlock(type: BlockType): Block {
  const id = newId("b");
  switch (type) {
    case "stats":
      return {
        id,
        type,
        items: [
          { num: "1", label: "Thing" },
          { num: "2", label: "Other" },
          { num: "3", label: "More" },
        ],
      };
    case "highlights":
      return {
        id,
        type,
        items: [
          { text: "A highlight worth remembering" },
          { text: "Another one" },
        ],
      };
    case "facts":
      return {
        id,
        type,
        items: [
          { label: "When", text: "Every Thursday" },
          { label: "Where", text: "Campus Oslo" },
        ],
      };
    case "divider":
      return { id, type, spacing: "medium" };
    case "text":
      return {
        id,
        type,
        body: [
          { type: "h", text: "Section heading" },
          { type: "p", text: "Tell the story like you'd tell a friend." },
        ],
      };
    case "heading":
      return {
        id,
        type,
        eyebrow: "",
        title: "A heading that names the section",
        intro: "",
        size: "medium",
      };
    case "quote":
      return {
        id,
        type,
        text: "Drop a line worth standing on its own.",
        author: "Someone",
        role: "Their role",
      };
    case "team":
      return {
        id,
        type,
        heading: "The team",
        members: [{ name: "Name", role: "Role", initials: "NN", hue: "blue" }],
      };
    case "events":
      return {
        id,
        type,
        heading: "Coming up",
        source: "auto",
        items: [
          { date: "Soon", title: "Event title", where: "Where", going: 0 },
        ],
      };
    case "faq":
      return {
        id,
        type,
        heading: "Questions",
        items: [{ q: "A question", a: "An answer." }],
      };
    case "contact":
      return {
        id,
        type,
        heading: "Find us",
        email: "team@biso.no",
        instagram: "@biso",
        address: "Campus",
        hours: "Mon–Fri",
      };
    case "callout":
      return {
        id,
        type,
        tone: "info",
        title: "Heads up",
        body: "Something worth flagging.",
      };
    case "image":
      return { id, type, caption: "", aspect: "16/9" };
    case "gallery":
      return { id, type, images: [] };
    case "video":
      return { id, type, caption: "" };
    case "cta":
      return {
        id,
        type,
        title: "Ready to jump in?",
        label: "Join the unit",
        url: "#",
      };
    case "marquee":
      return {
        id,
        type,
        text: "Tuesdays · Tromsø · Glögg · Buddies · Welcome week",
      };
    case "timeline":
      return {
        id,
        type,
        heading: "Our story",
        items: [{ year: "2024", text: "Founded." }],
      };
    case "twoCol":
      return {
        id,
        type,
        left: "Left column copy.",
        right: "Right column copy.",
      };
    case "signup":
      return {
        id,
        type,
        heading: "Stay in the loop",
        placeholder: "you@bi.no",
      };
    case "news":
      return { id, type, heading: "Latest news" };
    case "jobs":
      return { id, type, heading: "Open roles" };
    case "featureGrid":
      return {
        id,
        type,
        heading: "What we offer",
        columns: 3,
        variant: "cards",
        items: [
          {
            icon: "★",
            title: "Feature one",
            body: "Describe this benefit in one sentence.",
          },
          {
            icon: "◆",
            title: "Feature two",
            body: "Describe this benefit in one sentence.",
          },
          {
            icon: "●",
            title: "Feature three",
            body: "Describe this benefit in one sentence.",
          },
        ],
      };
    case "partners":
      return { id, type, heading: "Our partners", source: "auto" };
    case "linkTileGrid":
      return {
        id,
        type,
        heading: "Explore",
        items: [
          {
            icon: "→",
            title: "Page one",
            description: "Short description.",
            href: "#",
          },
          {
            icon: "→",
            title: "Page two",
            description: "Short description.",
            href: "#",
          },
          {
            icon: "→",
            title: "Page three",
            description: "Short description.",
            href: "#",
          },
        ],
      };
    case "tabs":
      return {
        id,
        type,
        variant: "underline",
        tabs: [
          { label: "Overview", body: "Overview content goes here." },
          { label: "Details", body: "Detailed content goes here." },
        ],
      };
    case "departmentGrid":
      return {
        id,
        type,
        heading: "Departments",
        showFilters: true,
        variant: "grid",
      };
    case "documents":
      return { id, type, heading: "Documents", items: [] };
    case "featuredCards":
      return {
        id,
        type,
        heading: "Featured",
        items: [
          {
            title: "Project one",
            body: "Short description.",
            stripeAccent: "#3DA9E0",
            eyebrow: "Featured",
          },
          {
            title: "Project two",
            body: "Short description.",
            stripeAccent: "#33566F",
          },
        ],
      };
    case "campusSelector":
      return { id, type, mode: "cards", heading: "Choose your campus" };
    case "stepGrid":
      return {
        id,
        type,
        heading: "How it works",
        items: [
          {
            number: "01",
            title: "First step",
            body: "Describe the first step.",
          },
          {
            number: "02",
            title: "Second step",
            body: "Describe the second step.",
          },
          {
            number: "03",
            title: "Third step",
            body: "Describe the third step.",
          },
        ],
      };
    case "scrollRow":
      return {
        id,
        type,
        heading: "Benefits",
        items: [
          { icon: "★", title: "Benefit one", body: "Short description." },
          { icon: "◆", title: "Benefit two", body: "Short description." },
          { icon: "●", title: "Benefit three", body: "Short description." },
          { icon: "▲", title: "Benefit four", body: "Short description." },
        ],
      };
    case "productGrid":
      return { id, type, heading: "Shop", source: "auto" };
    case "filterBar":
      return { id, type, target: "news" };
    case "profileHeader":
      return {
        id,
        type,
        heading: "My BISO",
        showAvatar: true,
        showStats: true,
      };
    case "multiStepForm":
      return {
        id,
        type,
        heading: "Get in touch",
        submitTarget: { collection: "submissions" },
        steps: [
          {
            title: "Your message",
            fields: [
              {
                name: "name",
                label: "Name",
                fieldType: "text",
                required: true,
              },
              {
                name: "email",
                label: "Email",
                fieldType: "email",
                required: true,
              },
              {
                name: "message",
                label: "Message",
                fieldType: "textarea",
                required: true,
              },
            ],
          },
        ],
      };
    default: {
      const exhaustive: never = type;
      throw new Error(`Unsupported block type: ${exhaustive}`);
    }
  }
}

/** Deep copy that also works on immer drafts (structuredClone throws on proxies). */
function cloneValue<T>(value: T): T {
  return structuredClone(
    isDraft(value) ? (current(value as Draft<T>) as T) : value
  );
}

function insertAt(column: Column, block: Block, beforeBlockId?: string): void {
  const index = beforeBlockId
    ? column.blocks.findIndex((b) => b.id === beforeBlockId)
    : -1;
  column.blocks.splice(index === -1 ? column.blocks.length : index, 0, block);
}

function clampIndex(doc: PageDoc, sectionIndex: number): number {
  return Math.max(0, Math.min(sectionIndex, doc.sections.length));
}

/** Insert a new block at `target`. Returns its id, or null if the column is missing. */
export function insertBlock(
  doc: PageDoc,
  type: BlockType,
  target: InsertTarget
): string | null {
  const found = findColumn(doc, target.columnId);
  if (!found) {
    return null;
  }
  const block = emptyBlock(type);
  insertAt(found.column, block, target.beforeBlockId);
  return block.id;
}

/** Insert a new block in a fresh one-column section at `sectionIndex`. */
export function insertBlockInNewSection(
  doc: PageDoc,
  type: BlockType,
  sectionIndex: number
): { blockId: string; sectionId: string } {
  const block = emptyBlock(type);
  const section = emptySection("1");
  section.columns[0].blocks.push(block);
  doc.sections.splice(clampIndex(doc, sectionIndex), 0, section);
  return { blockId: block.id, sectionId: section.id };
}

/** Remove a block by id. */
export function removeBlock(doc: PageDoc, blockId: string): void {
  const found = findBlock(doc, blockId);
  if (found) {
    found.column.blocks.splice(found.blockIndex, 1);
  }
}

/** Duplicate a block, inserting the copy immediately after. Returns new id. */
export function duplicateBlock(doc: PageDoc, blockId: string): string | null {
  const found = findBlock(doc, blockId);
  if (!found) {
    return null;
  }
  const copy = cloneValue(found.block);
  copy.id = newId("b");
  found.column.blocks.splice(found.blockIndex + 1, 0, copy);
  return copy.id;
}

/** Move a block to `target`. No-op if the target is the block itself or missing. */
export function moveBlock(
  doc: PageDoc,
  blockId: string,
  target: InsertTarget
): void {
  if (target.beforeBlockId === blockId) {
    return;
  }
  const dest = findColumn(doc, target.columnId);
  const src = findBlock(doc, blockId);
  if (!(dest && src)) {
    return;
  }
  const [block] = src.column.blocks.splice(src.blockIndex, 1);
  insertAt(dest.column, block, target.beforeBlockId);
}

/** Move a block into a fresh section at `sectionIndex`. Returns the new section id. */
export function moveBlockToNewSection(
  doc: PageDoc,
  blockId: string,
  sectionIndex: number
): string | null {
  const src = findBlock(doc, blockId);
  if (!src) {
    return null;
  }
  const [block] = src.column.blocks.splice(src.blockIndex, 1);
  const section = emptySection("1");
  section.columns[0].blocks.push(block);
  doc.sections.splice(clampIndex(doc, sectionIndex), 0, section);
  return section.id;
}

/** Insert an empty section at `sectionIndex`. Returns its id. */
export function insertSection(
  doc: PageDoc,
  columns: SectionColumns,
  sectionIndex: number
): string {
  const section = emptySection(columns);
  doc.sections.splice(clampIndex(doc, sectionIndex), 0, section);
  return section.id;
}

export function removeSection(doc: PageDoc, sectionId: string): void {
  const found = findSection(doc, sectionId);
  if (found) {
    doc.sections.splice(found.index, 1);
  }
}

/** Duplicate a section (fresh ids throughout), inserted right after. */
export function duplicateSection(
  doc: PageDoc,
  sectionId: string
): string | null {
  const found = findSection(doc, sectionId);
  if (!found) {
    return null;
  }
  const copy = cloneValue(found.section);
  copy.id = newId("s");
  copy.anchor = undefined;
  for (const column of copy.columns) {
    column.id = newId("c");
    for (const block of column.blocks) {
      block.id = newId("b");
    }
  }
  doc.sections.splice(found.index + 1, 0, copy);
  return copy.id;
}

/** Move a section before `beforeSectionId`, or to the end if omitted. */
export function moveSection(
  doc: PageDoc,
  sectionId: string,
  beforeSectionId?: string
): void {
  if (beforeSectionId === sectionId) {
    return;
  }
  const found = findSection(doc, sectionId);
  if (!found) {
    return;
  }
  if (beforeSectionId && !findSection(doc, beforeSectionId)) {
    return;
  }
  const [section] = doc.sections.splice(found.index, 1);
  const index = beforeSectionId
    ? doc.sections.findIndex((s) => s.id === beforeSectionId)
    : doc.sections.length;
  doc.sections.splice(index, 0, section);
}

export function setSectionLayout(
  doc: PageDoc,
  sectionId: string,
  patch: Partial<SectionLayout>
): void {
  const found = findSection(doc, sectionId);
  if (!found) {
    return;
  }
  const { columns, ...rest } = patch;
  Object.assign(found.section.layout, rest);
  if (columns) {
    resizeColumns(found.section, columns);
  }
}

const NON_SLUG_RUN = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const COMBINING_MARKS = /\p{M}+/gu;

/**
 * A section anchor from free text. Norwegian letters get their usual
 * spelling (æ → ae, ø → o, å → a) and any other accented letter loses its
 * accent ("Café møte" → "cafe-mote") rather than being dropped.
 */
export function slugifyAnchor(input: string): string {
  return input
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(NON_SLUG_RUN, "-")
    .replace(EDGE_DASHES, "");
}

/** Store a slugified anchor; an empty result removes it. */
export function setSectionAnchor(
  doc: PageDoc,
  sectionId: string,
  anchor: string
): void {
  const found = findSection(doc, sectionId);
  if (!found) {
    return;
  }
  const slug = slugifyAnchor(anchor);
  if (slug) {
    found.section.anchor = slug;
  } else {
    found.section.anchor = undefined;
  }
}

/**
 * Set `path` (dot-notation; a numeric part indexes an array) on `target`,
 * creating missing objects and arrays on the way.
 */
function setPath(target: object, path: string, value: unknown): void {
  const parts = path.split(".");
  let node = target as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = node[key];
    if (next === null || typeof next !== "object") {
      node[key] = Number.isNaN(Number(parts[i + 1])) ? {} : [];
    }
    node = node[key] as Record<string, unknown>;
  }
  const lastKey = parts.at(-1);
  if (lastKey) {
    node[lastKey] = value;
  }
}

/** Set a nested property on a block using dot-notation path. */
export function setProp(
  doc: PageDoc,
  blockId: string,
  path: string,
  value: unknown
): void {
  const found = findBlock(doc, blockId);
  if (found) {
    setPath(found.block, path, value);
  }
}

/** Give the page a header, replacing any it has. */
export function setHeader(doc: PageDoc, header: PageHeader): void {
  doc.header = header;
}

export function removeHeader(doc: PageDoc): void {
  doc.header = undefined;
}

/** Set a nested header property; same path rules as `setProp`. */
export function setHeaderProp(
  doc: PageDoc,
  path: string,
  value: unknown
): void {
  if (doc.header) {
    setPath(doc.header, path, value);
  }
}

/** Set the layout variant on a block. */
export function setVariant(
  doc: PageDoc,
  blockId: string,
  variant: string
): void {
  const found = findBlock(doc, blockId);
  if (found) {
    (found.block as unknown as Record<string, unknown>).variant = variant;
  }
}

/** Bind a data-fetch block to an Appwrite source string. */
export function bindCollection(
  doc: PageDoc,
  blockId: string,
  source: string
): void {
  const found = findBlock(doc, blockId);
  if (found) {
    (found.block as unknown as Record<string, unknown>).source = source;
  }
}

/** Update the page accent colour and propagate to meta. */
export function applyAccent(doc: PageDoc, hex: string): void {
  doc.meta.accentColor = hex;
}

/** Update a top-level meta field. */
export function setMeta<K extends keyof PageMeta>(
  doc: PageDoc,
  key: K,
  value: PageMeta[K]
): void {
  doc.meta[key] = value;
}
