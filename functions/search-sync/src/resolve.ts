import { pageOwner } from "@repo/shared/search/entries/page";
import type { SearchType } from "@repo/shared/search/types";
import type { ProjectSlug } from "@repo/shared/utils/project-units";
import type { Trigger } from "./trigger";

/** One indexed item, re-read and mapped by `Source.load`. */
export interface ItemTarget {
  id: string;
  type: Exclude<SearchType, "coded">;
}

export type SyncTarget =
  | ItemTarget
  | { type: "department-related"; id: string }
  /** Re-decide whether `/projects/<id>` shows its coded hub entry. */
  | { type: "project-path"; id: ProjectSlug };

export type Resolution =
  | { kind: "targets"; targets: SyncTarget[] }
  | { kind: "ignored"; reason: string };

type RowTrigger = Extract<Trigger, { kind: "row" }>;
type PlainType = Exclude<SearchType, "coded">;

const TABLE_TYPES: Record<string, PlainType> = {
  documents: "document",
  events: "event",
  jobs: "job",
  news: "news",
  webshop_products: "product",
};

/** `content_translations.content_type` values that map to a search type. */
const CONTENT_TYPES: Record<string, PlainType> = {
  department: "unit",
  event: "event",
  job: "job",
  news: "news",
  page: "page",
  product: "product",
};

function ignored(reason: string): Resolution {
  return { kind: "ignored", reason };
}

function single(type: PlainType, id: string): Resolution {
  return { kind: "targets", targets: [{ id, type }] };
}

function bodyString(
  body: Record<string, unknown> | null,
  key: string
): string | undefined {
  const value = body?.[key];
  return typeof value === "string" && value ? value : undefined;
}

function resolveContentTranslation(trigger: RowTrigger): Resolution {
  const contentType = bodyString(trigger.body, "content_type");
  const contentId = bodyString(trigger.body, "content_id");
  const type = contentType ? CONTENT_TYPES[contentType] : undefined;
  if (!(type && contentId)) {
    return ignored(`Translation of ${contentType ?? "unknown"} is not indexed`);
  }
  return single(type, contentId);
}

/**
 * A page and what its row was bound to. The body carries the row's columns
 * even on delete, when the page can no longer be read: its unit and its
 * project address are re-read from Appwrite, so the body only says which
 * items to look at, never what they contain. (The old slug of a re-slugged
 * page is not in the body; the reindex covers that.)
 */
function resolvePage(trigger: RowTrigger): Resolution {
  const targets: SyncTarget[] = [{ id: trigger.id, type: "page" }];
  const departmentId = bodyString(trigger.body, "department_id");
  if (departmentId) {
    targets.push({ id: departmentId, type: "unit" });
  }
  const slug = bodyString(trigger.body, "slug");
  const owner = slug ? pageOwner(slug.trim()) : null;
  if (owner?.kind === "project") {
    targets.push({ id: owner.project, type: "project-path" });
  }
  return { kind: "targets", targets };
}

/** Which search items a row event can change. */
export function resolveTargets(trigger: RowTrigger): Resolution {
  const { table, id } = trigger;
  if (table === "departments") {
    // department-related first: it compares the unit's entry in the index
    // with the fresh unit before the unit target writes it.
    return {
      kind: "targets",
      targets: [
        { id, type: "department-related" },
        { id, type: "unit" },
      ],
    };
  }
  if (table === "content_translations") {
    return resolveContentTranslation(trigger);
  }
  if (table === "pages") {
    return resolvePage(trigger);
  }
  if (table === "page_translations") {
    const pageId = bodyString(trigger.body, "page_id");
    return pageId ? single("page", pageId) : ignored("Translation has no page");
  }
  const type = TABLE_TYPES[table];
  return type ? single(type, id) : ignored(`Table ${table} is not indexed`);
}
