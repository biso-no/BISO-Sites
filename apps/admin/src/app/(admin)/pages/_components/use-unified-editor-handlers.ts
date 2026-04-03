import {
  useEntityContext,
  usePageContext,
} from "@repo/ai/hooks/use-copilot-context";
import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import { PageStatus as PS } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { sanitizeSlug } from "@/lib/utils";
import { upsertManagedPage } from "@/app/actions/pages/actions";
import { generateSeoMetadata } from "@/app/actions/pages/seo";
import { translatePageContent } from "@/app/actions/pages/translate";
import type { UntranslatedLocaleInfo } from "./translation-check-modal";

type LocaleData = {
  title: string;
  description: string;
  data: Data;
};

type UseUnifiedEditorHandlersProps = {
  currentLocale: Locale;
  localeData: Record<Locale, LocaleData | null>;
  setLocaleData: React.Dispatch<
    React.SetStateAction<Record<Locale, LocaleData | null>>
  >;
  setCurrentLocale: (locale: Locale) => void;
  availableLocales: Locale[];
  effectiveSlug: string;
  enforcedDepartmentSlug: string | null;
  pageId?: string;
  initialVisibility: PageVisibility;
  setSlug: (slug: string) => void;
};

// ── Detection helpers ──────────────────────────────────────────────────────

const TEXT_FIELD_KEYS = new Set([
  "title",
  "text",
  "description",
  "subtitle",
  "content",
  "heading",
  "label",
  "buttonText",
  "paragraph",
  "badge",
  "bio",
  "role",
]);

function hasTextContent(props: Record<string, unknown>): boolean {
  for (const key of TEXT_FIELD_KEYS) {
    const val = props[key];
    if (typeof val === "string" && val.trim().length > 0) return true;
  }
  return false;
}

function detectUntranslatedLocales(
  localeData: Record<string, LocaleData | null>,
  currentLocale: Locale,
  availableLocales: Locale[]
): UntranslatedLocaleInfo[] {
  const sourceData = localeData[currentLocale];
  if (!sourceData) return [];

  const results: UntranslatedLocaleInfo[] = [];

  for (const locale of availableLocales) {
    if (locale === currentLocale) continue;
    const locData = localeData[locale];

    if (!locData?.title.trim()) {
      results.push({
        locale,
        missingFields: ["title", "all content"],
        blockCount: sourceData.data.content.length,
        filledBlockCount: 0,
      });
      continue;
    }

    const missingFields: string[] = [];
    if (!locData.title.trim()) missingFields.push("title");
    if (!locData.description.trim() && sourceData.description.trim()) {
      missingFields.push("description");
    }

    let filledBlockCount = 0;
    for (let i = 0; i < locData.data.content.length; i++) {
      const block = locData.data.content[i];
      if (hasTextContent((block.props ?? {}) as Record<string, unknown>)) {
        filledBlockCount++;
      } else {
        missingFields.push(`${block.type} (block ${i + 1})`);
      }
    }

    if (missingFields.length > 0) {
      results.push({
        locale,
        missingFields,
        blockCount: locData.data.content.length,
        filledBlockCount,
      });
    }
  }

  return results;
}

// ── Main hook ──────────────────────────────────────────────────────────────

export function useUnifiedEditorHandlers({
  currentLocale,
  localeData,
  setLocaleData,
  setCurrentLocale,
  availableLocales,
  effectiveSlug,
  enforcedDepartmentSlug,
  pageId,
  initialVisibility,
  setSlug,
}: UseUnifiedEditorHandlersProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Translation modal state
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [untranslatedLocales, setUntranslatedLocales] = useState<
    UntranslatedLocaleInfo[]
  >([]);
  const [translationProgress, setTranslationProgress] = useState<
    Record<string, "pending" | "translating" | "done" | "error">
  >({});

  // Always-current reference to localeData — needed after async state updates
  const localeDataRef = useRef(localeData);
  localeDataRef.current = localeData;

  // Pending publish args stored when the modal intercepts the publish action
  const pendingPublishRef = useRef<{
    data: Data;
    metadata: { title: string; slug: string; description?: string };
    tentativeLocaleData: Record<string, LocaleData | null>;
  } | null>(null);

  /**
   * Core persistence logic shared by save (draft) and publish.
   */
  async function persistPage(
    data: Data,
    metadata: { title: string; slug: string; description?: string },
    opts: {
      publish: boolean;
      extraLocaleData?: Record<string, LocaleData | null>;
      /** Explicit locale data snapshot to use instead of the ref (post-translation) */
      snapshotLocaleData?: Record<string, LocaleData | null>;
    }
  ): Promise<{ id: string }> {
    const titleFromRoot =
      ((data.root?.props as Record<string, unknown>)?.title as
        | string
        | undefined) || metadata.title;
    const slugFromRoot =
      ((data.root?.props as Record<string, unknown>)?.slug as
        | string
        | undefined) ||
      effectiveSlug ||
      sanitizeSlug(titleFromRoot);
    const resolvedSlug = enforcedDepartmentSlug ?? slugFromRoot;

    const baseLocaleData = opts.snapshotLocaleData ?? localeDataRef.current;

    const updatedLocaleData: Record<string, LocaleData | null> = {
      ...baseLocaleData,
      ...opts.extraLocaleData,
      [currentLocale]: {
        title: titleFromRoot,
        description: metadata.description ?? "",
        data,
      },
    };

    const translations = availableLocales
      .map((locale) => {
        const locData = updatedLocaleData[locale];
        // Always include the locale being saved; skip other locales that haven't
        // been filled out yet (e.g. the second locale on a brand-new page).
        if (locale !== currentLocale && !locData?.title.trim()) return null;
        if (!locData) return null;
        return {
          locale,
          // Fall back to slug for untitled drafts so a title-less new page can
          // still be saved. Publish already guards against empty titles earlier.
          title: locData.title.trim() || resolvedSlug || "Untitled",
          slug: null,
          description: locData.description || null,
          draftDocument: locData.data,
          publish: opts.publish,
        };
      })
      .filter((t) => t !== null);

    if (translations.length === 0) {
      throw new Error("At least one locale must have content");
    }

    const result = await upsertManagedPage({
      pageId,
      slug: resolvedSlug,
      title: titleFromRoot,
      status: opts.publish ? PS.PUBLISHED : PS.DRAFT,
      visibility: initialVisibility,
      translations,
    });

    setLocaleData(updatedLocaleData as Record<Locale, LocaleData | null>);
    setSlug(resolvedSlug);

    return result;
  }

  /**
   * Shared publish execution — runs after any translation step or directly.
   */
  async function executePublish(
    data: Data,
    metadata: { title: string; slug: string; description?: string },
    snapshotLocaleData?: Record<string, LocaleData | null>
  ) {
    setIsSaving(true);
    try {
      const tentative = snapshotLocaleData ?? {
        ...localeDataRef.current,
        [currentLocale]: {
          title:
            ((data.root?.props as Record<string, unknown>)?.title as string) ||
            metadata.title,
          description: metadata.description ?? "",
          data,
        },
      };

      // Auto-generate SEO metadata for locales missing it
      const seoEnriched: Record<string, LocaleData | null> = {};
      for (const locale of availableLocales) {
        const locData = tentative[locale];
        if (!locData) continue;
        const rootProps = (locData.data.root?.props ?? {}) as Record<
          string,
          unknown
        >;
        const hasSeo =
          (rootProps.seoTitle as string)?.trim() ||
          (rootProps.seoDescription as string)?.trim();

        if (!hasSeo) {
          const contentSummary = locData.data.content
            ?.slice(0, 8)
            .map((b) => {
              const p = (b.props ?? {}) as Record<string, unknown>;
              return `[${b.type}] ${(p.title as string) || (p.text as string) || ""}`.trim();
            })
            .filter(Boolean)
            .join("; ");

          const generated = await generateSeoMetadata({
            title: locData.title,
            description: locData.description,
            contentSummary,
          });

          if (generated) {
            seoEnriched[locale] = {
              ...locData,
              data: {
                ...locData.data,
                root: {
                  ...locData.data.root,
                  props: {
                    ...(rootProps as object),
                    seoTitle: generated.seoTitle,
                    seoDescription: generated.seoDescription,
                  } as Record<string, unknown>,
                },
              },
            };
          }
        }
      }

      const result = await persistPage(data, metadata, {
        publish: true,
        extraLocaleData: seoEnriched,
        snapshotLocaleData: tentative,
      });

      if (pageId) {
        toast.success("Page published successfully");
      } else {
        router.push(`/pages/${result.id}`);
        toast.success("Page created and published");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to publish page"
      );
    } finally {
      setIsSaving(false);
    }
  }

  const handleTranslate = async (
    data: Data,
    metadata: { title: string; slug: string; description?: string },
    targetLocale: Locale
  ) => {
    if (!data.content || data.content.length === 0) {
      toast.error("No content to translate");
      return;
    }

    setIsTranslating(true);
    try {
      const titleFromRoot =
        ((data.root?.props as Record<string, unknown>)?.title as string) ||
        metadata.title;

      const result = await translatePageContent({
        sourceLocale: currentLocale,
        targetLocale,
        title: titleFromRoot,
        description: metadata.description,
        content: data.content as Array<{
          type: string;
          props: Record<string, unknown>;
        }>,
      });

      setLocaleData((prev) => ({
        ...prev,
        [currentLocale]: {
          title: titleFromRoot,
          description: metadata.description ?? "",
          data,
        },
        [targetLocale]: {
          title: result.title,
          description: result.description,
          data: {
            ...data,
            content: result.content,
            root: {
              ...data.root,
              props: {
                ...(data.root?.props as object),
                title: result.title,
                description: result.description,
                // slug intentionally not overwritten — stays the same across locales
              },
            },
          },
        },
      }));

      toast.success(
        `Content translated to ${targetLocale === "en" ? "English" : "Norwegian"}`
      );

      setCurrentLocale(targetLocale);
    } catch (error) {
      console.error(error);
      toast.error("Failed to translate content");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSave = async (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => {
    setIsSaving(true);
    try {
      const result = await persistPage(data, metadata, { publish: false });
      if (pageId) {
        toast.success("Draft saved successfully");
      } else {
        router.push(`/pages/${result.id}`);
        toast.success("Page created and draft saved");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save draft"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => {
    const tentativeLocaleData: Record<string, LocaleData | null> = {
      ...localeDataRef.current,
      [currentLocale]: {
        title:
          ((data.root?.props as Record<string, unknown>)?.title as string) ||
          metadata.title,
        description: metadata.description ?? "",
        data,
      },
    };

    // Validate all locales have at least a title and some content
    const hasAllLocales = availableLocales.every((locale) => {
      const locData = tentativeLocaleData[locale];
      return locData && locData.title.trim() && locData.data.content?.length;
    });

    if (!hasAllLocales) {
      toast.error("All locales must have content before publishing");
      return;
    }

    // Check for untranslated / empty locales — show modal if any found
    const untranslated = detectUntranslatedLocales(
      tentativeLocaleData,
      currentLocale,
      availableLocales
    );

    if (untranslated.length > 0) {
      pendingPublishRef.current = { data, metadata, tentativeLocaleData };
      setUntranslatedLocales(untranslated);
      setTranslationProgress(
        Object.fromEntries(
          untranslated.map((u) => [u.locale, "pending" as const])
        )
      );
      setShowTranslationModal(true);
      return;
    }

    await executePublish(data, metadata, tentativeLocaleData);
  };

  // ── Modal callbacks ──────────────────────────────────────────────────────

  const handleTranslateAndPublish = async () => {
    const pending = pendingPublishRef.current;
    if (!pending) return;

    setIsTranslating(true);
    const { data, metadata, tentativeLocaleData } = pending;

    // Start from the tentative snapshot so current-locale edits are captured
    let latestLocaleData: Record<string, LocaleData | null> = {
      ...tentativeLocaleData,
    };

    try {
      for (const info of untranslatedLocales) {
        setTranslationProgress((prev) => ({
          ...prev,
          [info.locale]: "translating",
        }));

        try {
          const sourceData = latestLocaleData[currentLocale];
          if (!sourceData) continue;

          const result = await translatePageContent({
            sourceLocale: currentLocale,
            targetLocale: info.locale,
            title: sourceData.title,
            description: sourceData.description,
            content: sourceData.data.content as Array<{
              type: string;
              props: Record<string, unknown>;
            }>,
          });

          latestLocaleData = {
            ...latestLocaleData,
            [info.locale]: {
              title: result.title,
              description: result.description,
              data: {
                ...sourceData.data,
                content: result.content as Data["content"],
                root: {
                  ...sourceData.data.root,
                  props: {
                    ...(sourceData.data.root?.props as object),
                    title: result.title,
                    description: result.description,
                    // slug intentionally not overwritten — stays the same across locales
                  },
                },
              },
            },
          };

          setTranslationProgress((prev) => ({
            ...prev,
            [info.locale]: "done",
          }));
        } catch {
          setTranslationProgress((prev) => ({
            ...prev,
            [info.locale]: "error",
          }));
        }
      }

      setShowTranslationModal(false);
      await executePublish(data, metadata, latestLocaleData);
    } finally {
      setIsTranslating(false);
      pendingPublishRef.current = null;
    }
  };

  const handleSkipAndPublish = async () => {
    const pending = pendingPublishRef.current;
    if (!pending) return;
    setShowTranslationModal(false);
    pendingPublishRef.current = null;
    await executePublish(
      pending.data,
      pending.metadata,
      pending.tentativeLocaleData
    );
  };

  const handleCancelPublish = () => {
    setShowTranslationModal(false);
    pendingPublishRef.current = null;
    setUntranslatedLocales([]);
    setTranslationProgress({});
  };

  return {
    isSaving,
    isTranslating,
    handleTranslate,
    handleSave,
    handlePublish,
    showTranslationModal,
    untranslatedLocales,
    translationProgress,
    handleTranslateAndPublish,
    handleSkipAndPublish,
    handleCancelPublish,
  };
}

// ── Context registration hook ──────────────────────────────────────────────

type UseUnifiedEditorContextsProps = {
  pageId?: string;
  slug: string;
  title: string;
  initialStatus: PageStatus;
  initialVisibility: PageVisibility;
  currentLocale: Locale;
  availableLocales: Locale[];
  localeData: Record<Locale, LocaleData | null>;
};

export function useUnifiedEditorContexts({
  pageId,
  slug,
  title,
  initialStatus,
  initialVisibility,
  currentLocale,
  availableLocales,
  localeData,
}: UseUnifiedEditorContextsProps) {
  useEntityContext(
    pageId
      ? {
          type: "page",
          id: pageId,
          title: title || slug,
          data: {
            slug,
            status: initialStatus,
            visibility: initialVisibility,
            currentLocale,
            availableLocales,
            localeData: Object.fromEntries(
              Object.entries(localeData).map(([locale, data]) => [
                locale,
                data
                  ? { title: data.title, description: data.description }
                  : null,
              ])
            ),
          },
          locale: currentLocale,
          metadata: { status: initialStatus },
        }
      : null
  );

  usePageContext({
    section: "pages",
    viewType: pageId ? "editor" : "create",
    breadcrumb: pageId ? ["Pages", title || slug] : ["Pages", "New Page"],
  });
}
