"use client";

import { Status } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { type EventWithTranslations } from "@/lib/types/event";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { use } from "react";
import {
  getLocaleLabel,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin";

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function EventsTable({
  eventsPromise,
}: {
  eventsPromise: Promise<EventWithTranslations[]>;
}) {
  const events = use(eventsPromise);
  const t = useTranslations("adminEvents");

  const cancelledEvents = events.filter(
    (evt) => evt.status === Status.CLOSED
  ).length;

  return (
    <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10 bg-white/88 shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
      <div className="flex items-center justify-between border-primary/10 border-b px-6 py-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg text-primary-100">
            {t("eventList")}
          </h2>
          <p className="text-primary-60 text-sm">
            {t("eventsAcrossCampuses", {
              count: events.length,
              campuses: new Set(
                events.map(
                  (evt) =>
                    (typeof evt.campus === "object"
                      ? evt.campus?.name
                      : evt.campus) ||
                    evt.campus_id ||
                    "Ukjent"
                )
              ).size,
            })}
          </p>
        </div>
        {/* Translation coverage badge was here, but it requires calculating coverage over ALL events, which we have here */}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-primary/5">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                {t("table.event")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                {t("table.status")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                {t("table.language")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                {t("table.campus")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                {t("table.date")}
              </th>
              <th className="px-4 py-3 text-right font-semibold text-primary-70 uppercase tracking-wide">
                {t("table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/10 bg-white/78">
            {events.map((evt) => {
              const refs = evt.translation_refs ?? [];
              const metadata =
                (evt.metadata_parsed as Record<string, unknown> | undefined) ??
                parseJSONSafe<Record<string, unknown>>(evt.metadata);
              const translationLocales = getUniqueLocales(refs);
              const primaryTitle = refs[0]?.title || evt.slug || "Untitled";
              const statusToken = getStatusToken(evt.status);
              const startDate = evt.start_date
                ? new Date(evt.start_date)
                : null;
              const startTime =
                typeof metadata.start_time === "string"
                  ? metadata.start_time
                  : null;

              return (
                <tr className="transition hover:bg-primary/5" key={evt.$id}>
                  <td className="px-4 py-3 font-medium text-primary-100">
                    {primaryTitle}
                    <span className="block text-primary-50 text-xs">
                      {evt.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={`rounded-full px-3 py-0.5 font-semibold text-[11px] uppercase tracking-wide ${statusToken.className}`}
                    >
                      {statusToken.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {translationLocales.length ? (
                        translationLocales.map((locale) => (
                          <span
                            className="inline-flex items-center rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5 font-semibold text-[11px] text-primary-70"
                            key={`${evt.$id}-${locale}`}
                          >
                            {getLocaleLabel(locale)}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 font-semibold text-[11px] text-destructive">
                          {t("table.missing")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-primary-80">
                    {typeof evt.campus === "object"
                      ? evt.campus?.name
                      : evt.campus || evt.campus_id || "—"}
                  </td>
                  <td className="px-4 py-3 text-primary-80">
                    {startDate ? (
                      <div>
                        {DATE_FORMATTER.format(startDate)}
                        {startTime && (
                          <span className="block text-[11px] text-primary-50 uppercase tracking-wide">
                            {startTime}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        asChild
                        className="rounded-full px-3 py-1 font-semibold text-primary-80 text-xs hover:bg-primary/10"
                        size="sm"
                        variant="ghost"
                      >
                        <Link href={`/events/${evt.$id}`}>
                          {t("table.edit")}
                        </Link>
                      </Button>
                      <Button
                        asChild
                        className="rounded-full px-3 py-1 font-semibold text-primary-70 text-xs hover:bg-primary/10"
                        size="sm"
                        variant="ghost"
                      >
                        <Link href={`/alumni/events/${evt.$id}`}>
                          {t("table.preview")}
                        </Link>
                      </Button>
                      <Button
                        asChild
                        className="rounded-full px-3 py-1 font-semibold text-primary-70 text-xs hover:bg-primary/10"
                        size="sm"
                        variant="ghost"
                      >
                        <Link href={`/events/new?duplicate=${evt.$id}`}>
                          {t("table.duplicate")}
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-primary/10 border-t bg-primary/5 px-6 py-3 text-primary-60 text-xs uppercase tracking-[0.2em]">
        {t("cancelledInArchive", { count: cancelledEvents })}
      </div>
    </div>
  );
}
