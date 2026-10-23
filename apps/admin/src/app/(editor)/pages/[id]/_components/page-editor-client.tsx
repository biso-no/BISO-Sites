"use client";

import type { PageEditorLoadResult } from "@repo/api/page-builder";
import type {
  EditorCampus,
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
  PublishOutcome,
  StoredMeta,
} from "@repo/editor";
import { EditorShell } from "@repo/editor";
import "@repo/editor/theme/styles.css";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AutoTranslateControl } from "@/app/_components/content-translation-controls";
import {
  publishPageAction,
  savePageEditorDoc,
  unpublishPageAction,
} from "@/app/(portal)/_actions/pages";
import { pickSharedMeta } from "@/lib/page-shared-meta";
import { uploadMediaFile } from "@/lib/upload-client";
import {
  blankPageDoc,
  buildInitialDocuments,
  hasExistingContent,
  type LocaleDocuments,
  syncSharedMeta,
  withDepartmentTheme,
  withoutPageTheme,
  withStoredMeta,
} from "./initial-documents";

interface PageEditorClientProps {
  availableLocales: EditorLocale[];
  campuses: EditorCampus[];
  defaultCampusId: string;
  departments: EditorDepartment[];
  initialLocale: EditorLocale;
  initialPage: PageEditorLoadResult | null;
  lockedMeta?: { department?: boolean; slug?: boolean };
  pageId: string | null;
}

const LOCALE_LABELS: Record<EditorLocale, string> = {
  no: "Norwegian",
  en: "English",
};

function cloneDoc(doc: PageDoc): PageDoc {
  return structuredClone(doc);
}

export function PageEditorClient({
  initialPage,
  initialLocale,
  availableLocales,
  pageId,
  campuses,
  defaultCampusId,
  departments,
  lockedMeta,
}: PageEditorClientProps) {
  const router = useRouter();
  // The latest id, readable from closures captured before the first create
  // resolved (autosave, the explicit translate save).
  const pageIdRef = useRef<string | null>(pageId);
  const [activeLocale, setActiveLocale] = useState<EditorLocale>(initialLocale);
  const [documents, setDocuments] = useState<LocaleDocuments>(() =>
    buildInitialDocuments(initialPage, initialLocale, defaultCampusId)
  );
  const [pendingTranslateLocale, setPendingTranslateLocale] =
    useState<EditorLocale | null>(null);
  const [translatingLocale, setTranslatingLocale] =
    useState<EditorLocale | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(false);
  // The departments' themes as this session last saw them: a publish that
  // copies the page's theme updates its department here, so the canvas shows
  // the colours that are now live.
  const [departmentList, setDepartmentList] = useState(departments);

  const activeDoc =
    documents[activeLocale] ??
    blankPageDoc({
      defaultCampusId,
      locale: activeLocale,
      page: initialPage?.page,
      translation: initialPage?.translations[activeLocale],
    });

  const localeOptions = useMemo<EditorLocaleOption[]>(
    () =>
      availableLocales.map((locale) => ({
        locale,
        label: LOCALE_LABELS[locale] ?? locale.toUpperCase(),
        hasDraft: Boolean(documents[locale]),
      })),
    [availableLocales, documents]
  );

  async function handleSave(
    doc: PageDoc,
    locale: EditorLocale
  ): Promise<StoredMeta> {
    const result = await savePageEditorDoc({
      id: pageIdRef.current,
      doc,
      locale,
    });
    if ("error" in result) {
      throw new Error(result.error);
    }
    // The server may have stored another slug (made unique) or department
    // (a department user's page is bound to their department). Every locale
    // takes it, so the Theme panel's scope line and the canvas match what
    // Publish will do.
    const stored = { department: result.department, slug: result.slug };
    setDocuments((current) =>
      withStoredMeta(
        current,
        { department: doc.meta.department, slug: doc.meta.slug },
        stored
      )
    );
    if (!pageIdRef.current && "pageId" in result) {
      pageIdRef.current = result.pageId;
      // Not router.replace: that remounts the editor and re-hydrates from the
      // server copy, dropping edits made during the save round-trip.
      window.history.replaceState(null, "", `/pages/${result.pageId}`);
    }
    return stored;
  }

  function handleDocChange(doc: PageDoc, locale: EditorLocale) {
    const nextDoc = cloneDoc(doc);
    setDocuments((current) =>
      syncSharedMeta({ ...current, [locale]: nextDoc }, locale, nextDoc)
    );
  }

  function handleLocaleChange(locale: EditorLocale) {
    setDocuments((current) => {
      if (current[locale]) {
        return current;
      }
      return {
        ...current,
        [locale]: blankPageDoc({
          defaultCampusId,
          locale,
          page: initialPage?.page,
          source: activeDoc,
          translation: initialPage?.translations[locale],
        }),
      };
    });
    setActiveLocale(locale);
  }

  async function handleTranslateLocale(targetLocale: EditorLocale) {
    if (hasExistingContent(documents[targetLocale])) {
      setPendingTranslateLocale(targetLocale);
      return;
    }

    await runTranslateLocale(targetLocale);
  }

  async function runTranslateLocale(targetLocale: EditorLocale) {
    setPendingTranslateLocale(null);
    setTranslatingLocale(targetLocale);
    try {
      const response = await fetch("/api/translate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageData: activeDoc,
          sourceLocale: activeLocale,
          targetLocale,
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation failed (${response.status})`);
      }

      const result = (await response.json()) as { translatedDocument: PageDoc };
      const translatedDocument = {
        ...result.translatedDocument,
        meta: {
          ...result.translatedDocument.meta,
          ...pickSharedMeta(activeDoc.meta),
        },
      };

      setDocuments((current) =>
        syncSharedMeta(
          { ...current, [targetLocale]: translatedDocument },
          targetLocale,
          translatedDocument
        )
      );
      setActiveLocale(targetLocale);
      // The editor autosaves only real edits, and a generated draft opens as
      // the locale's loaded document, so it is stored here.
      await handleSave(translatedDocument, targetLocale);
      toast.success(
        `Translated ${LOCALE_LABELS[activeLocale]} to ${LOCALE_LABELS[targetLocale]}`
      );
    } catch (error) {
      console.error("[PageEditor translate]", error);
      toast.error(
        error instanceof Error ? error.message : "Translation failed"
      );
    } finally {
      setTranslatingLocale(null);
    }
  }

  async function handleUpload(
    fd: FormData
  ): Promise<{ fileId: string; url: string }> {
    const file = fd.get("file");
    if (!(file instanceof File)) {
      throw new Error("No file provided");
    }
    const result = await uploadMediaFile(file);
    if (result.error !== undefined) {
      throw new Error(result.error);
    }
    return { fileId: result.fileId, url: result.url };
  }

  function handleExit() {
    router.push("/pages");
  }

  // Both handlers reject on failure: the editor shell mirrors a resolved
  // publish/unpublish into its own status, so resolving after a failure
  // would mark a page published that is not.
  async function handlePublish(locale: EditorLocale): Promise<PublishOutcome> {
    const id = pageIdRef.current;
    if (!id) {
      toast.error("Save the page first before publishing.");
      throw new Error("Page not saved yet");
    }
    try {
      const result = await publishPageAction(id, locale, {
        enabled: autoTranslate,
        sourceLocale: locale,
      });
      setDocuments((current) => {
        const doc = current[locale];
        const next = doc
          ? {
              ...current,
              [locale]: { ...doc, meta: { ...doc.meta, status: "published" } },
            }
          : current;
        // The department owns the theme now; no locale may save it back.
        return result.themeCopied ? withoutPageTheme(next) : next;
      });
      setDepartmentList((current) =>
        withDepartmentTheme(current, result.departmentTheme)
      );
      if (result.themeCopyFailed) {
        toast.warning(
          "Published, but the department colours couldn't be updated. Try publishing again."
        );
      } else {
        toast.success(
          result.translationQueued
            ? "Page published. Translation queued."
            : "Page published to biso.no"
        );
      }
      return { themeCopied: result.themeCopied };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
      throw err;
    }
  }

  async function handleUnpublish(locale: EditorLocale) {
    const id = pageIdRef.current;
    if (!id) {
      throw new Error("Page not saved yet");
    }
    try {
      await unpublishPageAction(id, locale);
      setDocuments((current) => {
        const doc = current[locale];
        if (!doc) {
          return current;
        }
        return {
          ...current,
          [locale]: { ...doc, meta: { ...doc.meta, status: "draft" } },
        };
      });
      toast.success("Page unpublished");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unpublish failed");
      throw err;
    }
  }

  return (
    <>
      <EditorShell
        activeLocale={activeLocale}
        campuses={campuses}
        departments={departmentList}
        initial={activeDoc}
        locales={localeOptions}
        lockedMeta={lockedMeta}
        onDocChange={handleDocChange}
        onExit={handleExit}
        onLocaleChange={handleLocaleChange}
        onPublish={handlePublish}
        onTranslateLocale={handleTranslateLocale}
        onUnpublish={handleUnpublish}
        savePage={handleSave}
        topbarActions={
          <AutoTranslateControl
            checked={autoTranslate}
            compact
            onCheckedChange={setAutoTranslate}
            operation="publish"
            sourceLocale={activeLocale}
          />
        }
        translatingLocale={translatingLocale}
        uploadFile={handleUpload}
      />

      {pendingTranslateLocale && (
        <div aria-modal="true" className="pe-confirm" role="alertdialog">
          <div className="pe-confirm__panel">
            <div className="pe-confirm__title">Replace translated draft?</div>
            <p>
              This will replace the {LOCALE_LABELS[pendingTranslateLocale]}{" "}
              draft with an automatic translation.
            </p>
            <div className="pe-confirm__actions">
              <button
                onClick={() => setPendingTranslateLocale(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => runTranslateLocale(pendingTranslateLocale)}
                type="button"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
