"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { format } from "date-fns";
import { enUS, nb } from "date-fns/locale";
import { Calendar, Clock, MapPin, Tag, Ticket, Users } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import type { Locale } from "@/components/forms/LocaleTabGroup";

type EventFormSnapshot = {
  status: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  price?: number;
  ticket_url?: string;
  member_only?: boolean;
  metadata?: { start_time?: string; end_time?: string; images?: string[] };
  image?: string;
  translations: {
    en: { title: string; description: string };
    no: { title: string; description: string };
  };
};

function fmtDate(d: string, locale: Locale) {
  try {
    return format(new Date(d), "MMMM d, yyyy", {
      locale: locale === "no" ? nb : enUS,
    });
  } catch {
    return d;
  }
}

function fmtPrice(n: number) {
  if (n === 0) return "Free";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
  }).format(n);
}

export function EventPreviewPane({
  data,
  locale,
}: {
  data: EventFormSnapshot;
  locale: Locale;
}) {
  const t = data.translations[locale];
  const imageUrl = data.metadata?.images?.[0] ?? data.image ?? "";
  const title = t.title || (locale === "en" ? "Event Title" : "Arrangementstittel");

  const plainDescription = useMemo(() => {
    if (!t.description) return "";
    if (typeof window === "undefined") return t.description;
    const div = document.createElement("div");
    div.innerHTML = t.description;
    return div.textContent ?? "";
  }, [t.description]);

  const startFmt = data.start_date ? fmtDate(data.start_date, locale) : null;
  const startTime = data.metadata?.start_time ?? "";
  const endTime = data.metadata?.end_time ?? "";
  const timeRange = startTime
    ? endTime
      ? `${startTime} – ${endTime}`
      : startTime
    : "";

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-background font-sans">
      {/* Hero */}
      <div className="relative h-56 overflow-hidden bg-slate-200">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover" sizes="800px" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-300 to-slate-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/30 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-6">
          {data.status !== "published" && (
            <Badge variant="secondary" className="mb-2 w-fit uppercase text-xs">
              {data.status}
            </Badge>
          )}
          {data.member_only && (
            <Badge className="mb-2 w-fit border-blue-300 bg-blue-50 text-blue-700">
              <Users className="mr-1 h-3 w-3" />
              {locale === "en" ? "Members Only" : "Kun medlemmer"}
            </Badge>
          )}
          <h1 className="font-bold text-2xl text-white leading-tight">{title}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-white/80 text-sm">
            {startFmt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {startFmt}
              </span>
            )}
            {timeRange && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {timeRange}
              </span>
            )}
            {data.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {data.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-5 lg:col-span-2">
            {t.description ? (
              <article
                className="prose prose-sm max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: preview only
                dangerouslySetInnerHTML={{ __html: t.description }}
              />
            ) : (
              <p className="italic text-muted-foreground text-sm">
                {locale === "en" ? "No description yet…" : "Ingen beskrivelse ennå…"}
              </p>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Price card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {data.price !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    {locale === "en" ? "Price" : "Pris"}
                  </span>
                  <span className="font-semibold text-lg">{fmtPrice(data.price)}</span>
                </div>
              )}
              {data.ticket_url && (
                <div className="flex items-center gap-2 text-primary text-sm">
                  <Ticket className="h-4 w-4" />
                  <span className="underline underline-offset-2">
                    {locale === "en" ? "Get tickets" : "Kjøp billetter"}
                  </span>
                </div>
              )}
              {!data.price && !data.ticket_url && (
                <p className="text-muted-foreground text-xs italic">
                  {locale === "en" ? "No ticket info yet" : "Ingen billettinfo ennå"}
                </p>
              )}
            </div>

            {/* Details */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="font-medium text-sm">
                {locale === "en" ? "Event details" : "Detaljer"}
              </p>
              {data.location && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{data.location}</span>
                </div>
              )}
              {startFmt && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{startFmt}{timeRange ? `, ${timeRange}` : ""}</span>
                </div>
              )}
              {!data.location && !startFmt && (
                <p className="text-muted-foreground text-xs italic">
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
