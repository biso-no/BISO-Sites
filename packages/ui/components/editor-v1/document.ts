import type { TElement } from 'platejs';

export type EditorV1Variant = 'news' | 'events' | 'jobs';

export interface ContentEditorV1Document {
  version: 1;
  blocks: TElement[];
}

export function createEmptyParagraph(text = ''): TElement {
  return { type: 'p', children: [{ text }] } as TElement;
}

export function parseEditorV1Value(value: string | null | undefined): ContentEditorV1Document {
  if (!value) {
    return { version: 1, blocks: [createEmptyParagraph()] };
  }

  const trimmed = value.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { version: 1, blocks: parsed as TElement[] };
      }
    } catch {
      // fall through to legacy-text handling
    }
  }

  return {
    version: 1,
    blocks: [createEmptyParagraph(value)],
  };
}

export function stringifyEditorV1Document(document: ContentEditorV1Document): string {
  return JSON.stringify(document.blocks);
}
