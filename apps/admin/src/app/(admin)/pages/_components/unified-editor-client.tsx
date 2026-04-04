"use client";

import {
  useCopilotPuck,
  useStreamingPuckRaw as useStreamingPuck,
} from "@repo/ai/hooks/use-copilot-puck";
import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { config as baseEditorConfig } from "@repo/editor/config";
import {
  AiAssistantContext,
  type AiAssistantContextValue,
  type AiAssistCallbacks,
  type AssistAction,
} from "@repo/editor/contexts/ai-assistant-context";
import type { EditorContext } from "@repo/editor/editor-context";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listDepartmentsWithWriterAccess } from "@/app/actions/events";
import { PuckGenerationIndicator } from "@/components/assistant/puck-content-handler";
import { sanitizeSlug } from "@/lib/utils";
import { TranslationCheckModal } from "./translation-check-modal";
import { useLocaleStructuralSync } from "./use-locale-structural-sync";
import {
  useUnifiedEditorContexts,
  useUnifiedEditorHandlers,
} from "./use-unified-editor-handlers";

const PageEditor = dynamic(
  () => import("@repo/editor/editor").then((mod) => mod.PageEditor),
  { ssr: false }
);

interface LocaleData {
  data: Data;
  description: string;
  title: string;
}

interface UnifiedEditorClientProps {
  availableLocales: Locale[];
  currentLocale: Locale;
  initialLocaleData: Record<Locale, LocaleData | null>;
  initialSlug: string;
  pageContext?: {
    campusId?: string | null;
    departmentId?: string | null;
  };
  pageId?: string;
  status: PageStatus;
  userContext: {
    campusNames: string[];
    departmentNames: string[];
    managedCampuses: string[];
    isGlobalAdmin: boolean;
    isCampusAdmin: boolean;
  };
  visibility: PageVisibility;
}

const EMPTY_DATA: Data = {
  root: { props: {} },
  content: [],
};

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
  const [selectedBlockIndex, _setSelectedBlockIndex] = useState<
    number | undefined
  >(undefined);
  const [departments, setDepartments] = useState<
    { label: string; value: string }[]
  >([]);

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
          // description is now a root field — keep it in sync with localeData
          description: currentLocaleInfo.description,
        } as any,
      },
    }),
    [currentLocaleInfo, effectiveSlug]
  );

  // Track if AI is generating content
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Puck's `data` prop is initialization-only — changes after mount are ignored.
   * The only way to programmatically update the canvas is dispatch({ type: "setData" }),
   * which must be called from inside Puck's context tree.
   *
   * The AI assistant plugin registers its dispatch here on mount so that
   * handleDataChange can push updates directly into Puck.
   */
  const puckApplyRef = useRef<((data: Data) => void) | null>(null);

  const onDataReady = useCallback((fn: ((data: Data) => void) | null) => {
    puckApplyRef.current = fn;
  }, []);

  // Handler for data changes from AI streaming patches
  const handleDataChange = useCallback(
    (newData: Data) => {
      setIsGenerating(true);

      // Apply directly to Puck canvas via dispatch (registered by the plugin panel)
      puckApplyRef.current?.(newData);

      // Also keep localeData in sync so Save/Publish capture AI-generated content
      setLocaleData((prev) => {
        const existing = prev[currentLocale] ?? {
          title: "",
          description: "",
          data: EMPTY_DATA,
        };
        return {
          ...prev,
          [currentLocale]: { ...existing, data: newData },
        };
      });

      setTimeout(() => setIsGenerating(false), 500);
    },
    [currentLocale]
  );

  useEffect(() => {
    if (userContext.departmentNames.length > 0) {
      listDepartmentsWithWriterAccess().then((depts) =>
        setDepartments(
          depts.map((dept) => ({ label: dept.Name, value: dept.Id }))
        )
      );
    }
  }, [userContext.departmentNames.length]);

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

  // Keep a ref to the latest Puck data so we can snapshot it on locale switch
  // without subscribing to every keystroke in React state.
  const latestPuckDataRef = useRef<Data>(currentData);

  const handleLocaleChange = useCallback(
    (newLocale: Locale) => {
      // Persist the current locale's in-flight edits before Puck remounts
      const snapshot = latestPuckDataRef.current;
      const rootProps = (snapshot.root?.props ?? {}) as Record<string, unknown>;
      setLocaleData((prev) => ({
        ...prev,
        [currentLocale]: {
          title:
            (rootProps.title as string) || prev[currentLocale]?.title || "",
          description:
            (rootProps.description as string) ||
            prev[currentLocale]?.description ||
            "",
          data: snapshot,
        },
      }));
      setCurrentLocale(newLocale);
    },
    [currentLocale]
  );

  const { handleDataChange: handleStructuralSync } = useLocaleStructuralSync({
    currentLocale,
    localeData,
    setLocaleData,
    availableLocales,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: baseEditorConfig as any,
  });

  const handlePuckChange = useCallback(
    (nextData: Data) => {
      latestPuckDataRef.current = nextData;
      handleStructuralSync(nextData);
    },
    [handleStructuralSync]
  );

  const {
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
  } = useUnifiedEditorHandlers({
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
  });

  const scope = getEditorScope(pageContext, userContext, isDepartmentUser);

  const editorContext: EditorContext = {
    mode: "direct",
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

  // ------------------------------------------------------------------
  // AI assistant context — bridges useStreamingPuck + text assist API
  // ------------------------------------------------------------------

  const [isAssisting, setIsAssisting] = useState(false);

  const assist = useCallback(
    async (
      action: AssistAction,
      content: string,
      callbacks: AiAssistCallbacks
    ) => {
      setIsAssisting(true);
      try {
        const response = await fetch("/api/ai/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, content }),
        });

        if (!response.ok) {
          callbacks.onError?.(
            new Error(`Request failed: HTTP ${response.status}`)
          );
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          callbacks.onError?.(new Error("No response body from AI"));
          return;
        }

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          const token = decoder.decode(value, { stream: true });
          fullText += token;
          callbacks.onToken(token);
        }

        callbacks.onComplete(fullText);
      } catch (err) {
        callbacks.onError?.(
          err instanceof Error ? err : new Error(String(err))
        );
      } finally {
        setIsAssisting(false);
      }
    },
    []
  );

  const aiContextValue = useMemo<AiAssistantContextValue>(
    () => ({
      generate,
      isStreaming,
      abort,
      assist,
      isAssisting,
      onDataReady,
    }),
    [generate, isStreaming, abort, assist, isAssisting, onDataReady]
  );

  return (
    <AiAssistantContext.Provider value={aiContextValue}>
      <PageEditor
        availableLocales={availableLocales}
        departments={departments}
        editorContext={editorContext}
        initialData={currentData}
        locale={currentLocale}
        onBack={() => router.push("/pages")}
        onDataChange={handlePuckChange}
        onLocaleChange={handleLocaleChange}
        onPublish={handlePublish}
        onSave={handleSave}
        onTranslate={handleTranslate}
        slug={effectiveSlug}
        status={initialStatus}
        title={currentLocaleInfo.title}
      />

      <PuckGenerationIndicator isGenerating={isGenerating || isStreaming} />

      <TranslationCheckModal
        isTranslating={isTranslating}
        onCancel={handleCancelPublish}
        onSkipAndPublish={handleSkipAndPublish}
        onTranslateAndPublish={handleTranslateAndPublish}
        open={showTranslationModal}
        translationProgress={translationProgress}
        untranslatedLocales={untranslatedLocales}
      />
    </AiAssistantContext.Provider>
  );
}
