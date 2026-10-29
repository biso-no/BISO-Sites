import { restampTranslationReads } from "@/lib/content-translation-reads";

const PAGE_LOCALES = ["no", "en"] as const;

const TRANSLATION_TYPES: Record<string, "news" | "job"> = {
  jobs: "job",
  news: "news",
};

type Db = Parameters<typeof restampTranslationReads>[0];

interface PublishPageOutcome {
  missingTranslation: boolean;
}

export interface AssistantStatusPublishDeps {
  getAdminDb: () => Promise<Db>;
  publishPage: (id: string, locale: "no" | "en") => Promise<PublishPageOutcome>;
  sessionDb: Pick<Db, "updateRow">;
}

/**
 * Publishes assistant-managed content that goes live by a status change.
 * Pages go through the page publish action (its own auth checks, draft to
 * published document, locale by locale); news and jobs write the status
 * and then restamp their translations' read permissions with the admin
 * client. Callers authorise the user for the row before calling this.
 */
export async function publishAssistantStatusContent(
  domain: string,
  table: string,
  id: string,
  deps: AssistantStatusPublishDeps
): Promise<void> {
  if (domain === "pages") {
    let published = 0;
    for (const locale of PAGE_LOCALES) {
      const outcome = await deps.publishPage(id, locale);
      if (!outcome.missingTranslation) {
        published += 1;
      }
    }
    if (published === 0) {
      throw new Error("The page has no content to publish");
    }
    return;
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
}
