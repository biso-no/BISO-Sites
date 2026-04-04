"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Briefcase, Calendar, Globe, Mail, MapPin, User } from "lucide-react";
import Image from "next/image";
import type { Locale } from "@/components/forms/locale-tab-group";

interface JobFormSnapshot {
  application_deadline?: string;
  apply_url?: string;
  campusName?: string;
  contact_email?: string;
  contact_name?: string;
  image?: string;
  start_date?: string;
  status: string;
  translations?: {
    en?: { title?: string; description?: string };
    no?: { title?: string; description?: string };
  };
  type?: string;
}

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

function JobHero({ data, title }: { data: JobFormSnapshot; title: string }) {
  return (
    <div className="relative h-40 overflow-hidden bg-slate-200">
      {data.image ? (
        <Image
          alt={title}
          className="object-cover"
          fill
          sizes="800px"
          src={data.image}
        />
      ) : (
        <div className="h-full w-full bg-linear-to-br from-blue-600 to-blue-800" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
      <div className="absolute right-6 bottom-5 left-6">
        {data.type && (
          <Badge className="mb-2 w-fit border-blue-200 bg-blue-50 text-blue-700 text-xs">
            <Briefcase className="mr-1 h-3 w-3" />
            {data.type}
          </Badge>
        )}
        <h1 className="font-bold text-white text-xl leading-tight">{title}</h1>
        {data.campusName && (
          <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
            <MapPin className="h-3.5 w-3.5" />
            {data.campusName}
          </p>
        )}
      </div>
    </div>
  );
}

function JobDetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon}
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p>{value}</p>
      </div>
    </div>
  );
}

function JobSidebar({
  data,
  locale,
}: {
  data: JobFormSnapshot;
  locale: Locale;
}) {
  const hasDetails =
    data.application_deadline || data.contact_name || data.apply_url;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="font-medium text-sm">
          {locale === "en" ? "Details" : "Detaljer"}
        </p>
        {data.application_deadline && (
          <JobDetailRow
            icon={
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            }
            label={locale === "en" ? "Apply by" : "Søknadsfrist"}
            value={fmtDate(data.application_deadline)}
          />
        )}
        {data.start_date && (
          <JobDetailRow
            icon={
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            }
            label={locale === "en" ? "Start date" : "Startdato"}
            value={fmtDate(data.start_date)}
          />
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
        {!hasDetails && (
          <p className="text-muted-foreground text-xs italic">
            {locale === "en"
              ? "Details will appear here"
              : "Detaljer vises her"}
          </p>
        )}
      </div>
    </div>
  );
}

export function JobPreviewPane({
  data,
  locale,
}: {
  data: JobFormSnapshot;
  locale: Locale;
}) {
  const t = data.translations?.[locale];
  const title =
    t?.title || (locale === "en" ? "Position Title" : "Stillingstittel");
  const description = t?.description || "";

  return (
    <div className="min-h-full bg-linear-to-b from-slate-50 to-background font-sans">
      <JobHero data={data} title={title} />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {description ? (
              <article
                className="prose prose-sm max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: preview only
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="text-muted-foreground text-sm italic">
                {locale === "en"
                  ? "Job description will appear here…"
                  : "Stillingsbeskrivelse vises her…"}
              </p>
            )}
          </div>

          <JobSidebar data={data} locale={locale} />
        </div>
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
