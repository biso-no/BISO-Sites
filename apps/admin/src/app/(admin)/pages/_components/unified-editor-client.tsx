"use client";

import {
  useEntityContext,
  usePageContext,
} from "@repo/ai/hooks/use-copilot-context";
import {
  useCopilotPuck,
  useStreamingPuck,
} from "@repo/ai/hooks/use-copilot-puck";
import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import { PageStatus as PS } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { upsertManagedPage } from "@/app/actions/pages/actions";
import { translatePageContent } from "@/app/actions/pages/translate";
import { PuckGenerationIndicator } from "@/components/assistant/puck-content-handler";

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
  const [currentLocale, setCurrentLocale] =
    useState<Locale>(initialCurrentLocale);
  const [localeData, setLocaleData] =
    useState<Record<Locale, LocaleData | null>>(initialLocaleData);
  const [slug, setSlug] = useState(initialSlug);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Track selected block index for targeted AI editing
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<
    number | undefined
  >(undefined);

  const currentLocaleInfo = localeData[currentLocale] ?? {
    title: "",
    description: "",
    data: EMPTY_DATA,
  };

  const currentData: Data = useMemo(
    () => ({
      ...currentLocaleInfo.data,
      root: {
        ...currentLocaleInfo.data.root,
        props: {
          ...(currentLocaleInfo.data.root?.props as any),
          title: currentLocaleInfo.title,
          slug,
        } as any,
      },
    }),
    [currentLocaleInfo, slug]
  );

  // Track if AI is generating content
  const [isGenerating, setIsGenerating] = useState(false);

  // Ref to hold the setData function from PageEditor
  const setEditorDataRef = useRef<((data: Data) => void) | null>(null);

  // Callback when PageEditor exposes its setData function
  const handleDispatchReady = useCallback((setData: (data: Data) => void) => {
    console.log("[UnifiedEditor] PageEditor dispatch ready");
    setEditorDataRef.current = setData;
  }, []);

  // Handler for data changes from AI (used by both hooks)
  const handleDataChange = useCallback(
    (newData: Data) => {
      console.log(
        "[Editor] onDataChange called, content length:",
        newData.content?.length
      );
      setIsGenerating(true);

      // Update our local state
      setLocaleData((prev) => ({
        ...prev,
        [currentLocale]: {
          ...currentLocaleInfo,
          data: newData,
        },
      }));

      // ALSO update Puck's internal state directly via the exposed setData
      if (setEditorDataRef.current) {
        console.log("[Editor] Calling PageEditor setData directly");
        setEditorDataRef.current(newData as Data);
      }

      // Reset generating state after a short delay
      setTimeout(() => setIsGenerating(false), 500);
    },
    [currentLocale, currentLocaleInfo]
  );

  // Register Puck editor with AI copilot for streaming block generation
  useCopilotPuck({
    data: currentData,
    onDataChange: handleDataChange as (data: { content: { type: string; props: Record<string, unknown>; }[]; root?: { props?: Record<string, unknown> | undefined; } | undefined; }) => void,
    capability: pageId ? "edit-page" : "create-page",
  });

  // NEW: Use streaming hook for json-render based generation
  const { isStreaming, generate, abort } = useStreamingPuck({
    data: currentData,
    onDataChange: handleDataChange,
    selectedBlockIndex,
  });

  // Register entity context with AI copilot (so AI knows what page we're editing)
  useEntityContext(
    pageId
      ? {
          type: "page",
          id: pageId,
          title: currentLocaleInfo.title || slug,
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
    breadcrumb: pageId
      ? ["Pages", currentLocaleInfo.title || slug]
      : ["Pages", "New Page"],
  });

  const handleLocaleChange = useCallback((newLocale: Locale) => {
    setCurrentLocale(newLocale);
  }, []);

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
        (data.root?.props as any)?.slug || slug || sanitizeSlug(titleFromRoot);

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
        slug: slugFromRoot,
        title: titleFromRoot,
        status: PS.DRAFT,
        visibility: initialVisibility,
        translations,
      });

      setLocaleData(updatedLocaleData);
      setSlug(slugFromRoot);

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
      (data.root?.props as any)?.slug || slug || sanitizeSlug(titleFromRoot);

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

  return (
    <>
      <PageEditor
        availableLocales={availableLocales}
        description={currentLocaleInfo.description}
        initialData={currentData}
        locale={currentLocale}
        onBack={() => router.push("/pages")}
        onDispatchReady={handleDispatchReady}
        onLocaleChange={handleLocaleChange}
        onPublish={handlePublish}
        onSave={handleSave}
        onTranslate={handleTranslate}
        slug={slug}
        status={initialStatus}
        title={currentLocaleInfo.title}
        visibility={initialVisibility}
      />

      <PuckGenerationIndicator isGenerating={isGenerating || isStreaming} />
    </>
  );
}
