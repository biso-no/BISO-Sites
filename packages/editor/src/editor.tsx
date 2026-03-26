"use client";

import { type Config, type Data, Puck, resolveAllData, usePuck } from "@puckeditor/core";
import headingAnalyzer from "@puckeditor/plugin-heading-analyzer";
import {
  type Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { config } from "./config";
import type { EditorContext } from "./editor-context";
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
  title: string;
  slug: string;
  description?: string;
  locale: Locale;
  availableLocales: Locale[];
  status: PageStatus;
  visibility: PageVisibility;
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
  description: initialDescription = "",
  locale,
  availableLocales,
  status: initialStatus,
  visibility: initialVisibility,
  editorContext,
  onSave,
  onPublish,
  onLocaleChange,
  onBack,
  onTranslate,
}: PageEditorProps) {
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [description, setDescription] = useState(initialDescription);

  const metadata = useMemo(
    () => ({ ...editorContext, locale }) as any,
    [editorContext, locale],
  );

  // Update local state when props change (e.g. after navigation)
  useEffect(() => {
    setData(initialData);
    setTitle(initialTitle);
    setSlug(initialSlug);
    setDescription(initialDescription);
  }, [initialData, initialTitle, initialSlug, initialDescription]);

  const handleSave = async (newData: Data) => {
    setSaving(true);
    try {
      await onSave(newData, { title, slug, description });
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
      await onPublish(resolved as Data, { title, slug, description });
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
      await onTranslate(newData, { title, slug, description }, targetLocale);
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

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden rounded-2xl">
      <Puck
        config={config as Config}
        data={data}
        headerPath={`/${locale}/${slug}`}
        headerTitle={title}
        metadata={metadata}
        onChange={(nextData) => setData(nextData as Data)}
        onPublish={handleSave}
        overrides={getPuckFieldOverrides()}
        permissions={permissions}
        plugins={[
          headingAnalyzer,
          dataSourcesPlugin,
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
              editorContext={editorContext}
              initialStatus={initialStatus}
              initialVisibility={initialVisibility}
              locale={locale}
              onBack={onBack}
              onLocaleChange={onLocaleChange}
              onPublish={handlePublish}
              onSave={handleSave}
              onTranslate={onTranslate ? handleTranslate : undefined}
              saving={saving}
              slug={slug}
              title={title}
              description={description}
              translating={translating}
              onTitleChange={setTitle}
              onSlugChange={setSlug}
              onDescriptionChange={setDescription}
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
  editorContext,
  initialStatus,
  initialVisibility,
  locale,
  onBack,
  onLocaleChange,
  onPublish,
  onSave,
  onTranslate,
  saving,
  slug,
  title,
  description,
  translating,
  onTitleChange,
  onSlugChange,
  onDescriptionChange,
}: {
  availableLocales: Locale[];
  currentData: Data;
  editorContext?: EditorContext;
  initialStatus: PageStatus;
  initialVisibility: PageVisibility;
  locale: Locale;
  onBack: () => void;
  onLocaleChange: (locale: Locale) => void;
  onPublish: (data: Data) => void;
  onSave: (data: Data) => void;
  onTranslate?: (data: Data, locale: Locale) => void;
  saving: boolean;
  slug: string;
  title: string;
  description: string;
  translating: boolean;
  onTitleChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
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

      <Sheet>
        <SheetTrigger asChild>
          <Button className="ml-2 h-9 w-9" size="icon" variant="outline">
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Page Settings</SheetTitle>
            <SheetDescription>
              Configure page properties and metadata.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                onChange={(e) => onTitleChange(e.target.value)}
                value={title}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                disabled={editorContext?.constraints.slugLocked}
                id="slug"
                onChange={(e) => onSlugChange(e.target.value)}
                value={slug}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                className="resize-none"
                id="description"
                onChange={(e) => onDescriptionChange(e.target.value)}
                rows={3}
                value={description}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select disabled value={initialStatus as string}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PageStatus.DRAFT}>Draft</SelectItem>
                  <SelectItem value={PageStatus.PUBLISHED}>
                    Published
                  </SelectItem>
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
                  <SelectItem value={PageVisibility.AUTHENTICATED}>
                    Authenticated
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
        Publish
      </Button>
    </div>
  );
}
