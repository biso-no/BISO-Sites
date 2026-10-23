import type { Block, Column, InsertTarget, PageDoc, Section } from "./types";

export function walkBlocks(doc: PageDoc): Block[] {
  const out: Block[] = [];
  for (const s of doc.sections) {
    for (const c of s.columns) {
      out.push(...c.blocks);
    }
  }
  return out;
}

export function findBlock(
  doc: PageDoc,
  blockId: string
): {
  block: Block;
  blockIndex: number;
  column: Column;
  section: Section;
} | null {
  for (const section of doc.sections) {
    for (const column of section.columns) {
      const blockIndex = column.blocks.findIndex((b) => b.id === blockId);
      if (blockIndex !== -1) {
        return {
          block: column.blocks[blockIndex],
          blockIndex,
          column,
          section,
        };
      }
    }
  }
  return null;
}

export function findColumn(
  doc: PageDoc,
  columnId: string
): { column: Column; section: Section } | null {
  for (const section of doc.sections) {
    const column = section.columns.find((c) => c.id === columnId);
    if (column) {
      return { column, section };
    }
  }
  return null;
}

export function findSection(
  doc: PageDoc,
  sectionId: string
): { index: number; section: Section } | null {
  const index = doc.sections.findIndex((s) => s.id === sectionId);
  return index === -1 ? null : { index, section: doc.sections[index] };
}

export function targetAfterBlock(
  doc: PageDoc,
  blockId: string
): InsertTarget | null {
  const found = findBlock(doc, blockId);
  if (!found) {
    return null;
  }
  const next = found.column.blocks[found.blockIndex + 1];
  return next
    ? { beforeBlockId: next.id, columnId: found.column.id }
    : { columnId: found.column.id };
}

export function defaultInsertTarget(
  doc: PageDoc,
  selectedBlockId: string | null
): InsertTarget | null {
  return selectedBlockId ? targetAfterBlock(doc, selectedBlockId) : null;
}
