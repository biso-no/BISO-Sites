"use client";

import { format } from "date-fns";
import { enUS, nb } from "date-fns/locale";
import Image from "next/image";
import type { Locale } from "@/components/forms/LocaleTabGroup";

type NewsFormSnapshot = {
  status: string;
  image?: string;
  author?: string;
  sticky?: boolean;
  translations: {
    en: { title: string; description: string };
    no: { title: string; description: string };
  };
  campusName?: string;
  departmentName?: string;
};

export function NewsPreviewPane({
  data,
  locale,
}: {
  data: NewsFormSnapshot;
  locale: Locale;
}) {
  const t = data.translations[locale];
  const title = t.title || (locale === "en" ? "Post Title" : "Tittel");
  const now = new Date();
  const dateStr = format(now, "MMMM d, yyyy", {
    locale: locale === "no" ? nb : enUS,
  });

  const meta = [dateStr, data.campusName, data.departmentName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-full bg-background font-sans">
      {/* Page header */}
      <div className="border-border/40 border-b bg-muted/20 px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-muted-foreground text-xs">
          <span>Home</span>
          <span>/</span>
          <span>News</span>
          <span>/</span>
          <span className="text-foreground">{title}</span>
        </nav>

        <h1 className="font-bold text-2xl leading-snug tracking-tight">
          {title}
        </h1>
        {meta && <p className="mt-2 text-muted-foreground text-sm">{meta}</p>}

        {data.sticky && (
          <span className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-700 text-xs">
            📌 {locale === "en" ? "Pinned" : "Festet"}
          </span>
        )}
      </div>

      {/* Cover image */}
      {data.image && (
        <div className="relative mx-6 mt-6 h-56 overflow-hidden rounded-xl bg-muted">
          <Image
            alt={title}
            className="object-cover"
            fill
            sizes="800px"
            src={data.image}
          />
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        {t.description ? (
          <article
            className="prose prose-sm dark:prose-invert max-w-none"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: preview only
            dangerouslySetInnerHTML={{ __html: t.description }}
          />
        ) : (
          <p className="text-muted-foreground text-sm italic">
            {locale === "en"
              ? "Start writing your article…"
              : "Begynn å skrive artikkelen din…"}
          </p>
        )}
      </div>

      <PreviewWatermark />
    </div>
  );
}

function PreviewWatermark() {
  return (
    <div className="pointer-events-none fixed top-14 right-3 z-50 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700 text-xs ring-1 ring-amber-200">
      Preview
    </div>
  );
}
