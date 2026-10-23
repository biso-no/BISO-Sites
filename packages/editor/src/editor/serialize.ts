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
  PageDoc,
  Section,
  SectionColumns,
  SectionLayout,
} from "./types";
import { PAGE_DOC_VERSION } from "./types";

const MAX_TEXT_LEN = 120;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isString = (v: unknown): v is string => typeof v === "string";

/** The values each layout field may hold; anything else takes the default. */
const LAYOUT_VALUES: { [K in keyof SectionLayout]: readonly unknown[] } = {
  align: ["top", "middle", "bottom"],
  background: ["white", "tinted", "dark"],
  columns: Object.keys(COLUMN_COUNT),
  hideOnPhone: [true, false],
  phoneReverse: [true, false],
  spacing: ["tight", "normal", "roomy"],
  tablet: ["row", "stack"],
};

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
  for (const [key, allowed] of Object.entries(LAYOUT_VALUES)) {
    if (allowed.includes(stored[key])) {
      layout[key] = stored[key];
    }
  }
  if (!LAYOUT_VALUES.columns.includes(stored.columns)) {
    layout.columns = PRESET_FOR_COUNT[storedColumns] ?? "1";
  }
  return layout as unknown as SectionLayout;
}

/**
 * Upgrade persisted page documents at every editor/render host boundary.
 * Never mutates its input. Old flat documents become an empty page (D2);
 * malformed sections, columns and blocks are repaired or dropped, so the
 * renderer and `walkBlocks` can trust the shape.
 */
export const normalizePageDoc = (doc: PageDoc): PageDoc => {
  const raw = doc as unknown as { sections?: unknown; version?: unknown };
  if (raw.version !== PAGE_DOC_VERSION || !Array.isArray(raw.sections)) {
    return { meta: doc.meta, sections: [], version: PAGE_DOC_VERSION };
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
  return { ...doc, sections };
};

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
  if ("subtitle" in r) {
    parts.push(`subtitle="${truncate(r.subtitle as string)}"`);
  }
  if ("text" in r) {
    parts.push(`text="${truncate(r.text as string)}"`);
  }
  if ("source" in r) {
    parts.push(`source="${r.source}"`);
  }
  if ("ctaLabel" in r) {
    parts.push(`ctaLabel="${r.ctaLabel}"`);
  }
  if ("ctaUrl" in r) {
    parts.push(`ctaUrl="${r.ctaUrl}"`);
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
    `accent: ${meta.accentColor}`,
    `status: ${meta.status}`,
    `sections: ${doc.sections.length}`,
    `blocks: ${blocks.length}`,
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
