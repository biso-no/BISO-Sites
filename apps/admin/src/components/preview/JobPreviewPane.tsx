"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Briefcase, Calendar, Globe, Mail, MapPin, User } from "lucide-react";
import Image from "next/image";
import type { Locale } from "@/components/forms/LocaleTabGroup";

type JobFormSnapshot = {
  status: string;
  type?: string;
  application_deadline?: string;
  start_date?: string;
  contact_name?: string;
  contact_email?: string;
  apply_url?: string;
  image?: string;
  campusName?: string;
  translations?: {
    en?: { title?: string; description?: string };
    no?: { title?: string; description?: string };
  };
};

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function JobPreviewPane({
  data,
  locale,
}: {
  data: JobFormSnapshot;
  locale: Locale;
}) {
  const t = data.translations?.[locale];
  const title = t?.title || (locale === "en" ? "Position Title" : "Stillingstittel");
  const description = t?.description || "";

  return (
    <div className="min-h-full bg-linear-to-b from-slate-50 to-background font-sans">
      {/* Hero */}
      <div className="relative h-40 overflow-hidden bg-slate-200">
        {data.image ? (
          <Image src={data.image} alt={title} fill className="object-cover" sizes="800px" />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-blue-600 to-blue-800" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-5 left-6 right-6">
          {data.type && (
            <Badge className="mb-2 w-fit border-blue-200 bg-blue-50 text-blue-700 text-xs">
              <Briefcase className="mr-1 h-3 w-3" />
              {data.type}
            </Badge>
          )}
          <h1 className="font-bold text-xl text-white leading-tight">{title}</h1>
          {data.campusName && (
            <p className="mt-1 flex items-center gap-1 text-white/80 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              {data.campusName}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Description */}
          <div className="lg:col-span-2">
            {description ? (
              <article
                className="prose prose-sm max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: preview only
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="italic text-muted-foreground text-sm">
                {locale === "en"
                  ? "Job description will appear here…"
                  : "Stillingsbeskrivelse vises her…"}
              </p>
            )}
          </div>

          {/* Sidebar details */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="font-medium text-sm">
                {locale === "en" ? "Details" : "Detaljer"}
              </p>
              {data.application_deadline && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "en" ? "Apply by" : "Søknadsfrist"}
                    </p>
                    <p>{fmtDate(data.application_deadline)}</p>
                  </div>
                </div>
              )}
              {data.start_date && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "en" ? "Start date" : "Startdato"}
                    </p>
                    <p>{fmtDate(data.start_date)}</p>
                  </div>
                </div>
              )}
              {data.contact_name && (
                <div className="flex items-start gap-2 text-sm">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{data.contact_name}</span>
                </div>
              )}
              {data.contact_email && (
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="break-all">{data.contact_email}</span>
                </div>
              )}
              {data.apply_url && (
                <div className="flex items-start gap-2 text-sm">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-primary underline underline-offset-2">
                    {locale === "en" ? "Apply now" : "Søk nå"}
                  </span>
                </div>
              )}
              {!data.application_deadline && !data.contact_name && !data.apply_url && (
                <p className="italic text-muted-foreground text-xs">
                  {locale === "en" ? "Details will appear here" : "Detaljer vises her"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <PreviewWatermark />
    </div>
  );
}

function PreviewWatermark() {
  return (
    <div className="pointer-events-none fixed right-3 top-14 z-50 rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 text-xs font-medium ring-1 ring-amber-200">
      Preview
    </div>
  );
}
