import "server-only";

import { Query } from "@repo/api";
import {
  type NotifyItem,
  toNotifyItem,
  toSnapshotItem,
} from "@repo/shared/utils/content-notification-compose";

export type LinkedContentType = "event" | "news" | "job";

export interface LinkedColumns {
  content_id: string | null;
  content_type: LinkedContentType | null;
  deep_link: string | null;
  event_id: string | null;
  image: string | null;
  items: string | null;
}

export type LinkedContentResult =
  | { ok: true; columns: LinkedColumns }
  | { ok: false; error: string };

export const NOT_PUBLISHED_MESSAGE = "Only published content can be linked.";
export const CONTENT_MISSING_MESSAGE = "That content no longer exists.";

interface LinkDb {
  listRows: <T>(
    databaseId: string,
    tableId: string,
    queries: string[]
  ) => Promise<{ rows: T[] }>;
}

const TABLES: Record<LinkedContentType, string> = {
  event: "events",
  news: "news",
  job: "jobs",
};

const EMPTY_COLUMNS: LinkedColumns = {
  content_id: null,
  content_type: null,
  deep_link: null,
  event_id: null,
  image: null,
  items: null,
};

interface LinkValues {
  content_id?: string | null;
  content_type?: LinkedContentType | null;
  event_id?: string | null;
}

/** Reads the link from the form values; a legacy `event_id` links an event. */
export function normalizeLink(
  values: LinkValues
): { type: LinkedContentType; id: string } | null {
  if (values.content_type && values.content_id) {
    return { type: values.content_type, id: values.content_id };
  }
  if (!values.content_type && values.event_id) {
    return { type: "event", id: values.event_id };
  }
  return null;
}

export async function resolveLinkedContent(
  db: LinkDb,
  link: { type: LinkedContentType; id: string } | null
): Promise<LinkedContentResult> {
  if (!link) {
    return { ok: true, columns: { ...EMPTY_COLUMNS } };
  }
  const found = await db.listRows<Record<string, unknown>>(
    "app",
    TABLES[link.type],
    [Query.equal("$id", link.id), Query.limit(1)]
  );
  const row = found.rows[0];
  if (!row) {
    return { ok: false, error: CONTENT_MISSING_MESSAGE };
  }
  if (row.status !== "published") {
    return { ok: false, error: NOT_PUBLISHED_MESSAGE };
  }
  const translations = await db.listRows<{
    description?: string | null;
    locale: string;
    short_description?: string | null;
    title?: string | null;
  }>("app", "content_translations", [
    Query.equal("content_type", link.type),
    Query.equal("content_id", link.id),
    Query.limit(10),
  ]);
  const item: NotifyItem = toNotifyItem(link.type, row, translations.rows);
  return {
    ok: true,
    columns: {
      content_type: link.type,
      content_id: link.id,
      event_id: link.type === "event" ? link.id : null,
      deep_link: `biso://${link.type}?id=${link.id}`,
      image: item.image,
      items: JSON.stringify([toSnapshotItem(item)]),
    },
  };
}
