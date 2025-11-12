import Link from "next/link"

import { listEvents } from "@/app/actions/events"
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
import { AdminSummary } from "@/components/admin/admin-summary"
import {
  formatPercentage,
  getLocaleLabel,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin"

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const campus = params.campus
  const status = params.status || "all"
  const search = params.q

  const events = await listEvents({ campus, status, search, limit: 200 })
  const totalEvents = events.length
  const publishedEvents = events.filter((evt) => evt.status === "published").length
  const draftEvents = events.filter((evt) => evt.status === "draft").length
  const cancelledEvents = events.filter((evt) => evt.status === "cancelled").length
  const translationCoverage = formatPercentage(
    events.filter((evt) => {
      const refs = evt.translation_refs ?? []
      const locales = refs.map((ref: any) => ref.locale)
      return locales.includes("no") && locales.includes("en")
    }).length,
    totalEvents
  )

  const summaryCards = [
    { label: "Aktive arrangementer", value: totalEvents, description: "Totalt registrert" },
    { label: "Publiserte", value: publishedEvents, description: "Synlig for medlemmer" },
    { label: "Utkast", value: draftEvents, description: "Til gjennomgang" },
    { label: "Oversettelser", value: translationCoverage, description: "NO + EN ferdig" },
  ]

  return (
    <div className="space-y-8">
      <AdminSummary
        badge="Arrangementer"
        title="Event workbench"
        description="Koordiner arrangementer på tvers av campus med språk, status og tilgjengelighet."
        metrics={summaryCards.map((card) => ({
          label: card.label,
          value: card.value,
          hint: card.description,
        }))}
        action={
          <Button asChild className="rounded-full bg-primary-40 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_-30px_rgba(0,23,49,0.55)] hover:bg-primary-30">
            <Link href="/admin/events/new">Ny event</Link>
          </Button>
        }
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.5)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary-100">Filtrer arrangementer</CardTitle>
          <CardDescription className="text-sm text-primary-60">
            Avgrens visningen etter status, campus eller søkeord.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5">
            <Input
              defaultValue={search || ""}
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
                <SelectItem value="draft">Utkast</SelectItem>
                <SelectItem value="published">Publisert</SelectItem>
                <SelectItem value="cancelled">Avlyst</SelectItem>
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

      <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10 bg-white/88 shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
        <div className="flex items-center justify-between border-b border-primary/10 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-100">Eventliste</h2>
            <p className="text-sm text-primary-60">
              {totalEvents} arrangementer over {new Set(events.map((evt) => evt.campus?.name || evt.campus_id || "Ukjent")).size} campuser
            </p>
          </div>
          <Badge variant="outline" className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-80">
            {translationCoverage} oversatt
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Event</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Status</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Språk</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Campus</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Dato</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-primary-70">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10 bg-white/78">
              {events.map((evt) => {
                const refs = evt.translation_refs ?? []
                const metadata = parseJSONSafe<Record<string, unknown>>(evt.metadata)
                const translationLocales = getUniqueLocales(refs)
                const primaryTitle = refs[0]?.title || evt.slug || "Untitled"
                const statusToken = getStatusToken(evt.status)
                const startDate = metadata.start_date ? new Date(metadata.start_date) : null

                return (
                  <tr key={evt.$id} className="transition hover:bg-primary/5">
                    <td className="px-4 py-3 font-medium text-primary-100">
                      {primaryTitle}
                      <span className="block text-xs text-primary-50">{evt.slug}</span>
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
                              key={`${evt.$id}-${locale}`}
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
                    <td className="px-4 py-3 text-primary-80">{evt.campus?.name || evt.campus_id || "—"}</td>
                    <td className="px-4 py-3 text-primary-80">
                      {startDate ? (
                        <>
                          {DATE_FORMATTER.format(startDate)}
                          {metadata.start_time && (
                            <span className="block text-[11px] uppercase tracking-wide text-primary-50">
                              {metadata.start_time}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button asChild variant="ghost" size="sm" className="rounded-full px-3 py-1 text-xs font-semibold text-primary-80 hover:bg-primary/10">
                          <Link href={`/admin/events/${evt.$id}`}>Rediger</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="rounded-full px-3 py-1 text-xs font-semibold text-primary-70 hover:bg-primary/10">
                          <Link href={`/alumni/events/${evt.$id}`}>Preview</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="rounded-full px-3 py-1 text-xs font-semibold text-primary-70 hover:bg-primary/10">
                          <Link href={`/admin/events/new?duplicate=${evt.$id}`}>Dupliser</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-primary/10 bg-primary/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-primary-60">
          {cancelledEvents} avlyste arrangementer i arkivet
        </div>
      </div>
    </div>
  )
}
