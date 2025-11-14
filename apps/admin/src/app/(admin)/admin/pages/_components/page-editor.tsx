"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import type { PageRecord, PageTranslationRecord } from "@repo/api/page-builder";
import {
  ensureTranslation,
  publishPage,
  savePageDraft,
  updateManagedPage,
} from "@/app/actions/pages";
import { PageBuilderEditor } from "@repo/editor/editor";
import { DEFAULT_PAGE_DOCUMENT } from "@repo/editor/page-builder-config";
import type { PageBuilderDocument } from "@repo/editor/types";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { RefreshCcw, Save, Send } from "lucide-react";

const LOCALE_LABELS: Record<Locale, string> = {
  no: "Norwegian",
  en: "English",
};

const STATUS_OPTIONS: PageStatus[] = ["draft", "published", "archived"];
const VISIBILITY_OPTIONS: PageVisibility[] = ["public", "authenticated"];

interface PageEditorProps {
  page: PageRecord;
  initialLocale: Locale;
}

function toEditorDocument(document: PageTranslationRecord["draftDocument"]): PageBuilderDocument {
  return (document ?? DEFAULT_PAGE_DOCUMENT) as PageBuilderDocument;
}

export function PageEditor({ page, initialLocale }: PageEditorProps) {
  const [pageState, setPageState] = useState<PageRecord>(page);
  const [selectedLocale, setSelectedLocale] = useState<Locale>(initialLocale);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSlug, setDraftSlug] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<PageBuilderDocument>(DEFAULT_PAGE_DOCUMENT);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [publishing, startPublishing] = useTransition();
  const [updatingPage, startUpdatingPage] = useTransition();

  const translations = pageState.translations;
  const currentTranslation = translations.find((item) => item.locale === selectedLocale);

  useEffect(() => {
    const fallback = translations[0];
    const nextTranslation = currentTranslation ?? fallback;

    if (nextTranslation) {
      setSelectedLocale(nextTranslation.locale);
      setDraftTitle(nextTranslation.title);
      setDraftSlug(nextTranslation.slug);
      setDraftDescription(nextTranslation.description);
      setEditorState(toEditorDocument(nextTranslation.draftDocument));
      setDirty(false);
    }
  }, [pageState.id, currentTranslation?.id]);

  const publishDisabled = !currentTranslation || publishing || saving;
  const saveDisabled = !currentTranslation || saving || !dirty;
  const publishButtonDisabled =
    publishDisabled || (!dirty && currentTranslation?.isPublished === true);

  const onSaveDraft = () => {
    if (!currentTranslation) return;

    startSaving(async () => {
      try {
        const updated = await savePageDraft({
          translationId: currentTranslation.id,
          title: draftTitle,
          slug: draftSlug ?? null,
          description: draftDescription ?? null,
          draftDocument: editorState,
        });

        setPageState((prev) => ({
          ...prev,
          translations: prev.translations.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item
          ),
        }));
        setDirty(false);
        toast.success("Draft saved");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save";
        toast.error(message);
      }
    });
  };

  const onPublish = () => {
    if (!currentTranslation) return;

    startPublishing(async () => {
      try {
        const updated = await publishPage({
          translationId: currentTranslation.id,
          document: editorState,
          title: draftTitle,
          slug: draftSlug ?? null,
          description: draftDescription ?? null,
          pageStatus: pageState.status === "archived" ? pageState.status : "published",
        });

        setPageState((prev) => ({
          ...prev,
          status: "published",
          translations: prev.translations.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item
          ),
        }));
        setDirty(false);
        toast.success("Page published");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to publish";
        toast.error(message);
      }
    });
  };

  const onUpdatePage = (changes: Partial<PageRecord>) => {
    startUpdatingPage(async () => {
      try {
        const updated = await updateManagedPage({
          pageId: pageState.id,
          slug: changes.slug,
          title: changes.title,
          status: changes.status,
          visibility: changes.visibility,
          template: changes.template ?? pageState.template,
          campusId: changes.campusId ?? pageState.campusId,
        });
        setPageState(updated);
        toast.success("Page settings updated");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update page";
        toast.error(message);
      }
    });
  };

  const addTranslation = (locale: Locale) => {
    startSaving(async () => {
      try {
        const created = await ensureTranslation({
          pageId: pageState.id,
          locale,
          sourceTranslationId: currentTranslation?.id,
        });
        setPageState((prev) => ({
          ...prev,
          translations: [...prev.translations, created],
        }));
        setSelectedLocale(locale);
        toast.success(`${LOCALE_LABELS[locale]} translation added`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to add translation";
        toast.error(message);
      }
    });
  };

  const availableLocales = useMemo(
    () => new Set(pageState.translations.map((item) => item.locale)),
    [pageState.translations]
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-lg border border-primary/10 bg-white p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="page-slug">Slug</Label>
            <Input
              id="page-slug"
              value={pageState.slug}
              onChange={(event) =>
                setPageState((prev) => ({ ...prev, slug: event.target.value }))
              }
              onBlur={(event) =>
                onUpdatePage({ slug: event.target.value || pageState.slug })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={pageState.status}
              onValueChange={(value: PageStatus) => onUpdatePage({ status: value })}
              disabled={updatingPage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Visibility</Label>
            <Select
              value={pageState.visibility}
              onValueChange={(value: PageVisibility) => onUpdatePage({ visibility: value })}
              disabled={updatingPage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "public" ? "Public" : "Members only"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="page-template">Template key</Label>
            <Input
              id="page-template"
              value={pageState.template ?? ""}
              placeholder="Optional"
              onChange={(event) =>
                setPageState((prev) => ({ ...prev, template: event.target.value }))
              }
              onBlur={(event) =>
                onUpdatePage({ template: event.target.value || null })
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-primary/10 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {translations.map((translation) => {
              const isActive = translation.locale === selectedLocale;

              return (
                <Button
                  key={translation.id}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    "flex items-center gap-2",
                    isActive ? "bg-primary text-white" : "text-primary-100"
                  )}
                  onClick={() => setSelectedLocale(translation.locale)}
                >
                  <span>{LOCALE_LABELS[translation.locale]}</span>
                  {translation.isPublished ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        isActive
                          ? "bg-white/80 text-primary-90"
                          : "bg-emerald-500/15 text-emerald-700"
                      )}
                    >
                      Live
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(LOCALE_LABELS)
              .filter((locale) => !availableLocales.has(locale as Locale))
              .map((locale) => (
                <Button
                  key={locale}
                  size="sm"
                  variant="outline"
                  disabled={saving || publishing}
                  onClick={() => addTranslation(locale as Locale)}
                >
                  Add {LOCALE_LABELS[locale as Locale]}
                </Button>
              ))}
          </div>
        </div>

        {currentTranslation ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="translation-title">Title</Label>
                <Input
                  id="translation-title"
                  value={draftTitle}
                  onChange={(event) => {
                    setDraftTitle(event.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="translation-slug">Slug</Label>
                <Input
                  id="translation-slug"
                  value={draftSlug ?? ""}
                  placeholder="Optional locale override"
                  onChange={(event) => {
                    setDraftSlug(event.target.value || null);
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="translation-description">Description</Label>
              <Textarea
                id="translation-description"
                value={draftDescription ?? ""}
                placeholder="Optional meta description"
                onChange={(event) => {
                  setDraftDescription(event.target.value || null);
                  setDirty(true);
                }}
              />
            </div>
            <div className="rounded-lg border border-dashed border-primary/20 bg-muted/40 p-4">
              <PageBuilderEditor
                data={editorState}
                onChange={(data) => {
                  setEditorState(data);
                  setDirty(true);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={saving || publishing}
                onClick={() => {
                  setEditorState(toEditorDocument(currentTranslation.draftDocument));
                  setDraftTitle(currentTranslation.title);
                  setDraftSlug(currentTranslation.slug);
                  setDraftDescription(currentTranslation.description);
                  setDirty(false);
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset changes
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={saveDisabled}
                  onClick={onSaveDraft}
                  className="inline-flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save draft"}
                </Button>
                <Button
                  disabled={publishButtonDisabled}
                  onClick={onPublish}
                  className="inline-flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {publishing ? "Publishing..." : "Publish"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add a translation to start editing content.
          </p>
        )}
      </section>
    </div>
  );
}
