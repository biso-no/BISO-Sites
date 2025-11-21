import { Status } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listEvents } from "@/app/actions/events";
import { AdminSummary } from "@/components/admin/admin-summary";
import {
  formatPercentage,
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

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations("adminEvents");
  const params = await searchParams;
  const campus = params.campus;
  const status = params.status || "all";
  const search = params.q;

  const events = await listEvents({ campus, status, search, limit: 200 });
  const totalEvents = events.length;
  const publishedEvents = events.filter(
    (evt) => evt.status === Status.PUBLISHED
  ).length;
  const draftEvents = events.filter(
    (evt) => evt.status === Status.DRAFT
  ).length;
  const cancelledEvents = events.filter(
    (evt) => evt.status === Status.CLOSED
  ).length;
  const translationCoverage = formatPercentage(
    events.filter((evt) => {
      const refs = evt.translation_refs ?? [];
      const locales = refs.map((ref: any) => ref.locale);
      return locales.includes("no") && locales.includes("en");
    }).length,
    totalEvents
  );

  const summaryCards = [
    {
      label: t("metrics.activeEvents"),
      value: totalEvents,
      description: t("metrics.totalRegistered"),
    },
    {
      label: t("metrics.published"),
      value: publishedEvents,
      description: t("metrics.visibleToMembers"),
    },
    {
      label: t("metrics.drafts"),
      value: draftEvents,
      description: t("metrics.forReview"),
    },
    {
      label: t("metrics.translations"),
      value: translationCoverage,
      description: t("metrics.translationComplete"),
    },
  ];

  return (
    <div className="space-y-8">
      <AdminSummary
        badge={t("badge")}
        title={t("workbenchTitle")}
        description={t("workbenchDescription")}
        metrics={summaryCards.map((card) => ({
          label: card.label,
          value: card.value,
          hint: card.description,
        }))}
        action={
          <Button
            asChild
            className="rounded-full bg-primary-40 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_-30px_rgba(0,23,49,0.55)] hover:bg-primary-30"
          >
            <Link href="/admin/events/new">{t("newEvent")}</Link>
          </Button>
        }
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.5)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary-100">
            {t("filterTitle")}
          </CardTitle>
          <CardDescription className="text-sm text-primary-60">
            {t("filterDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5">
            <Input
              defaultValue={search || ""}
              name="q"
              placeholder={t("searchPlaceholder")}
              className="rounded-xl border-primary/20 bg-white/70 text-sm focus-visible:ring-primary-40 md:col-span-2"
            />
            <Select name="status" defaultValue={status}>
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70">
                <SelectValue placeholder={t("filters.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                <SelectItem value="draft">{t("filters.draft")}</SelectItem>
                <SelectItem value="published">
                  {t("filters.published")}
                </SelectItem>
                <SelectItem value="cancelled">
                  {t("filters.cancelled")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              name="campus"
              defaultValue={campus || ""}
              placeholder={t("filters.campus")}
              className="rounded-xl border-primary/20 bg-white/70 text-sm focus-visible:ring-primary-40"
            />
            <Button
              type="submit"
              className="w-full rounded-xl bg-primary-40 text-sm font-semibold text-white shadow"
            >
              {t("filters.filter")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10 bg-white/88 shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
        <div className="flex items-center justify-between border-b border-primary/10 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-100">
              {t("eventList")}
            </h2>
            <p className="text-sm text-primary-60">
              {t("eventsAcrossCampuses", {
                count: totalEvents,
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
          <Badge
            variant="outline"
            className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-80"
          >
            {translationCoverage} {t("translated")}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.event")}
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.status")}
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.language")}
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.campus")}
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.date")}
                </th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10 bg-white/78">
              {events.map((evt) => {
                const refs = evt.translation_refs ?? [];
                const metadata =
                  (evt.metadata_parsed as
                    | Record<string, unknown>
                    | undefined) ??
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
                  <tr key={evt.$id} className="transition hover:bg-primary/5">
                    <td className="px-4 py-3 font-medium text-primary-100">
                      {primaryTitle}
                      <span className="block text-xs text-primary-50">
                        {evt.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusToken.className}`}
                      >
                        {statusToken.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {translationLocales.length ? (
                          translationLocales.map((locale) => (
                            <span
                              key={`${evt.$id}-${locale}`}
                              className="inline-flex items-center rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary-70"
                            >
                              {getLocaleLabel(locale)}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
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
                            <span className="block text-[11px] uppercase tracking-wide text-primary-50">
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
                          variant="ghost"
                          size="sm"
                          className="rounded-full px-3 py-1 text-xs font-semibold text-primary-80 hover:bg-primary/10"
                        >
                          <Link href={`/admin/events/${evt.$id}`}>
                            {t("table.edit")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="rounded-full px-3 py-1 text-xs font-semibold text-primary-70 hover:bg-primary/10"
                        >
                          <Link href={`/alumni/events/${evt.$id}`}>
                            {t("table.preview")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="rounded-full px-3 py-1 text-xs font-semibold text-primary-70 hover:bg-primary/10"
                        >
                          <Link href={`/admin/events/new?duplicate=${evt.$id}`}>
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
        <div className="border-t border-primary/10 bg-primary/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-primary-60">
          {t("cancelledInArchive", { count: cancelledEvents })}
        </div>
      </div>
    </div>
  );
}
