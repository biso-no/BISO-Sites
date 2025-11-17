"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Locale, PageStatus } from "@repo/api/types/appwrite";
import type { PageRecord, PageTranslationRecord } from "@repo/api/page-builder";
import {
  ensureTranslation,
  publishPage,
  savePageDraft,
  updateManagedPage,
} from "@/app/actions/pages";
import { PageBuilderEditor } from "@repo/editor/editor";
import { DEFAULT_PAGE_DOCUMENT } from "@repo/editor";
import type { PageBuilderDocument } from "@repo/editor/types";
import { GlobalSettingsSidebar } from "./global-settings-sidebar";
import { EditorHeader } from "./editor-header";
import { areDocumentsInSync } from "@/lib/editor-utils";
import { Button } from "@repo/ui/components/ui/button";
import { PlusCircle } from "lucide-react";

const LOCALE_LABELS: Record<Locale, string> = {
  [Locale.NO]: "Norwegian",
  [Locale.EN]: "English",
};

const ALL_LOCALES: Locale[] = [Locale.NO, Locale.EN];

interface PageEditorProps {
  page: PageRecord;
  initialLocale: Locale;
}

interface LocaleState {
  translation: PageTranslationRecord;
  title: string;
  slug: string | null;
  description: string | null;
  document: PageBuilderDocument;
  isDirty: boolean;
}

function toEditorDocument(
  document: PageTranslationRecord["draftDocument"]
): PageBuilderDocument {
  return (document ?? DEFAULT_PAGE_DOCUMENT) as PageBuilderDocument;
}

export function PageEditor({ page, initialLocale }: PageEditorProps) {
  const [pageState, setPageState] = useState<PageRecord>(page);
  const [activeLocale, setActiveLocale] = useState<Locale>(initialLocale);
  const [saving, startSaving] = useTransition();
  const [publishing, startPublishing] = useTransition();
  const [updatingPage, startUpdatingPage] = useTransition();

  // Manage state for all locales
  const [localeStates, setLocaleStates] = useState<Map<Locale, LocaleState>>(
    () => {
      const map = new Map<Locale, LocaleState>();
      pageState.translations.forEach((translation) => {
        const doc = toEditorDocument(translation.draftDocument);
        map.set(translation.locale, {
          translation,
          title: translation.title,
          slug: translation.slug,
          description: translation.description,
          document: {
            ...doc,
            root: {
              ...doc.root,
              props: {
                ...doc.root.props,
                title: translation.title || "",
                description: translation.description || "",
                slug: translation.slug || "",
              },
            },
          },
          isDirty: false,
        });
      });
      return map;
    }
  );

  // Get current locale state
  const currentState = localeStates.get(activeLocale);

  // Calculate sync status
  const inSync = useMemo(() => {
    const documents = Array.from(localeStates.values()).map((s) => s.document);
    return areDocumentsInSync(documents[0], documents[1]);
  }, [localeStates]);

  // Prepare status objects for LocaleSwitcher
  const publishedStatus = useMemo(() => {
    const status: Record<Locale, boolean> = {} as Record<Locale, boolean>;
    localeStates.forEach((state, locale) => {
      status[locale] = state.translation.isPublished ?? false;
    });
    return status;
  }, [localeStates]);

  const dirtyStatus = useMemo(() => {
    const status: Record<Locale, boolean> = {} as Record<Locale, boolean>;
    localeStates.forEach((state, locale) => {
      status[locale] = state.isDirty;
    });
    return status;
  }, [localeStates]);

  // Always show all locales, not just ones with translations
  const availableLocales = ALL_LOCALES;

  // Handle document changes from Puck editor
  const handleDocumentChange = (newDocument: PageBuilderDocument) => {
    if (!currentState) return;

    setLocaleStates((prev) => {
      const next = new Map(prev);
      const state = next.get(activeLocale);
      if (!state) return prev;

      // Extract metadata from root props
      const title = newDocument.root.props?.title || state.title;
      const description = newDocument.root.props?.description || state.description;
      const slug = newDocument.root.props?.slug || state.slug;

      next.set(activeLocale, {
        ...state,
        title,
        description,
        slug,
        document: newDocument,
        isDirty: true,
      });
      return next;
    });
  };

  // Handle locale switching
  const handleLocaleChange = (locale: Locale) => {
    setActiveLocale(locale);
  };

  // Save draft for current locale
  const handleSave = () => {
    if (!currentState) return;

    startSaving(async () => {
      try {
        const updated = await savePageDraft({
          translationId: currentState.translation.id,
          title: currentState.title,
          slug: currentState.slug,
          description: currentState.description,
          draftDocument: currentState.document,
        });

        setLocaleStates((prev) => {
          const next = new Map(prev);
          const state = next.get(activeLocale);
          if (!state) return prev;

          next.set(activeLocale, {
            ...state,
            translation: { ...state.translation, ...updated },
            isDirty: false,
          });
          return next;
        });

        toast.success("Draft saved");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save";
        toast.error(message);
      }
    });
  };

  // Publish current locale
  const handlePublish = () => {
    if (!currentState) return;

    startPublishing(async () => {
      try {
        const updated = await publishPage({
          translationId: currentState.translation.id,
          document: currentState.document,
          title: currentState.title,
          slug: currentState.slug,
          description: currentState.description,
          pageStatus:
            pageState.status === PageStatus.ARCHIVED
              ? pageState.status
              : PageStatus.PUBLISHED,
        });

        setLocaleStates((prev) => {
          const next = new Map(prev);
          const state = next.get(activeLocale);
          if (!state) return prev;

          next.set(activeLocale, {
            ...state,
            translation: { ...state.translation, ...updated },
            isDirty: false,
          });
          return next;
        });

        setPageState((prev) => ({
          ...prev,
          status: PageStatus.PUBLISHED,
        }));

        toast.success("Page published");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to publish";
        toast.error(message);
      }
    });
  };

  // Revert changes for current locale
  const handleRevert = () => {
    if (!currentState) return;

    const originalDoc = toEditorDocument(currentState.translation.draftDocument);
    setLocaleStates((prev) => {
      const next = new Map(prev);
      const state = next.get(activeLocale);
      if (!state) return prev;

      next.set(activeLocale, {
        ...state,
        title: state.translation.title,
        slug: state.translation.slug,
        description: state.translation.description,
        document: {
          ...originalDoc,
          root: {
            ...originalDoc.root,
            props: {
              ...originalDoc.root.props,
              title: state.translation.title || "",
              description: state.translation.description || "",
              slug: state.translation.slug || "",
            },
          },
        },
        isDirty: false,
      });
      return next;
    });
  };

  // Update page-level settings
  const handlePageUpdate = (changes: Partial<PageRecord>) => {
    startUpdatingPage(async () => {
      try {
        const updated = await updateManagedPage({
          pageId: pageState.id,
          slug: changes.slug ?? pageState.slug,
          title: changes.title ?? pageState.title,
          status: changes.status ?? pageState.status,
          visibility: changes.visibility ?? pageState.visibility,
          template: changes.template ?? pageState.template,
          campusId: changes.campusId ?? pageState.campusId,
        });
        setPageState(updated);
        toast.success("Page settings updated");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update page";
        toast.error(message);
      }
    });
  };

  // Add translation for a locale
  const handleAddTranslation = (locale: Locale) => {
    startSaving(async () => {
      try {
        // Get a source translation to copy structure from
        const sourceTranslation = Array.from(localeStates.values())[0]
          ?.translation;

        const created = await ensureTranslation({
          pageId: pageState.id,
          locale,
          sourceTranslationId: sourceTranslation?.id,
        });

        // Add to locale states
        const doc = toEditorDocument(created.draftDocument);
        setLocaleStates((prev) => {
          const next = new Map(prev);
          next.set(locale, {
            translation: created,
            title: created.title,
            slug: created.slug,
            description: created.description,
            document: {
              ...doc,
              root: {
                ...doc.root,
                props: {
                  ...doc.root.props,
                  title: created.title || "",
                  description: created.description || "",
                  slug: created.slug || "",
                },
              },
            },
            isDirty: false,
          });
          return next;
        });

        setActiveLocale(locale);
        toast.success(`${LOCALE_LABELS[locale]} translation added`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to add translation";
        toast.error(message);
      }
    });
  };

  const canSave = currentState?.isDirty && !saving && !publishing;
  const canPublish = !saving && !publishing;

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Main editor area */}
      <div className="glass-panel flex flex-1 flex-col overflow-hidden rounded-lg border border-primary/10">
        {/* Custom header */}
        <EditorHeader
          locales={availableLocales}
          activeLocale={activeLocale}
          onLocaleChange={handleLocaleChange}
          inSync={inSync}
          publishedStatus={publishedStatus}
          dirtyStatus={dirtyStatus}
          onSave={handleSave}
          onPublish={handlePublish}
          onRevert={handleRevert}
          saving={saving}
          publishing={publishing}
          canSave={canSave ?? false}
          canPublish={canPublish}
        />

        {/* Editor or empty state */}
        {currentState ? (
          <div className="flex h-full flex-1 flex-col overflow-hidden">
            <PageBuilderEditor
              data={currentState.document}
              onChange={handleDocumentChange}
              overrides={{
                // Hide Puck's default header since we render our own above
                header: () => <></>,
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              <p className="mb-4 text-lg text-muted-foreground">
                No {LOCALE_LABELS[activeLocale]} translation yet
              </p>
              <Button
                onClick={() => handleAddTranslation(activeLocale)}
                disabled={saving}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {saving ? "Creating..." : `Create ${LOCALE_LABELS[activeLocale]} translation`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Global settings sidebar */}
      <GlobalSettingsSidebar
        page={pageState}
        onUpdate={handlePageUpdate}
        updating={updatingPage}
      />
    </div>
  );
}
