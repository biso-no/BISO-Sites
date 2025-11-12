import Link from "next/link"
import { Calendar } from "lucide-react"

import { listJobs } from "@/app/actions/jobs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatPercentage,
  getLocaleLabel,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin"
import { AdminSummary } from "@/components/admin/admin-summary"

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const status = params.status || "all"
  const campus = params.campus
  const q = params.q

  const jobs = await listJobs({ limit: 200, status, campus, search: q })
  const totalJobs = jobs.length
  const publishedJobs = jobs.filter((job) => job.status === "published").length
  const draftJobs = jobs.filter((job) => job.status === "draft").length
  const closedJobs = jobs.filter((job) => job.status === "closed").length
  const translationCoverage = formatPercentage(
    jobs.filter((job) => {
      const refs = job.translation_refs ?? []
      const locales = refs.map((ref: any) => ref.locale)
      return locales.includes("no") && locales.includes("en")
    }).length,
    totalJobs
  )

  const summaryCards = [
    { label: "Aktive stillinger", value: totalJobs, description: "Total i katalogen" },
    { label: "Publiserte", value: publishedJobs, description: "Synlig for studenter" },
    { label: "Utkast", value: draftJobs, description: "Klar for gjennomgang" },
    { label: "Oversatt", value: translationCoverage, description: "NO + EN komplett" },
  ]

  return (
    <div className="space-y-8">
      <AdminSummary
        badge="Rekruttering"
        title="Jobboard"
        description="Følg status, campus og språk for frivillige verv og stillinger."
        metrics={summaryCards.map((card) => ({
          label: card.label,
          value: card.value,
          hint: card.description,
        }))}
        action={
          <Button asChild className="rounded-full bg-primary-40 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_-30px_rgba(0,23,49,0.65)] hover:bg-primary-30">
            <Link href="/admin/jobs/new">Opprett ny stilling</Link>
          </Button>
        }
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.5)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary-100">Filtrer jobber</CardTitle>
          <CardDescription className="text-sm text-primary-60">
            Kombiner tekstsøk, campus og status for å snevre inn resultatene.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5">
            <Input
              defaultValue={q || ""}
              name="q"
              placeholder="Søk på tittel eller slug..."
              className="rounded-xl border-primary/20 bg-white/70 text-sm focus-visible:ring-primary-40 md:col-span-2"
            />
            <Select name="status" defaultValue={status}>
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="published">Publisert</SelectItem>
                <SelectItem value="draft">Utkast</SelectItem>
                <SelectItem value="closed">Lukket</SelectItem>
              </SelectContent>
            </Select>
            <Input
              name="campus"
              defaultValue={campus || ""}
              placeholder="Campus"
              className="rounded-xl border-primary/20 bg-white/70 text-sm focus-visible:ring-primary-40"
            />
            <Button type="submit" className="w-full rounded-xl bg-primary-40 text-sm font-semibold text-white shadow">
              Filtrer
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10 bg-white/85 shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
        <div className="flex items-center justify-between border-b border-primary/10 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-100">Stillingsoversikt</h2>
            <p className="text-sm text-primary-60">
              {totalJobs}stillinger på tvers av {new Set(jobs.map((job) => job.campus?.name || job.campus_id || "Ukjent")).size} campuser
            </p>
          </div>
          <Badge variant="outline" className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-70">
            {translationCoverage} oversatt
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Tittel</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Status</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Språk</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Campus</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Frist</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-primary-70">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10 bg-white/80">
              {jobs.map((job) => {
                const translationLocales = getUniqueLocales(job.translation_refs)
                const primaryTitle = job.translation_refs?.[0]?.title || job.slug
                const metadata = parseJSONSafe<Record<string, unknown>>(job.metadata)
                const statusToken = getStatusToken(job.status)
                const deadline = metadata.application_deadline
                  ? new Date(metadata.application_deadline)
                  : null

                return (
                  <tr key={job.$id} className="transition hover:bg-primary/5">
                    <td className="px-4 py-3 font-medium text-primary-100">
                      {primaryTitle}
                      <span className="block text-xs text-primary-50">{job.slug}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusToken.className}`}>
                        {statusToken.label}
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
                            Mangler
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-primary-80">{job.campus?.name || job.campus_id || "—"}</td>
                    <td className="px-4 py-3 text-primary-80">
                      {deadline ? (
                        <>
                          {deadline.toLocaleDateString("nb-NO")}
                          <span className="block text-[11px] uppercase tracking-wide text-primary-50">
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {deadline.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm" className="rounded-full px-3 py-1 text-xs font-semibold text-primary-80 hover:bg-primary/10">
                        <Link href={`/admin/jobs/${job.$id}`}>Rediger</Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-primary/10 bg-primary/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-primary-60">
          {closedJobs} lukkede stillinger i arkivet
        </div>
      </div>
    </div>
  )
}
