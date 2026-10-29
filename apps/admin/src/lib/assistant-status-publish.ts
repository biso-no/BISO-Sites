import { restampTranslationReads } from "@/lib/content-translation-reads";

const PAGE_LOCALES = ["no", "en"] as const;
type PageLocale = (typeof PAGE_LOCALES)[number];

const TRANSLATION_TYPES: Record<string, "news" | "job"> = {
  jobs: "job",
  news: "news",
};

const NOTHING_TO_PUBLISH_PREFIX = "Nothing to publish";

type Db = Parameters<typeof restampTranslationReads>[0];

interface PublishPageOutcome {
  missingTranslation: boolean;
}

export interface AssistantStatusPublishDeps {
  getAdminDb: () => Promise<Db>;
  publishPage: (id: string, locale: PageLocale) => Promise<PublishPageOutcome>;
  sessionDb: Pick<Db, "updateRow">;
}

export interface AssistantPublishResult {
  /** Page locales that went live. */
  published: PageLocale[];
  /** Page locales with no translation or nothing to publish. */
  skipped: PageLocale[];
}

/**
 * The access check before an assistant publish. Pages skip the session read:
 * draft page rows are not readable that way, and the page publish action runs
 * its own `requireAuth` and access checks. Every other domain reads the row
 * and checks the caller's campus access.
 */
export async function authorisePublishRow(
  domain: string,
  checks: {
    assertAccess: (campusId: string | null) => void;
    readRow: () => Promise<Record<string, unknown>>;
  }
): Promise<void> {
  if (domain === "pages") {
    return;
  }
  const row = await checks.readRow();
  checks.assertAccess(typeof row.campus_id === "string" ? row.campus_id : null);
}

/** A locale that has nothing to publish is skipped, not a failure. */
async function publishLocale(
  deps: AssistantStatusPublishDeps,
  id: string,
  locale: PageLocale
): Promise<boolean> {
  try {
    const outcome = await deps.publishPage(id, locale);
    return !outcome.missingTranslation;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(NOTHING_TO_PUBLISH_PREFIX)
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Publishes assistant-managed content that goes live by a status change.
 * Pages go through the page publish action (its own auth checks, draft to
 * published document, locale by locale); a locale with no translation or
 * nothing to publish is skipped and named in the result. News and jobs write
 * the status and then restamp their translations' read permissions with the
 * admin client. Callers authorise the user for the row before calling this.
 */
export async function publishAssistantStatusContent(
  domain: string,
  table: string,
  id: string,
  deps: AssistantStatusPublishDeps
): Promise<AssistantPublishResult | undefined> {
  if (domain === "pages") {
    const result: AssistantPublishResult = { published: [], skipped: [] };
    for (const locale of PAGE_LOCALES) {
      if (await publishLocale(deps, id, locale)) {
        result.published.push(locale);
      } else {
        result.skipped.push(locale);
      }
    }
    if (result.published.length === 0) {
      throw new Error("The page has no content to publish");
    }
    return result;
  }
  await deps.sessionDb.updateRow("app", table, id, { status: "published" });
  const translationType = TRANSLATION_TYPES[domain];
  if (translationType) {
    await restampTranslationReads(
      await deps.getAdminDb(),
      translationType,
      id,
      "published"
    );
  }
  return;
}
