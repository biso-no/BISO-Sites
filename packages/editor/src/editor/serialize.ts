import type { Block, PageDoc } from "./types";

const MAX_TEXT_LEN = 120;

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
  const { meta, blocks } = doc;
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
  return JSON.parse(json) as PageDoc;
}
