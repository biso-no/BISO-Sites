"use client";

import { type Config, type Data, Puck, resolveAllData, usePuck } from "@puckeditor/core";
import type {
  TemplateBinding,
  TemplateFieldSchema,
} from "@repo/api/editorial";
import { type Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractBindings } from "./bindings/extract-bindings";
import { injectBindings } from "./bindings/inject-bindings";
import { config } from "./config";
import type { EditorContext, EditorMode } from "./editor-context";
import { fieldSchemaEditorField } from "./fields/field-schema-editor";
import headingAnalyzer from "@puckeditor/plugin-heading-analyzer";
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

// ─── Types ───────────────────────────────────────────────────────────

export type UnifiedEditorProps = {
  /** Editor mode determines what UI and capabilities are shown */
  mode: EditorMode;
  /** Content type key from the registry (e.g., "homepage", "news-listing") */
  contentType?: string;
  /** Initial Puck data (layout document) */
  initialData: Data;
  /** Page/template title */
  title: string;
  /** URL slug */
  slug: string;
  /** Page description */
  description?: string;
  /** Current locale */
  locale: Locale;
  /** All available locales */
  availableLocales: Locale[];
  /** Current publication status */
  status: PageStatus;
  /** Current visibility */
  visibility: PageVisibility;
  /** Editor context with user info, permissions, etc. */
  editorContext?: EditorContext;

  // ─── Template mode specific ──────────────────────────────────────
  /** Template field schema (template mode only) */
  fieldSchema?: TemplateFieldSchema[];
  /** Template bindings (template mode only, for injection on load) */
  bindings?: TemplateBinding[];
  /** Template key identifier (template mode only) */
  templateKey?: string;
  /** Template name (template mode only) */
  templateName?: string;
  /** Template family (template mode only) */
  templateFamily?: "page" | "policy" | "article";
  /** Draft version number */
  draftVersion?: number;
  /** Published version number */
  publishedVersion?: number | null;
  /** Template notes */
  notes?: string;

  // ─── Callbacks ───────────────────────────────────────────────────
  onSave: (
    data: Data,
    metadata: UnifiedEditorMetadata,
  ) => Promise<void>;
  onPublish: (
    data: Data,
    metadata: UnifiedEditorMetadata,
  ) => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onBack: () => void;
  onTranslate?: (
    data: Data,
    metadata: UnifiedEditorMetadata,
    targetLocale: Locale,
  ) => Promise<void>;
  onRollback?: (versionId: string) => Promise<void>;
};

export type UnifiedEditorMetadata = {
  title: string;
  slug: string;
  description?: string;
  // Template mode extras
  fieldSchema?: TemplateFieldSchema[];
  bindings?: TemplateBinding[];
  templateKey?: string;
  templateFamily?: "page" | "policy" | "article";
  notes?: string;
};

// ─── Field Schema Plugin ─────────────────────────────────────────────

function FieldSchemaPlugin({
  fieldSchema,
  onChange,
}: {
  fieldSchema: TemplateFieldSchema[];
  onChange: (next: TemplateFieldSchema[]) => void;
}) {
  const customField = useMemo(() => fieldSchemaEditorField({ label: "Content Fields" }), []);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-semibold text-foreground text-lg">Content Fields</div>
        <p className="text-muted-foreground text-sm">
          Define the fields that content editors will fill in when creating pages
          from this template.
        </p>
      </div>

      {customField.render({
        field: customField,
        name: "fieldSchema",
        id: "fieldSchema",
        value: fieldSchema,
        onChange,
        readOnly: false,
      })}
    </div>
  );
}

// ─── Refresh Button (uses usePuck hook) ─────────────────────────────

function RefreshDataButton() {
  const { selectedItem, dispatch } = usePuck();
  const showRefresh =
    selectedItem && DATA_DISPLAY_TYPES.has(selectedItem.type);

  if (!showRefresh) return null;

  return (
    <Button
      className="h-9"
      onClick={() => {
        dispatch({
          type: "setData",
          recordHistory: false,
          data: (prev: any) => prev,
        });
        toast.info("Refreshing data...");
      }}
      size="sm"
      variant="outline"
    >
      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
      Refresh data
    </Button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function UnifiedEditor({
  mode,
  contentType,
  initialData,
  title: initialTitle,
  slug: initialSlug,
  description: initialDescription = "",
  locale,
  availableLocales,
  status: initialStatus,
  visibility: initialVisibility,
  editorContext,
  fieldSchema: initialFieldSchema = [],
  bindings: initialBindings = [],
  templateKey: initialTemplateKey = "",
  templateName: initialTemplateName = "",
  templateFamily: initialTemplateFamily = "page",
  draftVersion,
  publishedVersion,
  notes: initialNotes = "",
  onSave,
  onPublish,
  onLocaleChange,
  onBack,
  onTranslate,
  onRollback,
}: UnifiedEditorProps) {
  // ─── State ─────────────────────────────────────────────────────────

  // Inject bindings into layout data on initial load
  const enrichedInitialData = useMemo(() => {
    if (mode === "template" && initialBindings.length > 0) {
      return injectBindings(initialData, initialBindings);
    }
    return initialData;
  }, [initialData, initialBindings, mode]);

  const [data, setData] = useState<Data>(enrichedInitialData);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [description, setDescription] = useState(initialDescription);

  // Template mode state
  const [fieldSchema, setFieldSchema] =
    useState<TemplateFieldSchema[]>(initialFieldSchema);
  const [templateKey, setTemplateKey] = useState(initialTemplateKey);
  const [templateFamily, setTemplateFamily] = useState(initialTemplateFamily);
  const [notes, setNotes] = useState(initialNotes);

  // Sync props → state on navigation
  useEffect(() => {
    setData(enrichedInitialData);
    setTitle(initialTitle);
    setSlug(initialSlug);
    setDescription(initialDescription);
    setFieldSchema(initialFieldSchema);
    setTemplateKey(initialTemplateKey);
    setTemplateFamily(initialTemplateFamily);
    setNotes(initialNotes);
  }, [
    enrichedInitialData,
    initialTitle,
    initialSlug,
    initialDescription,
    initialFieldSchema,
    initialTemplateKey,
    initialTemplateFamily,
    initialNotes,
  ]);

  // ─── Build metadata for save/publish callbacks ─────────────────────

  const buildMetadata = useCallback((): UnifiedEditorMetadata => {
    const meta: UnifiedEditorMetadata = { title, slug, description };

    if (mode === "template") {
      // Extract bindings from the Puck data before saving
      meta.bindings = extractBindings(data);
      meta.fieldSchema = fieldSchema;
      meta.templateKey = templateKey;
      meta.templateFamily = templateFamily;
      meta.notes = notes;
    }

    return meta;
  }, [title, slug, description, mode, data, fieldSchema, templateKey, templateFamily, notes]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (newData: Data) => {
      setSaving(true);
      try {
        await onSave(newData, buildMetadata());
        setData(newData);
        toast.success(
          mode === "template" ? "Template draft saved" : "Draft saved",
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [onSave, buildMetadata, mode],
  );

  const handlePublish = useCallback(
    async (newData: Data) => {
      setSaving(true);
      try {
        // Resolve all data before publishing to ensure hydrated payload
        const resolved = await resolveAllData(newData, config as Config, {
          metadata: { ...editorContext, locale, mode, contentType },
        });
        await onPublish(resolved as Data, buildMetadata());
        setData(newData);
        toast.success(
          mode === "template" ? "Template published" : "Page published",
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to publish");
      } finally {
        setSaving(false);
      }
    },
    [onPublish, buildMetadata, mode],
  );

  const handleTranslate = useCallback(
    async (newData: Data, targetLocale: Locale) => {
      if (!onTranslate) return;
      setTranslating(true);
      try {
        await onTranslate(newData, buildMetadata(), targetLocale);
        toast.success(
          `Translated to ${targetLocale === "no" ? "Norwegian" : "English"}`,
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to translate");
      } finally {
        setTranslating(false);
      }
    },
    [onTranslate, buildMetadata],
  );

  // ─── Keyboard shortcuts ────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+S → Save draft
      if (isMod && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        handleSave(data);
      }

      // Cmd+Shift+P → Publish
      if (isMod && e.shiftKey && e.key === "p") {
        e.preventDefault();
        handlePublish(data);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data, handleSave, handlePublish]);

  // ─── Plugins ───────────────────────────────────────────────────────

  const plugins = useMemo(() => {
    const base = [
      headingAnalyzer,
      dataSourcesPlugin,
      templatesPlugin,
      savedPatternsPlugin,
      aiAssistantPlugin,
      seoToolsPlugin,
      versionHistoryPlugin,
    ];

    // In template mode, add the field schema editor as a plugin tab
    if (mode === "template") {
      base.splice(1, 0, {
        name: "field-schema",
        label: "Content Fields",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h10M4 17h12" />
          </svg>
        ),
        render: () => (
          <FieldSchemaPlugin
            fieldSchema={fieldSchema}
            onChange={setFieldSchema}
          />
        ),
      });
    }

    return base;
  }, [mode, fieldSchema]);

  // ─── Permissions ───────────────────────────────────────────────────

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

  // ─── Render ────────────────────────────────────────────────────────

  const modeLabel =
    mode === "template" ? "Template" : mode === "page" ? "Page" : "Page";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden rounded-2xl">
      <Puck
        config={config as Config}
        data={data}
        headerPath={mode !== "template" ? `/${locale}/${slug}` : undefined}
        headerTitle={mode === "template" ? (initialTemplateName || "Untitled Template") : title}
        metadata={{ ...editorContext, locale, mode, contentType } as never}
        onChange={(nextData) => setData(nextData as Data)}
        onPublish={handleSave}
        overrides={getPuckFieldOverrides()}
        permissions={permissions}
        plugins={plugins}
        renderHeaderActions={({ state }) => {
          const currentData = state.data as Data;

          return (
            <div className="flex items-center gap-2">
              {/* Mode badge */}
              <Badge
                className="bg-white/10 text-white border-white/20"
                variant="outline"
              >
                {modeLabel}
              </Badge>

              {/* Refresh data button for data-display blocks */}
              <RefreshDataButton />

              {/* Version info (template mode) */}
              {mode === "template" && (
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-white/10 text-white/80 border-white/20 text-xs" variant="outline">
                    Draft v{draftVersion ?? "New"}
                  </Badge>
                  {publishedVersion != null && (
                    <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 text-xs" variant="outline">
                      Live v{publishedVersion}
                    </Badge>
                  )}
                </div>
              )}

              {/* Locale Switcher */}
              {mode !== "template" && (
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
              )}

              {/* Page Settings Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="h-9 w-9" size="icon" variant="outline">
                    <Settings className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>
                      {mode === "template" ? "Template Settings" : "Page Settings"}
                    </SheetTitle>
                    <SheetDescription>
                      {mode === "template"
                        ? "Configure template properties and metadata."
                        : "Configure page properties and metadata."}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    {/* Template-specific fields */}
                    {mode === "template" && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="template-key">Template Key</Label>
                          <Input
                            id="template-key"
                            onChange={(e) => setTemplateKey(e.target.value)}
                            placeholder="department-landing"
                            value={templateKey}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Family</Label>
                          <Select
                            onValueChange={(v) =>
                              setTemplateFamily(v as "page" | "policy" | "article")
                            }
                            value={templateFamily}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="page">Page</SelectItem>
                              <SelectItem value="policy">Policy</SelectItem>
                              <SelectItem value="article">Article</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Common fields */}
                    <div className="grid gap-2">
                      <Label htmlFor="title">
                        {mode === "template" ? "Template Name" : "Title"}
                      </Label>
                      <Input
                        id="title"
                        onChange={(e) => setTitle(e.target.value)}
                        value={title}
                      />
                    </div>

                    {mode !== "template" && (
                      <div className="grid gap-2">
                        <Label htmlFor="slug">URL Path</Label>
                        <Input
                          disabled={editorContext?.constraints.slugLocked}
                          id="slug"
                          onChange={(e) => setSlug(e.target.value)}
                          value={slug}
                        />
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        className="resize-none"
                        id="description"
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        value={description}
                      />
                    </div>

                    {mode !== "template" && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="status">Status</Label>
                          <Select disabled value={initialStatus as string}>
                            <SelectTrigger id="status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PageStatus.DRAFT}>Draft</SelectItem>
                              <SelectItem value={PageStatus.PUBLISHED}>Published</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="visibility">Visibility</Label>
                          <Select disabled value={initialVisibility as string}>
                            <SelectTrigger id="visibility">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PageVisibility.PUBLIC}>Public</SelectItem>
                              <SelectItem value={PageVisibility.AUTHENTICATED}>Authenticated</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Template notes */}
                    {mode === "template" && (
                      <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          className="resize-none"
                          id="notes"
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Compatibility notes for editors..."
                          rows={3}
                          value={notes}
                        />
                      </div>
                    )}

                    {/* Rollback (template mode) */}
                    {mode === "template" && onRollback && publishedVersion != null && (
                      <div className="grid gap-2">
                        <Label>Rollback</Label>
                        <Button
                          disabled={saving}
                          onClick={() => onRollback("")}
                          size="sm"
                          variant="outline"
                        >
                          Roll back to published v{publishedVersion}
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              {/* AI Translate Button */}
              {mode !== "template" && onTranslate && availableLocales.length > 1 && (
                <Select
                  disabled={translating}
                  onValueChange={(targetLocale) => {
                    if (targetLocale !== locale) {
                      handleTranslate(currentData, targetLocale as Locale);
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

              <Button onClick={onBack} variant="outline">
                Back
              </Button>

              {mode !== "template" &&
                initialStatus === PageStatus.PUBLISHED && (
                  <Button
                    onClick={() => window.open(`/${slug}`, "_blank")}
                    variant="outline"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View
                  </Button>
                )}

              <Button
                disabled={saving}
                onClick={() => handleSave(currentData)}
                variant="secondary"
              >
                Save Draft
              </Button>

              <Button
                className="bg-[#001731] text-white hover:bg-[#001731]/90"
                disabled={saving}
                onClick={() => handlePublish(currentData)}
              >
                Publish
              </Button>
            </div>
          );
        }}
        viewports={puckViewports}
      />
    </div>
  );
}
