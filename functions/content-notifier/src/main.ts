/**
 * content-notifier Appwrite Function.
 *
 * Sends automatic push notifications when events, news and jobs go live. Two
 * kinds of execution reach this one function:
 *  - Appwrite events on `events`/`news`/`jobs` rows: keep the item's lock row
 *    (`content_notifications`) in step with the content.
 *  - A schedule or secret-guarded HTTP ping (from scheduled-dispatch): send
 *    every lock that has come due.
 * Dispatch passes should not overlap. A best-effort guard skips (200,
 * `{ ok: true, skipped: "already-running" }`) when it can see another dispatch
 * execution in flight; Appwrite persists sync/domain executions only after
 * they finish, so the guard mostly catches scheduled runs. The real protection
 * is that domain executions are capped at ~30s against a 5-minute ping, and
 * that locks are marked sent before the push (at most once on any failure).
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
import { dispatchAnnouncement } from "@repo/shared/utils/push-dispatch";
import { handleRequest } from "./handler";
import { isAnotherDispatchRunning, STALE_EXECUTION_MS } from "./overlap";
import type { NotifierDeps, TranslationRow } from "./run";
import { adoptRuntimeApiKey } from "./runtime-key";

const DB = "app";
const LOCK_TABLE = "content_notifications";
const ANNOUNCEMENT_TABLE = "announcements";
const TRANSLATION_TABLE = "content_translations";
const TRANSLATION_LIMIT = 10;
const EXECUTION_LIMIT = 25;
const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;
const LOG_TAG = "[content-notifier]";

type LogFn = (...messages: unknown[]) => void;

interface AppwriteContext {
  error: LogFn;
  log: LogFn;
  req: {
    bodyJson?: unknown;
    bodyText?: string;
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
      Query.equal("trigger", ["http", "schedule"]),
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
    const client = await createAdminClient();
    const result = await handleRequest({
      deps: buildDeps(client, log),
      isDispatchRunning: (selfId) =>
        anotherDispatchRunning(client, selfId, new Date()),
      now: new Date(),
      req,
      secret: process.env.CRON_SECRET,
    });
    if (result.status >= HTTP_BAD_REQUEST) {
      error(
        `${LOG_TAG} rejected (${result.status}): ${JSON.stringify(result.body)}`
      );
    }
    return res.json(result.body, result.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`${LOG_TAG} failed: ${message}`);
    return res.json({ error: message, ok: false }, HTTP_SERVER_ERROR);
  }
}
