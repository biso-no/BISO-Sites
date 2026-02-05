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
import { useState } from "react";
import { toast } from "sonner";
import { upsertManagedPage } from "@/app/actions/pages/actions";
import { translatePageContent } from "@/app/actions/pages/translate";

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
  availableLocales: Locale[];
  effectiveSlug: string;
  enforcedDepartmentSlug: string | null;
  pageId?: string;
  initialVisibility: PageVisibility;
  setSlug: (slug: string) => void;
};

function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function useUnifiedEditorHandlers({
  currentLocale,
  localeData,
  setLocaleData,
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
      const titleFromRoot = (data.root?.props as any)?.title || metadata.title;

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
                ...(data.root?.props as any),
                title: result.title,
              },
            },
          },
        },
      }));

      toast.success(
        `Content translated to ${targetLocale === "en" ? "English" : "Norwegian"}`
      );
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
      const titleFromRoot = (data.root?.props as any)?.title || metadata.title;
      const slugFromRoot =
        (data.root?.props as any)?.slug ||
        effectiveSlug ||
        sanitizeSlug(titleFromRoot);
      const resolvedSlug = enforcedDepartmentSlug ?? slugFromRoot;

      const updatedLocaleData = {
        ...localeData,
        [currentLocale]: {
          title: titleFromRoot,
          description: metadata.description ?? "",
          data,
        },
      };

      const translations = availableLocales
        .map((locale) => {
          const locData = updatedLocaleData[locale];

          if (locData?.title.trim()) {
            return {
              locale,
              title: locData.title,
              slug: null,
              description: locData.description || null,
              draftDocument: locData.data,
              publish: false,
            };
          }
          return null;
        })
        .filter((t) => t !== null);

      if (translations.length === 0) {
        toast.error("At least one locale must have content");
        return;
      }

      const result = await upsertManagedPage({
        pageId,
        slug: resolvedSlug,
        title: titleFromRoot,
        status: PS.DRAFT,
        visibility: initialVisibility,
        translations,
      });

      setLocaleData(updatedLocaleData);
      setSlug(resolvedSlug);

      if (pageId) {
        toast.success("Draft saved successfully");
      } else {
        router.push(`/pages/${result.id}`);
        toast.success("Page created and draft saved");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => {
    const titleFromRoot = (data.root?.props as any)?.title || metadata.title;
    const slugFromRoot =
      (data.root?.props as any)?.slug ||
      effectiveSlug ||
      sanitizeSlug(titleFromRoot);
    const resolvedSlug = enforcedDepartmentSlug ?? slugFromRoot;

    const updatedLocaleData = {
      ...localeData,
      [currentLocale]: {
        title: titleFromRoot,
        description: metadata.description ?? "",
        data,
      },
    };

    const hasAllLocales = availableLocales.every((locale) => {
      const locData = updatedLocaleData[locale];
      return (
        locData &&
        locData.title.trim() !== "" &&
        locData.data.content &&
        locData.data.content.length > 0
      );
    });

    if (!hasAllLocales) {
      toast.error("All locales must have content before publishing");
      return;
    }

    setIsSaving(true);
    try {
      const translations = availableLocales.map((locale) => {
        const locData = updatedLocaleData[locale]!;

        return {
          locale,
          title: locData.title,
          slug: null,
          description: locData.description || null,
          draftDocument: locData.data,
          publish: true,
        };
      });

      const result = await upsertManagedPage({
        pageId,
        slug: resolvedSlug,
        title: titleFromRoot,
        status: PS.PUBLISHED,
        visibility: initialVisibility,
        translations,
      });

      setLocaleData(updatedLocaleData);
      setSlug(resolvedSlug);

      if (pageId) {
        toast.success("Page published successfully");
      } else {
        router.push(`/pages/${result.id}`);
        toast.success("Page created and published");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish page");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    isTranslating,
    handleTranslate,
    handleSave,
    handlePublish,
  };
}

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
  // Register entity context with AI copilot (so AI knows what page we're editing)
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

  // Register page context
  usePageContext({
    section: "pages",
    viewType: pageId ? "editor" : "create",
    breadcrumb: pageId ? ["Pages", title || slug] : ["Pages", "New Page"],
  });
}
