"use client";

import type {
  PageEditorLoadResult,
  PageTranslationEditorEntry,
} from "@repo/api/page-builder";
import type {
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
} from "@repo/editor";
import { EditorShell, normalizePageDoc } from "@repo/editor";
import "@repo/editor/theme/styles.css";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AutoTranslateControl } from "@/app/_components/content-translation-controls";
import {
  publishPageAction,
  savePageEditorDoc,
  unpublishPageAction,
} from "@/app/(portal)/_actions/pages";
import { uploadMediaFile } from "@/app/(portal)/_actions/upload";
import { sanitizeSlug } from "@/lib/utils";

interface PageEditorClientProps {
  availableLocales: EditorLocale[];
  departments: EditorDepartment[];
  initialLocale: EditorLocale;
  initialPage: PageEditorLoadResult | null;
  pageId: string | null;
}

type LocaleDocuments = Partial<Record<EditorLocale, PageDoc>>;

const LOCALE_LABELS: Record<EditorLocale, string> = {
  no: "Norwegian",
  en: "English",
};

function cloneDoc(doc: PageDoc): PageDoc {
  return structuredClone(doc);
}

function emptyDoc({
  locale,
  slug,
  department,
  status,
  source,
}: {
  locale: EditorLocale;
  slug?: string | null;
  department?: string | null;
  status?: PageDoc["meta"]["status"];
  source?: PageDoc | null;
}): PageDoc {
  const title = locale === "no" ? "Uten navn" : "Untitled page";
  return {
    meta: {
      title,
      slug: slug || sanitizeSlug(title) || "untitled",
      department: department ?? "",
      accentColor: source?.meta.accentColor ?? "#3DA9E0",
      description: "",
      status: status ?? "draft",
    },
    blocks: [],
  };
}

function getTranslationDoc(
  entry: PageTranslationEditorEntry | undefined
): PageDoc | null {
  const doc = (entry?.draftDocument ??
    entry?.publishedDocument ??
    null) as PageDoc | null;
  return doc ? normalizePageDoc(doc) : null;
}

function buildInitialDocuments(
  initialPage: PageEditorLoadResult | null,
  initialLocale: EditorLocale
): LocaleDocuments {
  const docs: LocaleDocuments = {};

  if (initialPage) {
    for (const locale of initialPage.availableLocales) {
      const doc = getTranslationDoc(initialPage.translations[locale]);
      if (doc) {
        docs[locale] = cloneDoc(doc);
      }
    }
  }

  if (!docs[initialLocale]) {
    docs[initialLocale] = emptyDoc({
      locale: initialLocale,
      slug: initialPage?.page.slug,
      department: initialPage?.page.departmentId,
      status: initialPage?.page.status === "published" ? "published" : "draft",
    });
  }

  return docs;
}

function syncSharedMeta(
  docs: LocaleDocuments,
  sourceLocale: EditorLocale,
  sourceDoc: PageDoc
): LocaleDocuments {
  const next: LocaleDocuments = {};

  for (const [locale, doc] of Object.entries(docs) as [
    EditorLocale,
    PageDoc | undefined,
  ][]) {
    if (!doc) {
      continue;
    }
    next[locale] =
      locale === sourceLocale
        ? sourceDoc
        : {
            ...doc,
            meta: {
              ...doc.meta,
              slug: sourceDoc.meta.slug,
              department: sourceDoc.meta.department,
              status: sourceDoc.meta.status,
              accentColor: sourceDoc.meta.accentColor,
            },
          };
  }

  return next;
}

export function PageEditorClient({
  initialPage,
  initialLocale,
  availableLocales,
  pageId,
  departments,
}: PageEditorClientProps) {
  const router = useRouter();
  const [currentPageId, setCurrentPageId] = useState<string | null>(pageId);
  const [activeLocale, setActiveLocale] = useState<EditorLocale>(initialLocale);
  const [documents, setDocuments] = useState<LocaleDocuments>(() =>
    buildInitialDocuments(initialPage, initialLocale)
  );
  const [pendingTranslateLocale, setPendingTranslateLocale] =
    useState<EditorLocale | null>(null);
  const [translatingLocale, setTranslatingLocale] =
    useState<EditorLocale | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(false);

  const activeDoc =
    documents[activeLocale] ??
    emptyDoc({
      locale: activeLocale,
      slug: initialPage?.page.slug,
      department: initialPage?.page.departmentId,
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

  async function handleSave(doc: PageDoc, locale: EditorLocale) {
    const result = await savePageEditorDoc({ id: currentPageId, doc, locale });
    if ("error" in result) {
      throw new Error(result.error);
    }
    if (result.slug && result.slug !== doc.meta.slug) {
      const docWithResolvedSlug = {
        ...doc,
        meta: { ...doc.meta, slug: result.slug },
      };
      setDocuments((current) =>
        syncSharedMeta(
          { ...current, [locale]: docWithResolvedSlug },
          locale,
          docWithResolvedSlug
        )
      );
    }
    if (!currentPageId && "pageId" in result) {
      setCurrentPageId(result.pageId);
      router.replace(`/pages/${result.pageId}`);
    }
    return { slug: result.slug };
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
        [locale]: emptyDoc({
          locale,
          slug: activeDoc.meta.slug,
          department: activeDoc.meta.department,
          status: activeDoc.meta.status,
          source: activeDoc,
        }),
      };
    });
    setActiveLocale(locale);
  }

  async function handleTranslateLocale(targetLocale: EditorLocale) {
    const targetDoc = documents[targetLocale];
    const hasExistingContent = Boolean(
      targetDoc && (targetDoc.blocks.length > 0 || targetDoc.meta.title.trim())
    );

    if (hasExistingContent) {
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
          slug: activeDoc.meta.slug,
          department: activeDoc.meta.department,
          status: activeDoc.meta.status,
          accentColor: activeDoc.meta.accentColor,
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
    const result = await uploadMediaFile(fd);
    if ("error" in result) {
      throw new Error(result.error);
    }
    return { fileId: result.fileId, url: result.url };
  }

  function handleExit() {
    router.push("/pages");
  }

  async function handlePublish(locale: EditorLocale) {
    if (!currentPageId) {
      toast.error("Save the page first before publishing.");
      return;
    }
    try {
      const result = await publishPageAction(currentPageId, locale, {
        enabled: autoTranslate,
        sourceLocale: locale,
      });
      setDocuments((current) => {
        const doc = current[locale];
        if (!doc) {
          return current;
        }
        return {
          ...current,
          [locale]: { ...doc, meta: { ...doc.meta, status: "published" } },
        };
      });
      toast.success(
        result.translationQueued
          ? "Page published. Translation queued."
          : "Page published to biso.no"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    }
  }

  async function handleUnpublish(locale: EditorLocale) {
    if (!currentPageId) {
      return;
    }
    try {
      await unpublishPageAction(currentPageId, locale);
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
    }
  }

  return (
    <>
      <EditorShell
        activeLocale={activeLocale}
        departments={departments}
        initial={activeDoc}
        locales={localeOptions}
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
