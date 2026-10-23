import { DEFAULT_SECTION_LAYOUT, resizeColumns } from "./sections";
import { walkBlocks } from "./tree";
import type { Block, PageDoc, Section } from "./types";
import { PAGE_DOC_VERSION } from "./types";

const MAX_TEXT_LEN = 120;

/** Upgrade persisted page documents at every editor/render host boundary. */
export const normalizePageDoc = (doc: PageDoc): PageDoc => {
  const raw = doc as unknown as { sections?: unknown; version?: unknown };
  if (raw.version !== PAGE_DOC_VERSION || !Array.isArray(raw.sections)) {
    return { meta: doc.meta, sections: [], version: PAGE_DOC_VERSION };
  }
  const sections = doc.sections.map((section) => {
    const next: Section = {
      ...section,
      columns: section.columns.map((c) => ({ ...c, blocks: [...c.blocks] })),
      layout: { ...DEFAULT_SECTION_LAYOUT, ...section.layout },
    };
    resizeColumns(next, next.layout.columns);
    return next;
  });
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
    `blocks: ${blocks.length}`,
    "",
    "== BLOCKS ==",
    ...blocks.map((b, i) => {
      const sel = b.id === selection ? " ← SELECTED" : "";
      return `${i + 1}. ${blockSummary(b)}${sel}`;
    }),
  ];

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
