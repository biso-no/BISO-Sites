import type { PageFeedSnapshot } from "./page-feeds";
import { requestForBlock, teamSource } from "./page-feeds";
import type { Block, EditorLocale, PageDoc } from "./types";

/**
 * A live block with no feed request is one of two things: a block that never
 * had a feed (manual team, manual partners), or a department-scoped live block
 * whose department cannot be resolved. Only the second renders nothing.
 *
 * Mirrors `requestForBlock`: these are exactly the types it returns null for
 * when `resolveFeedDepartment` finds no department (events/jobs/news/products),
 * or a board team has no page department. Change them together.
 */
function isUnresolvableLiveBlock(block: Block): boolean {
  switch (block.type) {
    case "events":
    case "jobs":
    case "news":
    case "productGrid":
      return true;
    case "team":
      return teamSource(block.source) === "board";
    default:
      return false;
  }
}

/**
 * The page as the public site should render it: blocks whose feed came back
 * empty, and live blocks with no department to read from, are dropped. A
 * section left without blocks then renders nothing (`SectionView`), so no empty
 * band is left behind.
 *
 * A feed absent from the snapshot is unresolved (it failed, or the client will
 * still fill it), so its block stays. Only a key that is present and `[]`
 * prunes. Pure: the input document is never mutated, and an untouched section
 * keeps its identity.
 */
export function pruneEmptyFeedBlocks(
  doc: PageDoc,
  feeds: PageFeedSnapshot,
  locale: EditorLocale
): PageDoc {
  const keep = (block: Block): boolean => {
    const request = requestForBlock(
      block,
      doc.meta.department,
      doc.meta.campus ?? "",
      locale
    );
    if (!request) {
      return !isUnresolvableLiveBlock(block);
    }
    const items = feeds[request.key];
    return !(Array.isArray(items) && items.length === 0);
  };

  return {
    ...doc,
    sections: doc.sections.map((section) => {
      const columns = section.columns.map((column) => {
        const blocks = column.blocks.filter(keep);
        return blocks.length === column.blocks.length
          ? column
          : { ...column, blocks };
      });
      return columns.every((column, i) => column === section.columns[i])
        ? section
        : { ...section, columns };
    }),
  };
}
