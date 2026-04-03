"use client";

import {
  type Config,
  type Data,
  createUsePuck,
  fieldsPlugin,
  Puck,
  resolveAllData,
  useGetPuck,
} from "@puckeditor/core";
import headingAnalyzer from "@puckeditor/plugin-heading-analyzer";
import { type Locale, PageStatus } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  ChevronDown,
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
import { puckFieldOverrides, puckViewports } from "./puck-ui";
import "./styles.css";

// Module-level hook factory — enables granular selectors to minimise re-renders.
const usePuck = createUsePuck();

// Stable plugin array — defined once so Puck never sees a new reference on
// parent re-renders, which would cause plugin panels (and their inputs) to remount.
const PUCK_PLUGINS = [
  fieldsPlugin({ desktopSideBar: "left" }),
  templatesPlugin,
  savedPatternsPlugin,
  aiAssistantPlugin,
  seoToolsPlugin,
  dataSourcesPlugin,
  versionHistoryPlugin,
  headingAnalyzer,
];

// Data-display component types that support the "Refresh data" action
const DATA_DISPLAY_TYPES = new Set([
  "News",
  "Events",
  "EventsCalendar",
  "JobsList",
  "ProductsGrid",
  "DepartmentsGrid",
  "Collection",
  "FilterBar",
  "ArticleDetail",
  "EventDetail",
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
  departments,
}: PageEditorProps) {
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  const metadata = useMemo(
    () => ({ ...editorContext, locale }),
    [editorContext, locale]
  );

  /** Read current title/slug/description from root.props (set via Puck fields). */
  const rootMeta = useCallback(
    (d: Data) => {
      const p = (d.root?.props ?? {}) as Record<string, unknown>;
      return {
        title: (p.title as string) || initialTitle,
        slug: (p.slug as string) || initialSlug,
        description: p.description as string | undefined,
      };
    },
    [initialTitle, initialSlug]
  );

  // Stable save handler — parent (useUnifiedEditorHandlers) owns toast notifications.
  const handleSave = useCallback(
    async (newData: Data) => {
      setSaving(true);
      try {
        await onSave(newData, rootMeta(newData));
      } catch (error) {
        console.error(error);
      } finally {
        setSaving(false);
      }
    },
    [onSave, rootMeta]
  );

  // Stable publish handler — resolves dynamic block data before handing off.
  // Parent owns toast notifications; errors from onPublish are caught there.
  const handlePublish = useCallback(
    async (newData: Data) => {
      setSaving(true);
      try {
        const resolved = await resolveAllData(newData, config as Config, {
          metadata,
        });
        await onPublish(resolved as Data, rootMeta(resolved as Data));
      } catch (error) {
        console.error(error);
      } finally {
        setSaving(false);
      }
    },
    [onPublish, rootMeta, metadata]
  );

  const handleTranslate = useCallback(
    async (newData: Data, targetLocale: Locale) => {
      if (!onTranslate) return;
      setTranslating(true);
      try {
        await onTranslate(newData, rootMeta(newData), targetLocale);
      } catch (error) {
        console.error(error);
      } finally {
        setTranslating(false);
      }
    },
    [onTranslate, rootMeta]
  );

  // Stable onChange — only forwards data to the structural-sync hook in the parent.
  const handleChange = useCallback(
    (nextData: Data) => {
      onDataChange?.(nextData);
    },
    [onDataChange]
  );

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
        ? ({
            type: "select",
            label: "Department",
            options: departments,
          } as const)
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
        // For non-global-admin users, pre-populate the campus value so it is
        // saved correctly even though the field renders as a non-editable badge.
        defaultProps: {
          ...config.root?.defaultProps,
          ...(user && !user.isGlobalAdmin && user.campusNames[0]
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

  // Derive display title/slug from initialData (which already has the merged
  // locale title/slug injected by UnifiedEditorClient). These are static per
  // Puck mount — when the locale changes, key={locale} remounts Puck with
  // fresh initialData so the header bar always shows the correct values.
  const initRootProps = (initialData.root?.props ?? {}) as Record<
    string,
    unknown
  >;
  const headerTitle = (initRootProps.title as string) || initialTitle;
  const headerSlug = (initRootProps.slug as string) || initialSlug;

  const overrides = useMemo(
    () => ({
      ...puckFieldOverrides,
      headerActions: () => (
        <EditorHeaderActions
          availableLocales={availableLocales}
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
      ),
    }),
    [
      availableLocales,
      handlePublish,
      handleSave,
      handleTranslate,
      headerSlug,
      initialStatus,
      locale,
      onBack,
      onLocaleChange,
      onTranslate,
      saving,
      translating,
    ]
  );

  return (
    // key={locale} remounts Puck with fresh initialData on every locale switch,
    // giving each locale its own undo/redo history and correct initial canvas.
    <Puck
      key={locale}
      _experimentalFullScreenCanvas
      config={dynamicConfig}
      data={initialData}
      headerPath={`/${locale}/${headerSlug}`}
      headerTitle={headerTitle}
      height="100%"
      metadata={metadata}
      onChange={(nextData) => handleChange(nextData as Data)}
      onPublish={handlePublish}
      overrides={overrides}
      permissions={permissions}
      plugins={PUCK_PLUGINS}
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
  // Granular selector — re-renders only when selectedItem changes, not on every
  // Puck state update. Use useGetPuck for the refresh handler (call-time access).
  const currentData = usePuck((s) => s.appState.data as Data);
  const selectedItem = usePuck((s) => s.selectedItem);
  const getPuck = useGetPuck();
  const showRefresh = selectedItem && DATA_DISPLAY_TYPES.has(selectedItem.type);

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
                    <Badge
                      className="ml-auto h-4 text-[10px]"
                      variant="secondary"
                    >
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
                  const puck = getPuck();
                  const resolveDataById = (
                    puck as unknown as {
                      resolveDataById?: (id: string) => void;
                    }
                  ).resolveDataById;
                  if (resolveDataById && selectedItem)
                    resolveDataById(selectedItem.props.id as string);
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
