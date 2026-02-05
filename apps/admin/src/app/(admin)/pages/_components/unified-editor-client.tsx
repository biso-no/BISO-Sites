"use client";

import {
  useCopilotPuck,
  useStreamingPuck,
} from "@repo/ai/hooks/use-copilot-puck";
import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import type { EditorContext } from "@repo/editor/editor-context";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PuckGenerationIndicator } from "@/components/assistant/puck-content-handler";
import {
  useUnifiedEditorContexts,
  useUnifiedEditorHandlers,
} from "./use-unified-editor-handlers";

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
  pageContext?: {
    campusId?: string | null;
    departmentId?: string | null;
  };
  userContext: {
    campusNames: string[];
    departmentNames: string[];
    managedCampuses: string[];
    isGlobalAdmin: boolean;
    isCampusAdmin: boolean;
  };
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

function getEditorScope(
  pageContext: UnifiedEditorClientProps["pageContext"],
  userContext: UnifiedEditorClientProps["userContext"],
  isDepartmentUser: boolean
): EditorContext["page"]["scope"] {
  if (pageContext?.departmentId) {
    return "department";
  }
  if (pageContext?.campusId) {
    return "campus";
  }
  if (isDepartmentUser) {
    return "department";
  }
  if (userContext.isCampusAdmin) {
    return "campus";
  }
  return "global";
}

export function UnifiedEditorClient({
  pageId,
  initialSlug,
  initialLocaleData,
  currentLocale: initialCurrentLocale,
  availableLocales,
  status: initialStatus,
  visibility: initialVisibility,
  pageContext,
  userContext,
}: UnifiedEditorClientProps) {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] =
    useState<Locale>(initialCurrentLocale);
  const [localeData, setLocaleData] =
    useState<Record<Locale, LocaleData | null>>(initialLocaleData);
  const [slug, setSlug] = useState(initialSlug);
  /* replaced by hook */
  // Track selected block index for targeted AI editing
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<
    number | undefined
  >(undefined);

  const currentLocaleInfo = localeData[currentLocale] ?? {
    title: "",
    description: "",
    data: EMPTY_DATA,
  };

  const isDepartmentUser =
    userContext.departmentNames.length > 0 &&
    !userContext.isGlobalAdmin &&
    !userContext.isCampusAdmin;

  const enforcedDepartmentSlug = isDepartmentUser
    ? sanitizeSlug(userContext.departmentNames[0] ?? "")
    : null;

  const effectiveSlug = enforcedDepartmentSlug ?? slug;

  const currentData: Data = useMemo(
    () => ({
      ...currentLocaleInfo.data,
      root: {
        ...currentLocaleInfo.data.root,
        props: {
          ...(currentLocaleInfo.data.root?.props as any),
          title: currentLocaleInfo.title,
          slug: effectiveSlug,
        } as any,
      },
    }),
    [currentLocaleInfo, effectiveSlug]
  );

  // Track if AI is generating content
  const [isGenerating, setIsGenerating] = useState(false);

  // Handler for data changes from AI (used by both hooks)
  const handleDataChange = useCallback(
    (newData: Data) => {
      setIsGenerating(true);

      // Update our local state
      setLocaleData((prev) => ({
        ...prev,
        [currentLocale]: {
          ...currentLocaleInfo,
          data: newData,
        },
      }));

      // Reset generating state after a short delay
      setTimeout(() => setIsGenerating(false), 500);
    },
    [currentLocale, currentLocaleInfo]
  );

  // Register Puck editor with AI copilot for streaming block generation
  useCopilotPuck({
    data: currentData,
    onDataChange: handleDataChange as (data: {
      content: { type: string; props: Record<string, unknown> }[];
      root?: { props?: Record<string, unknown> | undefined } | undefined;
    }) => void,
    capability: pageId ? "edit-page" : "create-page",
  });

  // NEW: Use streaming hook for json-render based generation
  const { isStreaming, generate, abort } = useStreamingPuck({
    data: currentData,
    onDataChange: handleDataChange,
    selectedBlockIndex,
  });

  // Register entity and page contexts
  useUnifiedEditorContexts({
    pageId,
    slug,
    title: currentLocaleInfo.title || slug,
    initialStatus,
    initialVisibility,
    currentLocale,
    availableLocales,
    localeData,
  });

  const handleLocaleChange = useCallback((newLocale: Locale) => {
    setCurrentLocale(newLocale);
  }, []);
  const {
    isSaving,
    isTranslating,
    handleTranslate,
    handleSave,
    handlePublish,
  } = useUnifiedEditorHandlers({
    currentLocale,
    localeData,
    setLocaleData,
    availableLocales,
    effectiveSlug,
    enforcedDepartmentSlug,
    pageId,
    initialVisibility,
    setSlug,
  });

  const scope = getEditorScope(pageContext, userContext, isDepartmentUser);

  const editorContext: EditorContext = {
    page: {
      id: pageId,
      status: initialStatus,
      scope,
      campusId: pageContext?.campusId ?? null,
      departmentId:
        pageContext?.departmentId ??
        (isDepartmentUser ? (userContext.departmentNames[0] ?? null) : null),
    },
    user: userContext,
    constraints: {
      slugLocked: !!enforcedDepartmentSlug,
    },
  };

  return (
    <>
      <PageEditor
        availableLocales={availableLocales}
        description={currentLocaleInfo.description}
        editorContext={editorContext}
        initialData={currentData}
        locale={currentLocale}
        onBack={() => router.push("/pages")}
        onLocaleChange={handleLocaleChange}
        onPublish={handlePublish}
        onSave={handleSave}
        onTranslate={handleTranslate}
        slug={effectiveSlug}
        status={initialStatus}
        title={currentLocaleInfo.title}
        visibility={initialVisibility}
      />

      <PuckGenerationIndicator isGenerating={isGenerating || isStreaming} />
    </>
  );
}
