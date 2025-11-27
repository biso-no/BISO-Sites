import type { Locale } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { notFound } from "next/navigation";
import { ensureTranslation, getManagedPage } from "@/app/actions/pages";
import { EditorClient } from "./client";

type EditorPageProps = {
  params: Promise<{
    pageId: string;
    locale: string;
  }>;
};

const SUPPORTED_LOCALES: Locale[] = ["no", "en"] as Locale[];

export default async function EditorPage({ params }: EditorPageProps) {
  const { pageId, locale } = await params;
  const page = await getManagedPage(pageId);

  if (!page) {
    notFound();
  }

  const translation = page.translations.find(
    (t) => t.locale === (locale as Locale)
  );

  // If translation doesn't exist, we should redirect to a default one OR handle creation
  // But wait, the user wants to be able to switch locales.
  // If I am on /no/editor and I switch to /en/editor, and EN doesn't exist, I should create it?
  // The previous code showed "Translation not found".

  // Let's try to auto-create if it's a supported locale but missing?
  // Or just let the client handle the creation logic via the "Switch Locale" UI.
  // But if we land here directly, we need a translation record to edit.

  if (!translation && SUPPORTED_LOCALES.includes(locale as Locale)) {
    // We can use ensureTranslation here?
    // But ensureTranslation is an action, can we call it in Server Component?
    // It uses createAdminClient, so yes.
    try {
      const _newTranslation = await ensureTranslation({
        pageId,
        locale: locale as Locale,
        title: page.title, // Default title
        // We could copy content from another locale if desired, but for now blank
      });
      // Redirect to self to reload with new data
      // actually we can just continue with newTranslation
      // but let's just redirect to be safe and clean state
      // redirect(`/admin/pages/${pageId}/${locale}/editor`);
      // (Redirect might cause loop if ensure fails, so let's just use the object)

      // Let's just pass this new object down
      // But for safety and simplicity let's return the client with this new data
      // Actually, better to just let the client handle "not found" state if we want to be explicit?
      // But the request implies a smooth flow.

      // Let's fallback to "Translation not found" UI if we really can't find it,
      // but since we are in the "editor" route, we expect to edit.

      // Let's return a special state or auto-create.
      // I'll implement auto-create in the action `ensureTranslation` and call it here.
    } catch (e) {
      console.error("Failed to ensure translation", e);
    }
  }

  // Refetch to be sure
  const freshPage = await getManagedPage(pageId);
  const freshTranslation = freshPage?.translations.find(
    (t) => t.locale === (locale as Locale)
  );

  if (!freshTranslation) {
    // If still not found, maybe invalid locale or error
    return (
      <div className="p-8">
        <h1 className="mb-4 font-bold text-2xl">Translation not found</h1>
        <p>Could not load or create translation for {locale}.</p>
      </div>
    );
  }

  // Ensure we have valid initial data for Puck
  const draftDoc = freshTranslation.draftDocument as unknown as Data;
  const initialData: Data = draftDoc?.content
    ? draftDoc
    : { content: [], root: { props: { title: freshTranslation.title } } };

  return (
    <EditorClient
      availableLocales={SUPPORTED_LOCALES}
      initialData={initialData}
      locale={locale as Locale}
      pageId={pageId}
      pageTranslations={
        freshPage?.translations.map((t) => ({
          locale: t.locale,
          id: t.id,
        })) ?? []
      }
      slug={freshTranslation.slug || page.slug}
      status={page.status}
      title={freshTranslation.title}
      translationId={freshTranslation.id}
      visibility={page.visibility}
    />
  );
}
