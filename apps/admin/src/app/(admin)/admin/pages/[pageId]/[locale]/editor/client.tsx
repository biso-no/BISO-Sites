"use client";

import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ensureTranslation,
  publishPage,
  savePageDraft,
  saveTranslatedPage,
} from "@/app/actions/pages";

const PageEditor = dynamic(
  () => import("@repo/editor/editor").then((mod) => mod.PageEditor),
  { ssr: false }
);

type EditorClientProps = {
  pageId: string;
  translationId: string;
  initialData: Data;
  title: string;
  description?: string | null;
  locale: Locale;
  availableLocales: Locale[];
  slug: string;
  status: PageStatus;
  visibility: PageVisibility;
  pageTranslations: { locale: Locale; id: string }[];
};

export function EditorClient({
  pageId,
  translationId,
  initialData,
  title,
  description,
  locale,
  availableLocales,
  slug,
  status,
  visibility,
  pageTranslations,
}: EditorClientProps) {
  const router = useRouter();

  const handleSave = async (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => {
    await savePageDraft({
      translationId,
      draftDocument: data,
      title: metadata.title,
      slug: metadata.slug,
      description: metadata.description,
    });
  };

  const handlePublish = async (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => {
    await publishPage({
      translationId,
      document: data,
      title: metadata.title,
      slug: metadata.slug,
      description: metadata.description,
    });
  };

  const handleLocaleChange = async (
    newLocale: Locale,
    context: { title: string; slug: string }
  ) => {
    if (newLocale === locale) {
      return;
    }

    const existingTranslation = pageTranslations.find(
      (t) => t.locale === newLocale
    );

    if (existingTranslation) {
      router.push(`/admin/pages/${pageId}/${newLocale}/editor`);
      return;
    }

    try {
      await ensureTranslation({
        pageId,
        locale: newLocale,
        title: context.title,
        sourceTranslationId: translationId,
      });
      toast.success(`Created ${newLocale} translation`);
      router.push(`/admin/pages/${pageId}/${newLocale}/editor`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to create ${newLocale} translation`);
    }
  };

  const handleTranslate = async (
    data: Data,
    metadata: { title: string; slug: string; description?: string },
    targetLocale: Locale
  ) => {
    // Call the AI translation API
    const response = await fetch("/api/translate-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageData: data,
        sourceLocale: locale,
        targetLocale,
        title: metadata.title,
        description: metadata.description,
        slug: metadata.slug,
      }),
    });

    if (!response.ok) {
      throw new Error("Translation API failed");
    }

    const result = await response.json();

    // Save the translated page to the target locale
    const { redirectUrl } = await saveTranslatedPage({
      pageId,
      targetLocale,
      translatedData: result.translatedData,
      translatedTitle: result.translatedTitle,
      translatedSlug: result.translatedSlug,
      translatedDescription: result.translatedDescription,
      sourceTranslationId: translationId,
    });

    // Redirect to the translated page editor
    router.push(redirectUrl);
  };

  return (
    <PageEditor
      availableLocales={availableLocales}
      description={description ?? undefined}
      initialData={initialData}
      locale={locale}
      onBack={() => router.back()}
      onLocaleChange={(newLocale) =>
        handleLocaleChange(newLocale, { title, slug })
      }
      onPublish={handlePublish}
      onSave={handleSave}
      onTranslate={handleTranslate}
      slug={slug}
      status={status}
      title={title}
      visibility={visibility}
    />
  );
}
