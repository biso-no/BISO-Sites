// Test-only helpers for building page documents.
import { emptyBlock } from "./operations";
import { DEFAULT_SECTION_LAYOUT } from "./sections";
import type {
  Block,
  BlockType,
  PageDoc,
  Section,
  SectionColumns,
} from "./types";

export const block = (id: string, type: BlockType = "text"): Block => ({
  ...emptyBlock(type),
  id,
});

export const section = (
  id: string,
  columns: SectionColumns,
  blockIds: string[][]
): Section => ({
  columns: blockIds.map((ids, i) => ({
    blocks: ids.map((b) => block(b)),
    id: `${id}-c${i}`,
  })),
  id,
  layout: { ...DEFAULT_SECTION_LAYOUT, columns },
});

export const doc = (...sections: Section[]): PageDoc => ({
  meta: {
    department: "",
    slug: "test",
    status: "draft",
    title: "Test page",
  },
  sections,
  version: 2,
});
