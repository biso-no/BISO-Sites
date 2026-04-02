"use client";

import { type Config, type Data, Puck, resolveAllData, usePuck } from "@puckeditor/core";
import headingAnalyzer from "@puckeditor/plugin-heading-analyzer";
import {
  Departments,
  type Locale,
  PageStatus,
} from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { config } from "./config";
import type { EditorContext } from "./editor-context";
import { aiAssistantPlugin } from "./plugins/ai-assistant";
import { savedPatternsPlugin } from "./plugins/saved-patterns";
import { seoToolsPlugin } from "./plugins/seo-tools";
import { templatesPlugin } from "./plugins/templates";
import { versionHistoryPlugin } from "./plugins/version-history";
import { getPuckFieldOverrides, puckViewports } from "./puck-ui";
import "./styles.css";

// Data-display component types that support the "Refresh data" action
const DATA_DISPLAY_TYPES = new Set([
  "News", "Events", "EventsCalendar", "JobsList", "ProductsGrid",
  "DepartmentsGrid", "Collection", "FilterBar", "ArticleDetail", "EventDetail",
]);

export type PageEditorProps = {
  initialData: Data;
  /** Fallback title for Puck's header display — real title lives in initialData.root.props.title */
  title: string;
  /** Fallback slug for Puck's header path — real slug lives in initialData.root.props.slug */
  slug: string;
  locale: Locale;
  availableLocales: Locale[];
  departments: { label: string; value: string }[];
  status: PageStatus;
  editorContext?: EditorContext;
  onSave: (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => Promise<void>;
  onPublish: (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onBack: () => void;
  onTranslate?: (
    data: Data,
    metadata: { title: string; slug: string; description?: string },
    targetLocale: Locale
  ) => Promise<void>;
};

export function PageEditor({
  initialData,
  title: initialTitle,
  slug: initialSlug,
  locale,
  availableLocales,
  status: initialStatus,
  editorContext,
  onSave,
  onPublish,
  onLocaleChange,
  onBack,
  onTranslate,
  departments
}: PageEditorProps) {
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  const metadata = useMemo(
    () => ({ ...editorContext, locale }) as any,
    [editorContext, locale],
  );

  // Sync canvas when initialData changes (e.g. locale switch)
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  /** Read current title/slug/description from root.props (set via Puck fields). */
  function rootMeta(d: Data) {
    const p = (d.root?.props ?? {}) as Record<string, unknown>;
    return {
      title: (p.title as string) || initialTitle,
      slug: (p.slug as string) || initialSlug,
      description: p.description as string | undefined,
    };
  }

  const handleSave = async (newData: Data) => {
    setSaving(true);
    try {
      await onSave(newData, rootMeta(newData));
      setData(newData);
      toast.success("Draft saved successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (newData: Data) => {
    setSaving(true);
    try {
      // Resolve all data before publishing to ensure hydrated payload
      const resolved = await resolveAllData(newData, config as Config, { metadata });
      await onPublish(resolved as Data, rootMeta(resolved as Data));
      setData(newData);
      toast.success("Page published successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish page");
    } finally {
      setSaving(false);
    }
  };

  const handleTranslate = async (newData: Data, targetLocale: Locale) => {
    if (!onTranslate) {
      toast.error("Translation is not available");
      return;
    }
    setTranslating(true);
    try {
      await onTranslate(newData, rootMeta(newData), targetLocale);
      toast.success(
        `Page translated to ${targetLocale === "no" ? "Norwegian" : "English"}`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to translate page");
    } finally {
      setTranslating(false);
    }
  };

  const permissions = useMemo(() => {
    if (
      initialStatus === PageStatus.PUBLISHED &&
      !(editorContext?.user.isGlobalAdmin ?? false)
    ) {
      return {
        drag: false,
        duplicate: false,
        delete: false,
        insert: false,
        edit: true,
      };
    }
    return undefined;
  }, [initialStatus, editorContext]);

  const dynamicConfig = useMemo(() => {
    return {
      ...config,
      root: {
        ...config.root,
        fields: {
          ...config.root?.fields,
          departmentId: {
            type: "select",
            label: "Department",
            options: departments,
          },
        },
      },
    } as Config;
  }, [departments]);

  // Derive display title and slug from root.props so the Puck header bar
  // updates reactively as the user types in the right-panel fields.
  const liveRootProps = (data.root?.props ?? {}) as Record<string, unknown>;
  const headerTitle = (liveRootProps.title as string) || initialTitle;
  const headerSlug = (liveRootProps.slug as string) || initialSlug;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden rounded-2xl">
      <Puck
        config={dynamicConfig}
        data={data}
        headerPath={`/${locale}/${headerSlug}`}
        headerTitle={headerTitle}
        metadata={metadata}
        onChange={(nextData) => setData(nextData as Data)}
        onPublish={handleSave}
        overrides={getPuckFieldOverrides()}
        permissions={permissions}
        plugins={[
          headingAnalyzer,
          templatesPlugin,
          savedPatternsPlugin,
          aiAssistantPlugin,
          seoToolsPlugin,
          versionHistoryPlugin,
        ]}
        renderHeaderActions={({ state }) => {
          const currentData = state.data as Data;

          return (
            <EditorHeaderActions
              availableLocales={availableLocales}
              currentData={currentData}
              initialStatus={initialStatus}
              locale={locale}
              onBack={onBack}
              onLocaleChange={onLocaleChange}
              onPublish={handlePublish}
              onSave={handleSave}
              onTranslate={onTranslate ? handleTranslate : undefined}
              saving={saving}
              slug={headerSlug}
              translating={translating}
            />
          );
        }}
        viewports={puckViewports}
      />
    </div>
  );
}

// ─── Header Actions Component ────────────────────────────────────────
// Extracted for readability and to enable usePuck() for refresh action.

function EditorHeaderActions({
  availableLocales,
  currentData,
  initialStatus,
  locale,
  onBack,
  onLocaleChange,
  onPublish,
  onSave,
  onTranslate,
  saving,
  slug,
  translating,
}: {
  availableLocales: Locale[];
  currentData: Data;
  initialStatus: PageStatus;
  locale: Locale;
  onBack: () => void;
  onLocaleChange: (locale: Locale) => void;
  onPublish: (data: Data) => void;
  onSave: (data: Data) => void;
  onTranslate?: (data: Data, locale: Locale) => void;
  saving: boolean;
  slug: string;
  translating: boolean;
}) {
  
  const { selectedItem, dispatch } = usePuck();
  const showRefresh =
    selectedItem && DATA_DISPLAY_TYPES.has(selectedItem.type);

  return (
    <div className="flex items-center gap-2">
      {/* Refresh data button for data-display blocks */}
      {showRefresh && (
        <Button
          className="h-9"
          onClick={() => {
            // Force resolveData by dispatching a no-op setData with force trigger
            dispatch({
              type: "setData",
              recordHistory: false,
              data: (prev) => prev,
            });
            toast.info("Refreshing data...");
          }}
          size="sm"
          variant="outline"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh data
        </Button>
      )}

      {/* Locale Switcher */}
      <Select
        onValueChange={(v) => onLocaleChange(v as Locale)}
        value={locale}
      >
        <SelectTrigger className="h-9 w-[140px] border-white/20 bg-white/10 text-white">
          <Globe className="mr-2 h-4 w-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableLocales.map((l) => (
            <SelectItem key={l} value={l}>
              {l === "no" ? "Norwegian" : "English"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AI Translate Button */}
      {onTranslate && availableLocales.length > 1 && (
        <Select
          disabled={translating}
          onValueChange={(targetLocale) => {
            if (targetLocale !== locale) {
              onTranslate(currentData, targetLocale as Locale);
            }
          }}
          value=""
        >
          <SelectTrigger className="h-9 w-[160px] border-white/20 bg-white/10 text-white">
            {translating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Translating...</span>
              </>
            ) : (
              <>
                <Languages className="mr-2 h-4 w-4" />
                <span>AI Translate</span>
              </>
            )}
          </SelectTrigger>
          <SelectContent>
            {availableLocales
              .filter((l) => l !== locale)
              .map((l) => (
                <SelectItem key={l} value={l}>
                  Translate to {l === "no" ? "Norwegian" : "English"}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}

      <div className="mx-2 h-6 w-px bg-white/20" />

      <Button className="mr-2" onClick={onBack} variant="outline">
        Back
      </Button>

      {initialStatus === PageStatus.PUBLISHED && (
        <Button
          className="mr-2"
          onClick={() => window.open(`/${slug}`, "_blank")}
          variant="outline"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          View
        </Button>
      )}

      <Button
        disabled={saving}
        onClick={() => onSave(currentData)}
        variant="secondary"
      >
        Save Draft
      </Button>

      <Button
        className="bg-[#001731] text-white hover:bg-[#001731]/90"
        disabled={saving}
        onClick={() => onPublish(currentData)}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Publishing...
          </>
        ) : (
          "Publish"
        )}
      </Button>
    </div>
  );  
}