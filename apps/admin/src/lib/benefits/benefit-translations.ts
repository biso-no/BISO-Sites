import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  CampusBenefits,
  ContentTranslations,
} from "@repo/api/types/appwrite";
import {
  type AutoTranslationOptions,
  type ContentLocale,
  getTargetLocale,
  isCurrentTranslationSource,
} from "@/lib/content-translation";
import {
  scheduleContentTranslation,
  translateContentFields,
} from "@/lib/content-translation.server";
import { buildContentTranslationPermissions } from "@/lib/utils";
import { isFormattedDescription } from "./benefit-description";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface BenefitTranslationSnapshot {
  description: string;
  title: string;
}

/** Form values, built columns and stored rows all carry these four fields. */
type BenefitTextSource = Partial<
  Record<"description_en" | "description_nb" | "title_en" | "title_nb", unknown>
>;

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

export const benefitTextSnapshot = (
  source: BenefitTextSource,
  locale: ContentLocale
): BenefitTranslationSnapshot =>
  locale === "no"
    ? { description: text(source.description_nb), title: text(source.title_nb) }
    : {
        description: text(source.description_en),
        title: text(source.title_en),
      };

export const benefitTranslationPermissions = (status: string): string[] =>
  buildContentTranslationPermissions({
    audience: "public",
    status,
    writeTeams: [],
  });

export const translateBenefitSnapshot = async (
  source: BenefitTranslationSnapshot,
  sourceLocale: ContentLocale
): Promise<BenefitTranslationSnapshot> => {
  const translated = await translateContentFields({
    contentType: "member benefit",
    fields: [
      { format: "plain", key: "title", value: source.title },
      {
        // The panel writes plain text; rows from the old editors hold HTML.
        format: isFormattedDescription(source.description) ? "html" : "plain",
        key: "description",
        value: source.description,
      },
    ],
    sourceLocale,
    targetLocale: getTargetLocale(sourceLocale),
  });
  return {
    description: translated.description ?? "",
    title: translated.title ?? "",
  };
};

const hasBenefitLocaleContent = (
  snapshot: BenefitTranslationSnapshot
): boolean => Boolean(snapshot.title.trim() || snapshot.description.trim());

interface NestedBenefitTranslation {
  $id?: string;
  $permissions: string[];
  additional_fields: null;
  content_id: string;
  content_type: "memberBenefit";
  description: string;
  locale: ContentLocale;
  title: string;
}

/**
 * Linked `content_translations` children mirroring the inline bilingual
 * columns, so existing consumers keep reading the inline fields while the
 * relationship becomes complete. An existing `$id` updates that child in
 * place; omitting it creates and links a new one.
 */
export const buildBenefitTranslationChildren = (
  benefitId: string,
  values: BenefitTextSource,
  existingByLocale: Map<string, ContentTranslations>,
  permissions: string[]
): NestedBenefitTranslation[] => {
  const children: NestedBenefitTranslation[] = [];
  for (const locale of ["no", "en"] as const) {
    const snapshot = benefitTextSnapshot(values, locale);
    const existing = existingByLocale.get(locale);
    if (!(hasBenefitLocaleContent(snapshot) || existing)) {
      continue;
    }
    children.push({
      ...(existing ? { $id: existing.$id } : {}),
      $permissions: permissions,
      additional_fields: null,
      content_id: benefitId,
      content_type: "memberBenefit",
      description: snapshot.description,
      locale,
      title: snapshot.title,
    });
  }
  return children;
};

/**
 * Existing locales are looked up by content metadata, not the relation: rows
 * that predate the relationship backfill are unlinked, and matching them here
 * both prevents duplicate locale rows and re-links them on the next save.
 */
export const loadBenefitTranslationsByLocale = async (
  db: AdminDb,
  benefitId: string
): Promise<Map<string, ContentTranslations>> => {
  const current = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "memberBenefit"),
      Query.equal("content_id", benefitId),
      Query.limit(5),
    ]
  );
  return new Map(
    current.rows.map((translation) => [translation.locale, translation])
  );
};

/**
 * Queues the other locale's translation after a save. `values` decides whether
 * the editor wrote anything in the source locale; `columns` is what the save
 * stored (titles fall back to the other locale), which the stale checks
 * compare against.
 */
export const scheduleBenefitTranslation = ({
  benefitId,
  columns,
  options,
  values,
}: {
  benefitId: string;
  columns: BenefitTextSource;
  options?: AutoTranslationOptions;
  values: BenefitTextSource;
}): boolean => {
  if (!options?.enabled) {
    return false;
  }
  const { sourceLocale } = options;
  if (!benefitTextSnapshot(values, sourceLocale).title.trim()) {
    return false;
  }
  const targetLocale = getTargetLocale(sourceLocale);
  const source = benefitTextSnapshot(columns, sourceLocale);
  const destination = benefitTextSnapshot(columns, targetLocale);

  return scheduleContentTranslation({
    enabled: true,
    task: async () => {
      const translated = await translateBenefitSnapshot(source, sourceLocale);
      // Fresh admin client: the request that scheduled this callback is done.
      const { db } = await createAdminClient();
      const response = await db.listRows<CampusBenefits>(
        "app",
        "campus_benefits",
        [Query.equal("$id", benefitId), Query.limit(1)]
      );
      const current = response.rows[0];
      if (!current) {
        return;
      }
      if (
        !isCurrentTranslationSource(
          { ...source },
          { ...benefitTextSnapshot(current, sourceLocale) }
        )
      ) {
        return;
      }
      // The destination is only ours to overwrite while it still holds exactly
      // what this save wrote. An editor who translated the other locale by hand
      // while the model request was in flight owns the newer text.
      if (
        !isCurrentTranslationSource(
          { ...destination },
          { ...benefitTextSnapshot(current, targetLocale) }
        )
      ) {
        return;
      }
      const description = translated.description || null;
      const destinationColumns =
        targetLocale === "en"
          ? { description_en: description, title_en: translated.title }
          : { description_nb: description, title_nb: translated.title };
      await db.updateRow(
        "app",
        "campus_benefits",
        benefitId,
        destinationColumns
      );

      // Mirror the destination into its linked content_translations child so
      // the relationship stays complete alongside the inline columns.
      const translationPermissions = benefitTranslationPermissions(
        current.status
      );
      const existingByLocale = await loadBenefitTranslationsByLocale(
        db,
        benefitId
      );
      const existingTarget = existingByLocale.get(targetLocale);
      const childData = {
        additional_fields: null,
        content_id: benefitId,
        content_type: "memberBenefit" as const,
        description: translated.description,
        locale: targetLocale,
        title: translated.title,
      };
      if (existingTarget) {
        await db.updateRow(
          "app",
          "content_translations",
          existingTarget.$id,
          childData,
          translationPermissions
        );
        return;
      }
      await db.createRow(
        "app",
        "content_translations",
        ID.unique(),
        // A fresh destination row must arrive already related to its parent.
        { ...childData, memberBenefit: benefitId },
        translationPermissions
      );
    },
  });
};
