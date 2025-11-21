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
import { Calendar } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listJobs } from "@/app/actions/jobs";
import { AdminSummary } from "@/components/admin/admin-summary";
import {
  formatPercentage,
  getLocaleLabel,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin";

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("adminJobs");
  const status = params.status || "all";
  const campus = params.campus;
  const q = params.q;

  const jobs = await listJobs({ limit: 200, status, campus, search: q });
  const totalJobs = jobs.length;
  const publishedJobs = jobs.filter((job) => job.status === "published").length;
  const draftJobs = jobs.filter((job) => job.status === "draft").length;
  const closedJobs = jobs.filter((job) => job.status === "closed").length;
  const translationCoverage = formatPercentage(
    jobs.filter((job) => {
      const refs = job.translation_refs ?? [];
      const locales = refs.map((ref: any) => ref.locale);
      return locales.includes("no") && locales.includes("en");
    }).length,
    totalJobs
  );

  const summaryCards = [
    {
      label: t("metrics.activePositions"),
      value: totalJobs,
      description: t("metrics.totalInCatalog"),
    },
    {
      label: t("metrics.published"),
      value: publishedJobs,
      description: t("metrics.visibleToStudents"),
    },
    {
      label: t("metrics.drafts"),
      value: draftJobs,
      description: t("metrics.readyForReview"),
    },
    {
      label: t("metrics.translated"),
      value: translationCoverage,
      description: t("metrics.translationComplete"),
    },
  ];
  const campusCount = new Set(
    jobs.map((job) => job.campus?.name || job.campus_id || "Ukjent")
  ).size;

  return (
    <div className="space-y-8">
      <AdminSummary
        badge={t("badge")}
        title={t("jobboardTitle")}
        description={t("jobboardDescription")}
        metrics={summaryCards.map((card) => ({
          label: card.label,
          value: card.value,
          hint: card.description,
        }))}
        action={
          <Button
            asChild
            className="rounded-full bg-primary-40 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_-30px_rgba(0,23,49,0.65)] hover:bg-primary-30"
          >
            <Link href="/admin/jobs/new">{t("createNew")}</Link>
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
              defaultValue={q || ""}
              name="q"
              placeholder={t("searchPlaceholder")}
              className="rounded-xl border-primary/20 text-sm focus-visible:ring-primary-40 md:col-span-2"
            />
            <Select name="status" defaultValue={status}>
              <SelectTrigger className="rounded-xl border-primary/20">
                <SelectValue placeholder={t("filters.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                <SelectItem value="published">
                  {t("filters.published")}
                </SelectItem>
                <SelectItem value="draft">{t("filters.draft")}</SelectItem>
                <SelectItem value="closed">{t("filters.closed")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              name="campus"
              defaultValue={campus || ""}
              placeholder={t("filters.campus")}
              className="rounded-xl border-primary/20 text-sm focus-visible:ring-primary-40"
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

      <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10  shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
        <div className="flex items-center justify-between border-b border-primary/10 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-100">
              {t("jobOverview")}
            </h2>
            <p className="text-sm text-primary-60">
              {t("positionsAcrossCampuses", {
                count: totalJobs,
                campuses: campusCount,
              })}
            </p>
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-70"
          >
            {translationCoverage} {t("metrics.translated")}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.title")}
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
                  {t("table.deadline")}
                </th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-primary-70">
                  {t("table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10 bg-white/80">
              {jobs.map((job) => {
                const translationLocales = getUniqueLocales(
                  job.translation_refs
                );
                const primaryTitle =
                  job.translation_refs?.[0]?.title || job.slug;
                const metadata =
                  (job.metadata_parsed as
                    | Record<string, unknown>
                    | undefined) ??
                  parseJSONSafe<Record<string, unknown>>(
                    job.metadata as string | null | undefined
                  );
                const statusToken = getStatusToken(job.status);
                const statusLabel =
                  t(`status.${job.status}`) || statusToken.label;
                const deadline = metadata.application_deadline
                  ? new Date(JSON.stringify(metadata.application_deadline))
                  : null;

                return (
                  <tr key={job.$id} className="transition hover:bg-primary/5">
                    <td className="px-4 py-3 font-medium text-primary-100">
                      {primaryTitle}
                      <span className="block text-xs text-primary-50">
                        {job.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusToken.className}`}
                      >
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {translationLocales.length ? (
                          translationLocales.map((locale) => (
                            <span
                              key={`${job.$id}-${locale}`}
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
                      {job.campus?.name || job.campus_id || "—"}
                    </td>
                    <td className="px-4 py-3 text-primary-80">
                      {deadline ? (
                        <>
                          {deadline.toLocaleDateString("nb-NO")}
                          <span className="block text-[11px] uppercase tracking-wide text-primary-50">
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {deadline.toLocaleTimeString("nb-NO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="rounded-full px-3 py-1 text-xs font-semibold text-primary-80 hover:bg-primary/10"
                      >
                        <Link href={`/admin/jobs/${job.$id}`}>
                          {t("table.edit")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-primary/10 bg-primary/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-primary-60">
          {t("closedInArchive", { count: closedJobs })}
        </div>
      </div>
    </div>
  );
}
