/**
 * Plain-text/HTML description block model shared by the studio editors and
 * the DescriptionBlockEditor component. Blocks serialize to a small HTML
 * subset (h3 / p / ul-li) stored on content rows.
 */
export type DescriptionBlockType = "h" | "l" | "p";

export interface DescriptionBlock {
  id: string;
  text: string;
  type: DescriptionBlockType;
}

const PLATE_TEXT_NODE = /"text"\s*:/;

export function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function newBlock(
  type: DescriptionBlockType,
  text = ""
): DescriptionBlock {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    text,
    type,
  };
}

/** Pull plain text out of a single Plate node, recursing into children. */
function plateNodeText(node: { text?: unknown; children?: unknown }): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child) => plateNodeText(child)).join("");
  }
  return "";
}

/**
 * Migration shim: bodies authored with the previous Plate editor are stored as
 * a JSON array of nodes. Convert each top-level node into a paragraph block so
 * legacy announcements don't surface raw JSON.
 */
function plateJsonToBlocks(value: string): DescriptionBlock[] | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const blocks = parsed
      .map((node) => plateNodeText(node).trim())
      .filter((text) => text.length > 0)
      .map((text) => newBlock("p", text));
    return blocks.length > 0 ? blocks : [newBlock("p")];
  } catch {
    return null;
  }
}

export function htmlToDescriptionBlocks(value: string): DescriptionBlock[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && PLATE_TEXT_NODE.test(trimmed)) {
    const migrated = plateJsonToBlocks(trimmed);
    if (migrated) {
      return migrated;
    }
  }

  const blocks: DescriptionBlock[] = [];
  const pattern = /<(h[1-6]|p|li)[^>]*>(.*?)<\/\1>/gis;
  let match = pattern.exec(value);

  while (match) {
    const [, tag, rawText] = match;
    const text = decodeHtml(stripHtml(rawText ?? ""));
    let type: DescriptionBlockType = "p";
    if (tag?.startsWith("h")) {
      type = "h";
    } else if (tag === "li") {
      type = "l";
    }
    blocks.push(newBlock(type, text));
    match = pattern.exec(value);
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const plain = stripHtml(value);
  return [newBlock("p", plain)];
}

export function descriptionBlocksToHtml(blocks: DescriptionBlock[]) {
  const html: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    html.push(`<ul>${listItems.join("")}</ul>`);
    listItems = [];
  };

  for (const block of blocks) {
    const text = escapeHtml(block.text.trim());
    if (!text) {
      continue;
    }
    if (block.type === "l") {
      listItems.push(`<li>${text}</li>`);
      continue;
    }
    flushList();
    html.push(block.type === "h" ? `<h3>${text}</h3>` : `<p>${text}</p>`);
  }

  flushList();
  return html.join("");
}
