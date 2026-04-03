"use client";

import { type Config, type Data, fieldsPlugin, Puck, resolveAllData, usePuck } from "@puckeditor/core";
import headingAnalyzer from "@puckeditor/plugin-heading-analyzer";
import {
  type Locale,
  PageStatus,
} from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  ChevronDown,
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
import {
  buildLockedCampusField,
  buildLockedDepartmentField,
  CAMPUS_OPTIONS,
  isDepartmentUser,
} from "./config/helpers/permission-scope";
import { aiAssistantPlugin } from "./plugins/ai-assistant";
import { dataSourcesPlugin } from "./plugins/data-sources";
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
  /** Called on every Puck onChange — used by parent for cross-locale structural sync. */
  onDataChange?: (data: Data) => void;
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
  onDataChange,
  departments
}: PageEditorProps) {
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  const metadata = useMemo(
    () => ({ ...editorContext, locale }),
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
    const user = editorContext?.user;
    const isDeptUser = isDepartmentUser(user);

    // Campus field: global admins see all options; everyone else gets a
    // role-locked badge showing which campus they belong to.
    const campusField =
      !user || user.isGlobalAdmin
        ? config.root?.fields?.campus
        : buildLockedCampusField(user.campusNames[0] ?? "");

    // Department field: global/campus admins get the full select; department
    // users see a locked badge instead.
    const departmentIdField =
      !user || user.isGlobalAdmin || user.isCampusAdmin
        ? ({ type: "select", label: "Department", options: departments } as const)
        : buildLockedDepartmentField(user.departmentNames[0] ?? "");

    // Root resolveFields: extend the existing scheduling-gate behaviour to
    // also inject the pre-set campus value for restricted users so the page
    // document always stores the correct campus_id on save.
    const resolveRootFields = async (data: any, params: any) => {
      const baseFields = await (config.root?.resolveFields
        ? config.root.resolveFields(data, params)
        : params.fields);

      return {
        ...baseFields,
        campus: campusField,
        departmentId: departmentIdField,
      };
    };

    return {
      ...config,
      root: {
        ...config.root,
        fields: {
          ...config.root?.fields,
          campus: campusField,
          departmentId: departmentIdField,
        },
        resolveFields: resolveRootFields,
        // For restricted users, pre-populate the campus value so it is saved
        // correctly even though the field renders as a non-editable badge.
        defaultProps: {
          ...config.root?.defaultProps,
          ...(isDeptUser && user?.campusNames[0]
            ? {
                campus:
                  CAMPUS_OPTIONS.find(
                    (o) =>
                      o.label.toLowerCase() ===
                      (user.campusNames[0] ?? "").toLowerCase()
                  )?.value ?? config.root?.defaultProps?.campus,
              }
            : {}),
        },
      },
    } as Config;
  }, [departments, editorContext?.user]);

  // Derive display title and slug from root.props so the Puck header bar
  // updates reactively as the user types in the right-panel fields.
  const liveRootProps = (data.root?.props ?? {}) as Record<string, unknown>;
  const headerTitle = (liveRootProps.title as string) || initialTitle;
  const headerSlug = (liveRootProps.slug as string) || initialSlug;

  return (
    <Puck
      _experimentalFullScreenCanvas
      config={dynamicConfig}
      data={data}
      headerPath={`/${locale}/${headerSlug}`}
      headerTitle={headerTitle}
      height="100%"
      metadata={metadata}
      onChange={(nextData) => {
        const typed = nextData as Data;
        setData(typed);
        onDataChange?.(typed);
      }}
      onPublish={handlePublish}
      overrides={getPuckFieldOverrides()}
      permissions={permissions}
      plugins={[
        // Workflow order: create → insert → generate → analyse → configure → track
        fieldsPlugin({
          desktopSideBar: "left"
        }),
        templatesPlugin,
        savedPatternsPlugin,
        aiAssistantPlugin,
        seoToolsPlugin,
        dataSourcesPlugin,
        versionHistoryPlugin,
        headingAnalyzer,
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
    >
      <Puck.Layout />
    </Puck>
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
  
  // usePuck is used with destructuring (selector form requires createUsePuck)
  const puck = usePuck();
  const { selectedItem } = puck;
  // resolveDataById is the Puck 0.21 API for targeted data refresh; access
  // via type assertion since the typings may lag the runtime API.
  const resolveDataById = (puck as unknown as { resolveDataById?: (id: string) => void })
    .resolveDataById;
  const showRefresh =
    selectedItem && DATA_DISPLAY_TYPES.has(selectedItem.type);

  const localeLabel = (l: Locale) => (l === "no" ? "Norwegian" : "English");

  return (
    <div className="flex items-center gap-2">
      {/* ── Secondary actions (locale, translate, refresh, back, view) in a popover ── */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="h-9 border-white/20 bg-white/10 text-white hover:bg-white/20"
            size="sm"
            variant="outline"
          >
            More
            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2" sideOffset={8}>
          {/* Locale switcher */}
          {availableLocales.length > 1 && (
            <div className="space-y-1 p-1">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Locale
              </p>
              {availableLocales.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    l === locale
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted text-foreground"
                  }`}
                  onClick={() => onLocaleChange(l)}
                >
                  <Globe className="h-3.5 w-3.5" />
                  {localeLabel(l)}
                  {l === locale && (
                    <Badge className="ml-auto h-4 text-[10px]" variant="secondary">
                      current
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* AI Translate */}
          {onTranslate && availableLocales.length > 1 && (
            <>
              <Separator className="my-1" />
              <div className="space-y-1 p-1">
                <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  AI Translate
                </p>
                {availableLocales
                  .filter((l) => l !== locale)
                  .map((l) => (
                    <button
                      key={l}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-foreground disabled:opacity-50"
                      disabled={translating}
                      onClick={() => onTranslate(currentData, l)}
                    >
                      {translating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Languages className="h-3.5 w-3.5" />
                      )}
                      Translate to {localeLabel(l)}
                    </button>
                  ))}
              </div>
            </>
          )}

          {/* Refresh + View + Back */}
          <Separator className="my-1" />
          <div className="space-y-1 p-1">
            {showRefresh && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-foreground"
                onClick={() => {
                  if (resolveDataById) resolveDataById(selectedItem.props.id);
                  toast.info("Refreshing data...");
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh block data
              </button>
            )}
            {initialStatus === PageStatus.PUBLISHED && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-foreground"
                onClick={() => window.open(`/${slug}`, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View live page
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-foreground"
              onClick={onBack}
            >
              ← Back to pages
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-white/20" />

      {/* ── Primary actions ── */}
      <Button
        disabled={saving}
        onClick={() => onSave(currentData)}
        size="sm"
        variant="secondary"
      >
        Save Draft
      </Button>

      <Button
        className="bg-[#001731] text-white hover:bg-[#001731]/90"
        disabled={saving}
        onClick={() => onPublish(currentData)}
        size="sm"
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