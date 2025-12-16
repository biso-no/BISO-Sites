"use client";

import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import { PageStatus as PS, PageVisibility as PV } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { upsertManagedPage } from "@/app/actions/pages/actions";
import { translatePageContent } from "@/app/actions/pages/translate";
import { AssistantSidebar } from "@/components/assistant/assistant-sidebar";
import { AssistantTrigger } from "@/components/assistant/assistant-trigger";
import {
  usePuckContentHandler,
  PuckGenerationIndicator,
} from "@/components/assistant/puck-content-handler";

const PageEditor = dynamic(
  () => import("@repo/editor/editor").then((mod) => mod.PageEditor),
  { ssr: false }
);

type LocaleData = {
  title: string;
  description: string;
  data: Data;
};

type UnifiedEditorClientProps = {
  pageId?: string;
  initialSlug: string;
  initialLocaleData: Record<Locale, LocaleData | null>;
  currentLocale: Locale;
  availableLocales: Locale[];
  status: PageStatus;
  visibility: PageVisibility;
};

const EMPTY_DATA: Data = {
  root: { props: {} },
  content: [],
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

export function UnifiedEditorClient({
  pageId,
  initialSlug,
  initialLocaleData,
  currentLocale: initialCurrentLocale,
  availableLocales,
  status: initialStatus,
  visibility: initialVisibility,
}: UnifiedEditorClientProps) {
  const router = useRouter();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>(initialCurrentLocale);
  const [localeData, setLocaleData] = useState<Record<Locale, LocaleData | null>>(
    initialLocaleData
  );
  const [slug, setSlug] = useState(initialSlug);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const currentLocaleInfo = localeData[currentLocale] ?? {
    title: "",
    description: "",
    data: EMPTY_DATA,
  };

  const currentData: Data = {
    ...currentLocaleInfo.data,
    root: {
      ...currentLocaleInfo.data.root,
      props: {
        ...(currentLocaleInfo.data.root?.props as any),
        title: currentLocaleInfo.title,
        slug: slug,
      } as any,
    },
  };

  const { handlePuckContent, isGenerating } = usePuckContentHandler({
    onContentComplete: (data) => {
      setLocaleData((prev) => ({
        ...prev,
        [currentLocale]: {
          ...currentLocaleInfo,
          data,
        },
      }));
      toast.success("AI generated content applied to editor");
    },
  });

  const handleLocaleChange = useCallback(
    (newLocale: Locale) => {
      setCurrentLocale(newLocale);
    },
    []
  );

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
        content: data.content as Array<{ type: string; props: Record<string, unknown> }>,
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

      toast.success(`Content translated to ${targetLocale === "en" ? "English" : "Norwegian"}`);
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
      const slugFromRoot = (data.root?.props as any)?.slug || slug || sanitizeSlug(titleFromRoot);

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

          if (!locData || !locData.title.trim()) {
            return null;
          }

          return {
            locale,
            title: locData.title,
            slug: null,
            description: locData.description || null,
            draftDocument: locData.data,
            publish: false,
          };
        })
        .filter((t) => t !== null);

      if (translations.length === 0) {
        toast.error("At least one locale must have content");
        return;
      }

      const result = await upsertManagedPage({
        pageId,
        slug: slugFromRoot,
        title: titleFromRoot,
        status: PS.DRAFT,
        visibility: initialVisibility,
        translations,
      });

      setLocaleData(updatedLocaleData);
      setSlug(slugFromRoot);

      if (!pageId) {
        router.push(`/admin/pages/${result.id}`);
        toast.success("Page created and draft saved");
      } else {
        toast.success("Draft saved successfully");
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
    const slugFromRoot = (data.root?.props as any)?.slug || slug || sanitizeSlug(titleFromRoot);

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
        slug: slugFromRoot,
        title: titleFromRoot,
        status: PS.PUBLISHED,
        visibility: initialVisibility,
        translations,
      });

      setLocaleData(updatedLocaleData);
      setSlug(slugFromRoot);

      if (!pageId) {
        router.push(`/admin/pages/${result.id}`);
        toast.success("Page created and published");
      } else {
        toast.success("Page published successfully");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish page");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageEditor
        availableLocales={availableLocales}
        description={currentLocaleInfo.description}
        initialData={currentData}
        locale={currentLocale}
        onBack={() => router.push("/admin/pages")}
        onLocaleChange={handleLocaleChange}
        onPublish={handlePublish}
        onSave={handleSave}
        onTranslate={handleTranslate}
        slug={slug}
        status={initialStatus}
        title={currentLocaleInfo.title}
        visibility={initialVisibility}
      />

      <div className="fixed bottom-6 right-6 z-50 flex items-end gap-4">
        <AssistantSidebar
          currentPath={pageId ? `/admin/pages/${pageId}` : "/admin/pages/new"}
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          onPuckContent={handlePuckContent}
          puckData={currentLocaleInfo.data}
        />
        {!isAssistantOpen && (
          <AssistantTrigger onClick={() => setIsAssistantOpen(true)} />
        )}
      </div>

      <PuckGenerationIndicator isGenerating={isGenerating} />
    </>
  );
}
