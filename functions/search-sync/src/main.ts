/**
 * search-sync Appwrite Function.
 *
 * Keeps the Meilisearch site-search index in step with Appwrite. Two kinds of
 * execution reach it:
 *  - Appwrite row events on the indexed tables: re-read the affected item
 *    with the admin client, map it with the shared mappers, and upsert or
 *    delete its entries (plus the items that depend on it).
 *  - A secret-guarded HTTP call: the full reindex.
 * A table or translation type that is not indexed answers 200 `{ ignored }`.
 * A failed Appwrite read or Meilisearch write answers 500 and reaches Sentry.
 */

import { createAdminClient } from "@repo/api/server";
import { reporterFromEnv } from "@repo/observability/functions";
import { createSearchClient } from "@repo/shared/search/client";
import { searchIndexName } from "@repo/shared/search/settings";
import { handleRequest } from "./handler";
import { runReindex } from "./reindex";
import { reportResponse } from "./report";
import { adoptRuntimeApiKey } from "./runtime-key";
import { settleDelayMs, settleFor } from "./settle";
import { appwriteSource, departmentNames } from "./source";
import type { SyncDeps } from "./sync";
import { siteWriters } from "./writer";

const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;
const LOG_TAG = "[search-sync]";

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

export default async function main(context: AppwriteContext) {
  const reporter = reporterFromEnv(process.env, "search-sync");
  try {
    return await handle(context, reporter);
  } finally {
    await reporter.flush();
  }
}

async function handle(
  context: AppwriteContext,
  reporter: ReturnType<typeof reporterFromEnv>
) {
  const { req, res, log, error } = context;
  adoptRuntimeApiKey(req.headers);
  try {
    const { db } = await createAdminClient();
    const search = createSearchClient(
      process.env.MEILISEARCH_HOST,
      process.env.MEILISEARCH_ADMIN_KEY
    );
    const writers = siteWriters(search, searchIndexName());
    const deps: SyncDeps = {
      log: (message) => log(`${LOG_TAG} ${message}`),
      now: () => new Date(),
      // The name cache lives for this execution only.
      source: appwriteSource(db, { departmentName: departmentNames(db) }),
      writer: writers.event,
    };
    const result = await handleRequest({
      deps,
      reindex: () => runReindex({ ...deps, writer: writers.reindex }),
      req,
      secret: process.env.CRON_SECRET,
      settle: settleFor(settleDelayMs(process.env.SYNC_SETTLE_MS)),
    });
    reportResponse(reporter, result.status);
    if (result.status >= HTTP_BAD_REQUEST) {
      error(
        `${LOG_TAG} answered ${result.status}: ${JSON.stringify(result.body)}`
      );
    }
    return res.json(result.body, result.status);
  } catch (err) {
    reporter.captureError(err);
    const message = err instanceof Error ? err.message : String(err);
    error(`${LOG_TAG} failed: ${message}`);
    return res.json({ error: message, ok: false }, HTTP_SERVER_ERROR);
  }
}
