import { parsePageTheme } from "@repo/shared/utils/page-theme";
import { emptyHeader } from "../header/empty-header";
import { newId } from "./ids";
import {
  COLUMN_COUNT,
  DEFAULT_SECTION_LAYOUT,
  resizeColumns,
} from "./sections";
import { walkBlocks } from "./tree";
import type {
  Block,
  Column,
  HeaderCrumb,
  HeaderVariant,
  LinkButton,
  MediaRef,
  PageDoc,
  PageHeader,
  PageMeta,
  Section,
  SectionAlign,
  SectionBackground,
  SectionBackgroundImage,
  SectionColumns,
  SectionLayout,
  SectionSpacing,
  SectionTablet,
} from "./types";
import { PAGE_DOC_VERSION } from "./types";

export { pruneEmptyFeedBlocks } from "./prune-feeds";

const MAX_TEXT_LEN = 120;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isString = (v: unknown): v is string => typeof v === "string";

/** The values each layout field may hold; anything else takes the default. */
export const LAYOUT_VALUES = {
  align: ["top", "middle", "bottom"] as const satisfies readonly SectionAlign[],
  background: [
    "white",
    "tinted",
    "dark",
    "photo",
  ] as const satisfies readonly SectionBackground[],
  // COLUMN_COUNT is a Record<SectionColumns, number>, so its keys are exhaustive.
  columns: Object.keys(COLUMN_COUNT) as SectionColumns[],
  hideOnPhone: [true, false],
  phoneReverse: [true, false],
  spacing: [
    "tight",
    "normal",
    "roomy",
  ] as const satisfies readonly SectionSpacing[],
  tablet: ["row", "stack"] as const satisfies readonly SectionTablet[],
} satisfies { [K in keyof SectionLayout]: readonly unknown[] };

type AssertNever<T extends never> = T;
// Each fails to compile when a union member is missing from LAYOUT_VALUES.
export type MissingLayoutValues = [
  AssertNever<Exclude<SectionAlign, (typeof LAYOUT_VALUES.align)[number]>>,
  AssertNever<
    Exclude<SectionBackground, (typeof LAYOUT_VALUES.background)[number]>
  >,
  AssertNever<Exclude<SectionColumns, (typeof LAYOUT_VALUES.columns)[number]>>,
  AssertNever<Exclude<SectionSpacing, (typeof LAYOUT_VALUES.spacing)[number]>>,
  AssertNever<Exclude<SectionTablet, (typeof LAYOUT_VALUES.tablet)[number]>>,
];

/** The equal-width preset for a stored column count. */
const PRESET_FOR_COUNT: Partial<Record<number, SectionColumns>> = {
  1: "1",
  2: "1-1",
  3: "1-1-1",
  4: "1-1-1-1",
};

function normalizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (block): block is Block =>
      isRecord(block) && isString(block.id) && isString(block.type)
  );
}

function normalizeColumns(raw: unknown): Column[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const columns: Column[] = [];
  for (const col of raw) {
    if (!isRecord(col)) {
      continue;
    }
    columns.push({
      ...(col as unknown as Column),
      blocks: normalizeBlocks(col.blocks),
      id: isString(col.id) ? col.id : newId("c"),
    });
  }
  return columns;
}

/**
 * Known layout values are kept and the rest take the defaults. A missing or
 * unknown column preset follows the columns actually stored, so a section
 * saved without its layout keeps its columns instead of collapsing into one.
 */
function normalizeLayout(raw: unknown, storedColumns: number): SectionLayout {
  const stored = isRecord(raw) ? raw : {};
  const layout: Record<string, unknown> = { ...DEFAULT_SECTION_LAYOUT };
  for (const [key, values] of Object.entries(LAYOUT_VALUES)) {
    const allowed: readonly unknown[] = values;
    if (allowed.includes(stored[key])) {
      layout[key] = stored[key];
    }
  }
  const columnPresets: readonly unknown[] = LAYOUT_VALUES.columns;
  if (!columnPresets.includes(stored.columns)) {
    layout.columns = PRESET_FOR_COUNT[storedColumns] ?? "1";
  }
  const backgroundImage = normalizeBackgroundImage(stored.backgroundImage);
  if (backgroundImage) {
    layout.backgroundImage = backgroundImage;
  }
  return layout as unknown as SectionLayout;
}

/**
 * A Photo section's image: kept only with a string `src`, and then with its
 * known string fields only.
 */
function normalizeBackgroundImage(
  raw: unknown
): SectionBackgroundImage | undefined {
  if (!(isRecord(raw) && isString(raw.src))) {
    return;
  }
  const image: SectionBackgroundImage = { src: raw.src };
  if (isString(raw.alt)) {
    image.alt = raw.alt;
  }
  if (isString(raw.fileId)) {
    image.fileId = raw.fileId;
  }
  if (isString(raw.mime)) {
    image.mime = raw.mime;
  }
  return image;
}

const HEADER_VARIANTS = [
  "split",
  "full",
  "plain",
] as const satisfies readonly HeaderVariant[];
export type MissingHeaderVariants = AssertNever<
  Exclude<HeaderVariant, (typeof HEADER_VARIANTS)[number]>
>;

const BUTTON_STYLES = [
  "primary",
  "secondary",
] as const satisfies readonly LinkButton["style"][];

const oneOf = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const MEDIA_STRINGS = [
  "alt",
  "fileId",
  "mime",
  "poster",
  "posterFileId",
  "posterMime",
] as const;

/** Header media: kept only with a string `src`, then with its known fields. */
function normalizeMedia(raw: unknown): MediaRef | undefined {
  if (!(isRecord(raw) && isString(raw.src))) {
    return;
  }
  const media: MediaRef = {
    kind: raw.kind === "video" ? "video" : "image",
    src: raw.src,
  };
  for (const key of MEDIA_STRINGS) {
    const value = raw[key];
    if (isString(value)) {
      media[key] = value;
    }
  }
  return media;
}

function normalizeCrumbs(raw: unknown): HeaderCrumb[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const crumbs: HeaderCrumb[] = [];
  for (const item of raw) {
    if (isRecord(item) && isString(item.label)) {
      crumbs.push(
        isString(item.href)
          ? { href: item.href, label: item.label }
          : { label: item.label }
      );
    }
  }
  return crumbs;
}

function normalizeButtons(raw: unknown): LinkButton[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const buttons: LinkButton[] = [];
  for (const item of raw) {
    if (isRecord(item) && isString(item.label) && isString(item.href)) {
      buttons.push({
        href: item.href,
        label: item.label,
        style: oneOf(BUTTON_STYLES, item.style, "primary"),
      });
    }
  }
  return buttons;
}

/**
 * A page header: any object is kept, its known fields checked and the rest
 * taken from `emptyHeader`; anything else is no header.
 */
function normalizeHeader(raw: unknown): PageHeader | undefined {
  if (!isRecord(raw) || Array.isArray(raw)) {
    return;
  }
  const empty = emptyHeader();
  const header: PageHeader = {
    buttons: normalizeButtons(raw.buttons),
    crumbs: normalizeCrumbs(raw.crumbs),
    eyebrow: isString(raw.eyebrow) ? raw.eyebrow : empty.eyebrow,
    lede: isString(raw.lede) ? raw.lede : empty.lede,
    title: isString(raw.title) ? raw.title : empty.title,
    variant: oneOf(HEADER_VARIANTS, raw.variant, empty.variant),
  };
  const media = normalizeMedia(raw.media);
  if (media) {
    header.media = media;
  }
  return header;
}

/**
 * Rebuild meta from its known fields, so a legacy or unknown key is dropped.
 * `theme` is kept only when it is `null` (reset to BISO) or passes
 * `parsePageTheme` (valid hex and contrast); anything else becomes absent.
 */
const normalizeMeta = (meta: PageMeta): PageMeta => {
  const { campus, department, description, slug, status, title, theme } = meta;
  const parsed = theme ? parsePageTheme(theme) : null;
  let kept: Pick<PageMeta, "theme"> = {};
  if (theme === null) {
    kept = { theme: null };
  } else if (parsed) {
    kept = { theme: parsed };
  }
  return {
    ...(campus === undefined ? {} : { campus }),
    department,
    ...(description === undefined ? {} : { description }),
    slug,
    status,
    title,
    ...kept,
  };
};

/**
 * Upgrade persisted page documents at every editor/render host boundary.
 * Never mutates its input. Old flat documents become an empty page (D2);
 * malformed sections, columns and blocks are repaired or dropped, so the
 * renderer and `walkBlocks` can trust the shape.
 */
export const normalizePageDoc = (doc: PageDoc): PageDoc => {
  const raw = doc as unknown as {
    header?: unknown;
    sections?: unknown;
    version?: unknown;
  };
  if (raw.version !== PAGE_DOC_VERSION || !Array.isArray(raw.sections)) {
    return {
      meta: normalizeMeta(doc.meta),
      sections: [],
      version: PAGE_DOC_VERSION,
    };
  }
  const sections: Section[] = [];
  for (const rawSection of raw.sections) {
    if (!isRecord(rawSection)) {
      continue;
    }
    const columns = normalizeColumns(rawSection.columns);
    const next: Section = {
      ...(rawSection as unknown as Section),
      columns,
      id: isString(rawSection.id) ? rawSection.id : newId("s"),
      layout: normalizeLayout(rawSection.layout, columns.length),
    };
    resizeColumns(next, next.layout.columns);
    sections.push(next);
  }
  const { header: _stored, ...rest } = doc;
  const header = normalizeHeader(raw.header);
  const meta = normalizeMeta(doc.meta);
  return header
    ? { ...rest, header, meta, sections }
    : { ...rest, meta, sections };
};

function themeSummary(theme: PageMeta["theme"]): string {
  const parsed = theme ? parsePageTheme(theme) : null;
  return parsed ? `dark ${parsed.dark}, accent ${parsed.accent}` : "BISO";
}

function headerSummary(header: PageHeader | undefined): string {
  if (!header) {
    return "header: none";
  }
  return `header: variant=${header.variant} title="${truncate(header.title)}"`;
}

function truncate(s: string | undefined): string {
  if (!s) {
    return "";
  }
  return s.length > MAX_TEXT_LEN ? `${s.slice(0, MAX_TEXT_LEN)}…` : s;
}

function blockSummary(b: Block): string {
  const base = `[${b.id}] type=${b.type}`;
  const r = b as unknown as Record<string, unknown>;

  const parts: string[] = [base];
  if ("variant" in r) {
    parts.push(`variant=${r.variant}`);
  }
  if ("heading" in r) {
    parts.push(`heading="${truncate(r.heading as string)}"`);
  }
  if ("title" in r) {
    parts.push(`title="${truncate(r.title as string)}"`);
  }
  if ("eyebrow" in r) {
    parts.push(`eyebrow="${truncate(r.eyebrow as string)}"`);
  }
  if ("text" in r) {
    parts.push(`text="${truncate(r.text as string)}"`);
  }
  if ("source" in r) {
    parts.push(`source="${r.source}"`);
  }
  if ("items" in r && Array.isArray(r.items)) {
    parts.push(`items.count=${r.items.length}`);
  }
  if ("members" in r && Array.isArray(r.members)) {
    parts.push(`members.count=${(r.members as unknown[]).length}`);
  }

  return parts.join(" ");
}

/** Compact plain-text representation of the page injected into every AI request. */
export function serializePageForAI(
  doc: PageDoc,
  selection: string | null
): string {
  const { meta } = doc;
  const blocks = walkBlocks(doc);
  const lines: string[] = [
    "== PAGE ==",
    `title: ${meta.title}`,
    `slug: ${meta.slug}`,
    `department: ${meta.department}`,
    `theme: ${themeSummary(meta.theme)}`,
    `status: ${meta.status}`,
    `sections: ${doc.sections.length}`,
    `blocks: ${blocks.length}`,
    headerSummary(doc.header),
    "",
    "== BLOCKS ==",
  ];
  let n = 0;
  for (const [i, s] of doc.sections.entries()) {
    lines.push(
      `Section ${i + 1} [${s.id}] columns=${s.layout.columns} background=${s.layout.background}`
    );
    for (const [j, c] of s.columns.entries()) {
      lines.push(`  Column ${j + 1} [${c.id}]`);
      for (const b of c.blocks) {
        n += 1;
        const sel = b.id === selection ? " ← SELECTED" : "";
        lines.push(`    ${n}. ${blockSummary(b)}${sel}`);
      }
    }
  }

  if (selection) {
    const b = blocks.find((b) => b.id === selection);
    if (b) {
      lines.push(
        "",
        "== SELECTED BLOCK (full props) ==",
        JSON.stringify(b, null, 2)
      );
    }
  }

  return lines.join("\n");
}

/** Deserialize a PageDoc from a JSON string. */
export function fromJSON(json: string): PageDoc {
  return normalizePageDoc(JSON.parse(json) as PageDoc);
}
