/**
 * content-notifier Appwrite Function.
 *
 * Sends automatic push notifications when events, news and jobs go live. Two
 * kinds of execution reach this one function:
 *  - Appwrite events on `events`/`news`/`jobs` rows: keep the item's lock row
 *    (`content_notifications`) in step with the content.
 *  - A schedule or secret-guarded HTTP ping (from scheduled-dispatch): send
 *    every lock that has come due.
 * Only one dispatch pass runs at a time; a second one answers 409 and exits.
 */

import { ID, type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Announcements,
  ContentNotifications,
  ContentTranslations,
} from "@repo/api/types/appwrite";
import {
  contentTableFor,
  NOTIFY_DEFAULT_DELAY_MINUTES,
  type NotifyContentType,
} from "@repo/shared/utils/content-notifications";
import {
  SKIPPED_STATUS_CODE,
  STALE_EXECUTION_MS,
} from "@repo/shared/utils/member-roster-sync";
import { dispatchAnnouncement } from "@repo/shared/utils/push-dispatch";
import { isAnotherDispatchRunning } from "./overlap";
import {
  dispatchDue,
  handleContentChange,
  type NotifierDeps,
  type TranslationRow,
} from "./run";
import { adoptRuntimeApiKey } from "./runtime-key";
import { classifyTrigger } from "./trigger";

const DB = "app";
const LOCK_TABLE = "content_notifications";
const ANNOUNCEMENT_TABLE = "announcements";
const TRANSLATION_TABLE = "content_translations";
const TRANSLATION_LIMIT = 10;
const EXECUTION_LIMIT = 25;
const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;
const LOG_TAG = "[content-notifier]";

type LogFn = (...messages: unknown[]) => void;

interface AppwriteContext {
  error: LogFn;
  log: LogFn;
  req: {
    bodyJson?: unknown;
    headers?: Record<string, string | undefined>;
    method?: string;
  };
  res: { json: (data: unknown, statusCode?: number) => unknown };
}

function errorCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    return typeof code === "number" ? code : undefined;
  }
  return;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveDelayMinutes(): number {
  const parsed = Number.parseInt(process.env.NOTIFY_DELAY_MINUTES ?? "", 10);
  return parsed >= 0 ? parsed : NOTIFY_DEFAULT_DELAY_MINUTES;
}

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

function buildDeps(client: AdminClient, log: LogFn): NotifierDeps {
  const { db, messaging } = client;
  return {
    createAnnouncement: (columns) =>
      db.createRow({
        data: columns as unknown as Omit<Announcements, keyof Models.Row>,
        databaseId: DB,
        rowId: ID.unique(),
        tableId: ANNOUNCEMENT_TABLE,
      }) as unknown as ReturnType<NotifierDeps["createAnnouncement"]>,
    createLock: async (lockId, data) => {
      try {
        await db.createRow({
          data,
          databaseId: DB,
          rowId: lockId,
          tableId: LOCK_TABLE,
        });
        return "created";
      } catch (error) {
        if (errorCode(error) === HTTP_CONFLICT) {
          return "exists";
        }
        throw error;
      }
    },
    delayMinutes: resolveDelayMinutes(),
    dispatch: async (announcement) => {
      await dispatchAnnouncement(announcement, { db, messaging });
    },
    getContent: async (type: NotifyContentType, id) => {
      try {
        return (await db.getRow({
          databaseId: DB,
          rowId: id,
          tableId: contentTableFor(type),
        })) as unknown as Record<string, unknown>;
      } catch (error) {
        if (errorCode(error) === HTTP_NOT_FOUND) {
          return null;
        }
        throw error;
      }
    },
    getLock: async (lockId) => {
      try {
        return await db.getRow<ContentNotifications>({
          databaseId: DB,
          rowId: lockId,
          tableId: LOCK_TABLE,
        });
      } catch (error) {
        if (errorCode(error) === HTTP_NOT_FOUND) {
          return null;
        }
        throw error;
      }
    },
    getTranslations: async (type, id) => {
      const list = await db.listRows<ContentTranslations>(
        DB,
        TRANSLATION_TABLE,
        [
          Query.equal("content_type", type),
          Query.equal("content_id", id),
          Query.limit(TRANSLATION_LIMIT),
        ]
      );
      return list.rows as unknown as TranslationRow[];
    },
    listDueLocks: async (now, limit) => {
      const list = await db.listRows<ContentNotifications>(DB, LOCK_TABLE, [
        Query.equal("status", "pending"),
        Query.lessThanEqual("due_at", now.toISOString()),
        Query.orderAsc("due_at"),
        Query.limit(limit),
      ]);
      return list.rows;
    },
    log: (message) => log(`${LOG_TAG} ${message}`),
    // Partial update on purpose: sent_at/announcement_id must survive.
    updateLock: async (lockId, data) => {
      await db.updateRow({
        data,
        databaseId: DB,
        rowId: lockId,
        tableId: LOCK_TABLE,
      });
    },
  };
}

/** Whether another dispatch execution of this function is already running. */
async function anotherDispatchRunning(
  client: AdminClient,
  selfId: string | undefined,
  now: Date
): Promise<boolean> {
  const functionId = process.env.APPWRITE_FUNCTION_ID;
  // Outside the Appwrite runtime (a manual local run) there is nothing to list.
  if (!functionId) {
    return false;
  }
  const list = await client.functions.listExecutions({
    functionId,
    queries: [
      Query.equal("status", ["waiting", "processing"]),
      Query.greaterThan(
        "$createdAt",
        new Date(now.getTime() - STALE_EXECUTION_MS).toISOString()
      ),
      Query.limit(EXECUTION_LIMIT),
    ],
  });
  return isAnotherDispatchRunning(list.executions, selfId, now);
}

export default async function main(context: AppwriteContext) {
  const { req, res, log, error } = context;
  adoptRuntimeApiKey(req.headers);
  try {
    const headers = req.headers ?? {};
    const trigger = classifyTrigger(
      headers,
      process.env.CRON_SECRET,
      asRecord(req.bodyJson)
    );
    if (trigger.kind === "reject") {
      error(`${LOG_TAG} rejected (${trigger.status}): ${trigger.reason}`);
      return res.json({ error: trigger.reason, ok: false }, trigger.status);
    }

    const client = await createAdminClient();
    const deps = buildDeps(client, log);
    const now = new Date();

    if (trigger.kind === "content") {
      const result = await handleContentChange(
        deps,
        trigger.type,
        trigger.id,
        now
      );
      log(`${LOG_TAG} ${trigger.type} ${trigger.id}: ${result}`);
      return res.json({ result });
    }

    const busy = await anotherDispatchRunning(
      client,
      headers["x-appwrite-execution-id"],
      now
    );
    if (busy) {
      log(`${LOG_TAG} another dispatch is running; skipping`);
      return res.json({ skipped: true }, SKIPPED_STATUS_CODE);
    }
    const result = await dispatchDue(deps, now);
    log(`${LOG_TAG} dispatched ${JSON.stringify(result)}`);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`${LOG_TAG} failed: ${message}`);
    return res.json({ error: message, ok: false }, 500);
  }
}
