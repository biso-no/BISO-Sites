"use client";

import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import { type Data, PageEditor } from "@repo/editor";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ensureTranslation,
  publishPage,
  savePageDraft,
} from "@/app/actions/pages";

type EditorClientProps = {
  pageId: string;
  translationId: string;
  initialData: Data;
  title: string;
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
    metadata: { title: string; slug: string }
  ) => {
    await savePageDraft({
      translationId,
      draftDocument: data,
      title: metadata.title,
      slug: metadata.slug,
    });
  };

  const handlePublish = async (
    data: Data,
    metadata: { title: string; slug: string }
  ) => {
    await publishPage({
      translationId,
      document: data,
      title: metadata.title,
      slug: metadata.slug,
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
    } else {
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
    }
  };

  return (
    <PageEditor
      availableLocales={availableLocales}
      initialData={initialData}
      locale={locale}
      onBack={() => router.back()}
      onLocaleChange={(newLocale) => handleLocaleChange(newLocale, { title, slug })}
      onPublish={handlePublish}
      onSave={handleSave}
      slug={slug}
      status={status}
      title={title}
      visibility={visibility}
    />
  );
}
