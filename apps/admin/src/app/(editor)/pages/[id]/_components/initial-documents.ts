// The documents the page editor opens with, one per locale. Pure, so the
// seeding is testable without the editor.
import type {
  PageEditorLoadResult,
  PageEditorSharedData,
  PageTranslationEditorEntry,
} from "@repo/api/page-builder";
import { normalizePageDoc } from "@repo/editor/serialize";
import { emptyHeader } from "@repo/editor/templates";
import type { EditorLocale, PageDoc } from "@repo/editor/types";
import { generateSlug } from "@repo/shared/utils/content-slug";

export type LocaleDocuments = Partial<Record<EditorLocale, PageDoc>>;

const UNTITLED: Record<EditorLocale, string> = {
  en: "Untitled page",
  no: "Uten navn",
};

/**
 * The campus a page's document carries: an existing page its own ("" for a
 * national page), a new page the editor's default. Never the editor's campus
 * for an existing page, or the first save would move it.
 */
function pageCampus(
  page: PageEditorSharedData | undefined,
  defaultCampusId: string
): string {
  return page ? (page.campusId ?? "") : defaultCampusId;
}

/**
 * A document for a locale that has none stored. The editor saves it on the
 * first edit, so its meta is what the page already has: the translation's
 * title and description, and the page's slug, campus and department (or the
 * open document's, for a second locale). Placeholders only for a new page.
 * It opens with a plain page header carrying the title, so every page has
 * its `<h1>` from the start.
 */
export function blankPageDoc({
  defaultCampusId,
  locale,
  page,
  source,
  translation,
}: {
  defaultCampusId: string;
  locale: EditorLocale;
  page?: PageEditorSharedData;
  /** The document open in another locale, whose shared meta this one follows. */
  source?: PageDoc;
  translation?: PageTranslationEditorEntry;
}): PageDoc {
  const title = translation?.title || UNTITLED[locale];
  const slug =
    source?.meta.slug || page?.slug || generateSlug(title) || "untitled";
  const status =
    source?.meta.status ??
    (page?.status === "published" ? "published" : "draft");
  return {
    // The placeholder title stays out of the header: the site falls back to
    // meta.title, and the editor shows it greyed until the page is named.
    header: emptyHeader(translation?.title ? title : ""),
    meta: {
      campus: source?.meta.campus ?? pageCampus(page, defaultCampusId),
      department: source?.meta.department ?? page?.departmentId ?? "",
      description: translation?.description ?? "",
      slug,
      status,
      title,
      ...(source?.meta.theme === undefined ? {} : { theme: source.meta.theme }),
    },
    sections: [],
    version: 2,
  };
}

function storedDoc(
  entry: PageTranslationEditorEntry | undefined
): PageDoc | null {
  const doc = (entry?.draftDocument ??
    entry?.publishedDocument ??
    null) as PageDoc | null;
  return doc ? normalizePageDoc(doc) : null;
}

/** Every locale's stored document, plus a blank one for the opening locale. */
export function buildInitialDocuments(
  initialPage: PageEditorLoadResult | null,
  initialLocale: EditorLocale,
  defaultCampusId: string
): LocaleDocuments {
  const docs: LocaleDocuments = {};
  const page = initialPage?.page;

  if (initialPage) {
    for (const locale of initialPage.availableLocales) {
      const doc = storedDoc(initialPage.translations[locale]);
      if (doc) {
        // Documents saved before campus lived on them get the page's campus.
        docs[locale] = structuredClone({
          ...doc,
          meta: {
            ...doc.meta,
            campus: doc.meta.campus ?? pageCampus(page, defaultCampusId),
          },
        });
      }
    }
  }

  if (!docs[initialLocale]) {
    docs[initialLocale] = blankPageDoc({
      defaultCampusId,
      locale: initialLocale,
      page,
      translation: initialPage?.translations[initialLocale],
    });
  }

  return docs;
}

/**
 * Whether a locale's document holds anything a translation would overwrite:
 * sections, a page header or a title. Translating into such a locale asks
 * for confirmation first.
 */
export function hasExistingContent(doc: PageDoc | undefined): boolean {
  return Boolean(
    doc &&
      (doc.sections.length > 0 ||
        doc.header !== undefined ||
        doc.meta.title.trim())
  );
}

/** Copy the meta every locale shares from the document just edited. */
export function syncSharedMeta(
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
              campus: sourceDoc.meta.campus,
              department: sourceDoc.meta.department,
              status: sourceDoc.meta.status,
              theme: sourceDoc.meta.theme,
            },
          };
  }

  return next;
}
