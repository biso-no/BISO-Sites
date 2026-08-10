/**
 * Plain-text/HTML description block model shared by the studio editors and
 * the DescriptionBlockEditor component. Blocks serialize to a small HTML
 * subset stored on content rows.
 */
export type DescriptionBlockType = "h" | "l" | "p";
export type MediaKind = "audio" | "file" | "image" | "video";

export interface TextDescriptionBlock {
  id: string;
  text: string;
  type: DescriptionBlockType;
}

export interface MediaDescriptionBlock {
  alt: string;
  caption: string;
  fileId: string;
  fileName: string;
  id: string;
  mediaKind: MediaKind;
  mimeType: string;
  type: "media";
  url: string;
}

export type DescriptionBlock = MediaDescriptionBlock | TextDescriptionBlock;

type NewMediaBlock = Omit<MediaDescriptionBlock, "id" | "type">;
type PlateNode = Record<string, unknown> & {
  children?: unknown;
  text?: unknown;
};

const TOP_LEVEL_BLOCK =
  /<figure\b([^>]*)>([\s\S]*?)<\/figure>|<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\3>/gi;
const HTML_ATTRIBUTE =
  /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const HTML_ENTITY = /&(nbsp|amp|lt|gt|quot|#039);/g;
const HTML_ENTITY_VALUES: Record<string, string> = {
  "&#039;": "'",
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&nbsp;": " ",
  "&quot;": '"',
};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function decodeHtml(value: string): string {
  return value.replace(
    HTML_ENTITY,
    (entity) => HTML_ENTITY_VALUES[entity] ?? entity
  );
}

export function newBlock(
  type: DescriptionBlockType,
  text = ""
): TextDescriptionBlock {
  return { id: newId(), text, type };
}

export function newMediaBlock(media: NewMediaBlock): MediaDescriptionBlock {
  return { ...media, id: newId(), type: "media" };
}

export function isTextDescriptionBlock(
  block: DescriptionBlock
): block is TextDescriptionBlock {
  return block.type !== "media";
}

/** Pull plain text out of a single Plate node, recursing into children. */
function plateNodeText(node: PlateNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  if (Array.isArray(node.children)) {
    return node.children
      .map((child) => (isPlateNode(child) ? plateNodeText(child) : ""))
      .join("");
  }
  return "";
}

function isPlateNode(value: unknown): value is PlateNode {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function plateMediaKind(node: PlateNode): MediaKind | null {
  if (typeof node.url !== "string" || !node.url) {
    return null;
  }

  const type = stringValue(node.type).toLowerCase();
  if (type === "img" || type.includes("image")) {
    return "image";
  }
  if (type.includes("audio")) {
    return "audio";
  }
  if (type.includes("video")) {
    return "video";
  }
  return "file";
}

function plateNodeToBlock(node: PlateNode): DescriptionBlock | null {
  const mediaKind = plateMediaKind(node);
  if (mediaKind) {
    return newMediaBlock({
      alt: stringValue(node.alt),
      caption: stringValue(node.caption),
      fileId: stringValue(node.fileId),
      fileName: stringValue(node.fileName),
      mediaKind,
      mimeType: stringValue(node.mimeType),
      url: stringValue(node.url),
    });
  }

  const text = plateNodeText(node).trim();
  return text ? newBlock("p", text) : null;
}

/**
 * Migration shim: bodies authored with the previous Plate editor are stored as
 * a JSON array of nodes. Convert text nodes and URL-bearing media nodes into
 * the shared persistence model so legacy announcements do not lose media.
 */
function plateJsonToBlocks(value: string): DescriptionBlock[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const blocks = parsed
      .map((node) => (isPlateNode(node) ? plateNodeToBlock(node) : null))
      .filter((block): block is DescriptionBlock => block !== null);
    return blocks.length > 0 ? blocks : [newBlock("p")];
  } catch {
    return null;
  }
}

function parseAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let match = HTML_ATTRIBUTE.exec(value);

  while (match) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    if (name) {
      attributes[name.toLowerCase()] = decodeHtml(
        doubleQuoted ?? singleQuoted ?? unquoted ?? ""
      );
    }
    match = HTML_ATTRIBUTE.exec(value);
  }

  return attributes;
}

function figureToMediaBlock(
  attributes: Record<string, string>
): MediaDescriptionBlock | null {
  const mediaKind = attributes["data-media-kind"];
  if (
    mediaKind !== "audio" &&
    mediaKind !== "file" &&
    mediaKind !== "image" &&
    mediaKind !== "video"
  ) {
    return null;
  }

  return newMediaBlock({
    alt: attributes["data-alt"] ?? "",
    caption: attributes["data-caption"] ?? "",
    fileId: attributes["data-file-id"] ?? "",
    fileName: attributes["data-file-name"] ?? "",
    mediaKind,
    mimeType: attributes["data-mime-type"] ?? "",
    url: attributes["data-url"] ?? "",
  });
}

function textBlockType(tag: string): DescriptionBlockType {
  if (tag.startsWith("h")) {
    return "h";
  }
  if (tag === "li") {
    return "l";
  }
  return "p";
}

export function htmlToDescriptionBlocks(value: string): DescriptionBlock[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    const migrated = plateJsonToBlocks(trimmed);
    if (migrated) {
      return migrated;
    }
  }

  const blocks: DescriptionBlock[] = [];
  let match = TOP_LEVEL_BLOCK.exec(value);

  while (match) {
    const [, figureAttributes, , tag, rawText] = match;
    if (figureAttributes !== undefined) {
      const media = figureToMediaBlock(parseAttributes(figureAttributes));
      if (media) {
        blocks.push(media);
      }
    } else if (tag) {
      const text = decodeHtml(stripHtml(rawText ?? ""));
      blocks.push(newBlock(textBlockType(tag), text));
    }
    match = TOP_LEVEL_BLOCK.exec(value);
  }

  if (blocks.length > 0) {
    return blocks;
  }

  return [newBlock("p", decodeHtml(stripHtml(value)))];
}

function mediaFigure(block: MediaDescriptionBlock): string {
  const attributes = [
    `data-media-kind="${escapeHtml(block.mediaKind)}"`,
    `data-url="${escapeHtml(block.url)}"`,
    `data-file-id="${escapeHtml(block.fileId)}"`,
    `data-file-name="${escapeHtml(block.fileName)}"`,
    `data-mime-type="${escapeHtml(block.mimeType)}"`,
    `data-alt="${escapeHtml(block.alt)}"`,
    `data-caption="${escapeHtml(block.caption)}"`,
  ].join(" ");
  const url = escapeHtml(block.url);
  const caption = block.caption
    ? `<figcaption>${escapeHtml(block.caption)}</figcaption>`
    : "";

  if (block.mediaKind === "image") {
    return `<figure ${attributes}><img src="${url}" alt="${escapeHtml(block.alt)}" />${caption}</figure>`;
  }
  if (block.mediaKind === "video") {
    return `<figure ${attributes}><video controls src="${url}"></video>${caption}</figure>`;
  }
  if (block.mediaKind === "audio") {
    return `<figure ${attributes}><audio controls src="${url}"></audio>${caption}</figure>`;
  }
  return `<figure ${attributes}><a href="${url}">${escapeHtml(block.fileName || block.url)}</a>${caption}</figure>`;
}

export function descriptionBlocksToHtml(blocks: DescriptionBlock[]): string {
  const html: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      html.push(`<ul>${listItems.join("")}</ul>`);
      listItems = [];
    }
  };

  for (const block of blocks) {
    if (block.type === "media") {
      flushList();
      html.push(mediaFigure(block));
      continue;
    }

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
