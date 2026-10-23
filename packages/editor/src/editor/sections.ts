import type { ResolvedBackground } from "../blocks/_primitives/layout-types";
import { newId } from "./ids";
import type {
  Block,
  Section,
  SectionBackground,
  SectionColumns,
  SectionLayout,
} from "./types";

export const DEFAULT_SECTION_LAYOUT: SectionLayout = {
  align: "top",
  background: "white",
  columns: "1",
  hideOnPhone: false,
  phoneReverse: false,
  spacing: "normal",
  tablet: "row",
};

export const COLUMN_COUNT: Record<SectionColumns, number> = {
  "1": 1,
  "1-1": 2,
  "2-1": 2,
  "1-2": 2,
  "1-1-1": 3,
  "1-1-1-1": 4,
};

export function emptySection(columns: SectionColumns = "1"): Section {
  return {
    columns: Array.from({ length: COLUMN_COUNT[columns] }, () => ({
      blocks: [],
      id: newId("c"),
    })),
    id: newId("s"),
    layout: { ...DEFAULT_SECTION_LAYOUT, columns },
  };
}

export function sectionOf(...blocks: Block[]): Section {
  const s = emptySection("1");
  s.columns[0].blocks = blocks;
  return s;
}

/** Set the layout's column preset and fix the column count (mutates). */
export function resizeColumns(section: Section, columns: SectionColumns): void {
  const count = COLUMN_COUNT[columns];
  section.layout.columns = columns;
  while (section.columns.length < count) {
    section.columns.push({ blocks: [], id: newId("c") });
  }
  if (section.columns.length > count) {
    const extra = section.columns.splice(count);
    const last = section.columns[count - 1];
    for (const col of extra) {
      last.blocks.push(...col.blocks);
    }
  }
}

const LEGACY_BACKGROUND: Record<SectionBackground, ResolvedBackground> = {
  dark: "inverted",
  tinted: "muted",
  white: "default",
};

/** Interim map from a section background to the block surface; stage 2 replaces it. */
export function legacyBackground(bg: SectionBackground): ResolvedBackground {
  return LEGACY_BACKGROUND[bg];
}
