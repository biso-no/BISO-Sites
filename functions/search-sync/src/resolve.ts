import type { SearchType } from "@repo/shared/search/types";
import type { Trigger } from "./trigger";

export type SyncTarget =
  | { type: Exclude<SearchType, "coded">; id: string }
  | { type: "department-related"; id: string };

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
  pages: "page",
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

/** Which search items a row event can change. */
export function resolveTargets(trigger: RowTrigger): Resolution {
  const { table, id } = trigger;
  if (table === "departments") {
    return {
      kind: "targets",
      targets: [
        { id, type: "unit" },
        { id, type: "department-related" },
      ],
    };
  }
  if (table === "content_translations") {
    return resolveContentTranslation(trigger);
  }
  if (table === "page_translations") {
    const pageId = bodyString(trigger.body, "page_id");
    return pageId ? single("page", pageId) : ignored("Translation has no page");
  }
  const type = TABLE_TYPES[table];
  return type ? single(type, id) : ignored(`Table ${table} is not indexed`);
}
