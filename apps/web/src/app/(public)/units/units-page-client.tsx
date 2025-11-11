"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Sparkles, Users, Layers, Compass } from "lucide-react"

import { useCampus } from "@/components/context/campus"
import { Button } from "@repo/ui/components/ui/button"
import { Card } from "@repo/ui/components/ui/card"
import { Input } from "@repo/ui/components/ui/input"
import { Badge } from "@repo/ui/components/ui/badge"
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area"
import { Switch } from "@repo/ui/components/ui/switch"
import type { Departments } from "@repo/api/types/appwrite"
import { cn } from '@repo/ui/lib/utils'

const stripHtml = (value?: string) => (value ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "")

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left shadow-glow">
    <div className="text-xl font-semibold text-white">{value}</div>
    <div className="text-xs uppercase tracking-wide text-white/70">{label}</div>
  </div>
)

type InitialFilters = {
  campusId: string | null
  type: string | null
  search: string
  showInactive: boolean
}

type UnitsPageClientProps = {
  departments: Departments[]
  initialFilters: InitialFilters
}

const LOGO_PLACEHOLDER = "/images/placeholder.jpg"

export const UnitsPageClient = ({ departments, initialFilters }: UnitsPageClientProps) => {
  const { campuses, activeCampus, activeCampusId, selectCampus, loading } = useCampus()

  const [searchTerm, setSearchTerm] = useState(initialFilters.search)
  const [selectedType, setSelectedType] = useState<string | null>(initialFilters.type)
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(initialFilters.campusId)

  useEffect(() => {
    if (initialFilters.campusId) return
    setSelectedCampusId(activeCampusId ?? null)
  }, [activeCampusId, initialFilters.campusId])

  useEffect(() => {
    if (initialFilters.campusId) {
      selectCampus(initialFilters.campusId)
    }
  }, [initialFilters.campusId, selectCampus])

  const handleCampusSelect = (value: string | null) => {
    setSelectedCampusId(value)
    selectCampus(value)
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) => {
      if (selectedCampusId && dept.campus_id !== selectedCampusId) return false
      if (selectedType && dept.type !== selectedType) return false

      if (normalizedSearch) {
        const haystack = [
          dept.Name,
          dept.type,
          dept.campus.name,
          stripHtml(dept.description ?? "")
        ]
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(normalizedSearch)) {
          return false
        }
      }

      return true
    })
  }, [departments, selectedCampusId, selectedType, normalizedSearch])

  const totalActive = useMemo(
    () => departments.filter((dept) => dept.active !== false).length,
    [departments]
  )

  const uniqueCampuses = useMemo(
    () => new Set(departments.map((dept) => dept.campus_id)).size,
    [departments]
  )

  const uniqueTypes = useMemo(
    () => new Set(departments.map((dept) => dept.type).filter(Boolean)).size,
    [departments]
  )

  const stats = [
    { label: "Aktive enheter", value: totalActive || "--" },
    { label: "Campuser", value: uniqueCampuses || "--" },
    { label: "Fagområder", value: uniqueTypes || "--" }
  ]

  const selectedCampus = selectedCampusId
    ? campuses.find((campus) => campus.$id === selectedCampusId)
    : null

  const sortedDepartments = useMemo(() => {
    return [...filteredDepartments].sort((a, b) => {
      const campusCompare = (a.campus.name || "").localeCompare(b.campus.name || "")
      if (campusCompare !== 0) return campusCompare
      return a.Name.localeCompare(b.Name)
    })
  }, [filteredDepartments])

  return (
    <div className="space-y-16 text-primary-100">
      <section className="relative overflow-hidden rounded-[40px] border border-primary/10 bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.3),transparent_55%)]" />
        <div className="relative grid gap-10 px-6 py-12 md:px-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:py-16 xl:px-14">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              {selectedCampus ? `${selectedCampus.name} - Enheter` : "BISO enheter"}
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-white md:text-5xl">
              {selectedCampus ? `Teamene som driver ${selectedCampus.name}` : "Finn enheten som matcher dine ambisjoner"}
            </h1>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">
              Utforsk studentdrevne enheter innen alt fra festivaler og finans til politikk og velferd. Filtrer etter campus og interesser for å finne hvor du vil bidra.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-primary-100 hover:bg-white/90">
                <Link href="/jobs">Se ledige verv</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="glass"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href="/membership">Bli medlem</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
                <Link href="/campus">Utforsk campuser</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 pt-4">
              {stats.map((stat) => (
                <StatPill key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-[32px] border border-white/20 bg-white/10 p-8 shadow-glow">
            <div>
              <h2 className="text-xl font-semibold text-white">Hvorfor bli med i en enhet?</h2>
              <p className="mt-2 text-sm text-white/70">
                Få praktisk erfaring, skap nye fellesskap og få en tydelig stemme i studentmiljøet.
              </p>
            </div>
            <ul className="space-y-4 text-sm text-white/85">
              <li className="flex gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-gold-default" />
                <span className="text-white/80">Bygg nettverk på tvers av studieprogram og campus</span>
              </li>
              <li className="flex gap-3">
                <Layers className="mt-0.5 h-4 w-4 shrink-0 text-gold-default" />
                <span className="text-white/80">Velg blant faglige, sosiale og kommersielle prosjekter</span>
              </li>
              <li className="flex gap-3">
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-gold-default" />
                <span className="text-white/80">Få støtte og veiledning fra erfarne styremedlemmer</span>
              </li>
            </ul>
            <div className="relative h-32 w-full overflow-hidden rounded-2xl border border-white/20">
              <Image src={LOGO_PLACEHOLDER} alt="BISO students" fill className="object-cover" />
              <div className="absolute inset-0 bg-linear-to-t from-blue-strong/70 via-blue-strong/10 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-primary-100">Filtrer etter ditt engasjement</h2>
            <p className="text-sm text-muted-foreground">
              Kombiner campus, fagområde og søk for å finne akkurat den enheten du leter etter.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary-40" />
              {sortedDepartments.length} enheter
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:items-start">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Søk etter navn, nøkkelord eller campus"
                  className="h-12 rounded-2xl border-primary/10 bg-white/90 pl-11 text-sm"
                />
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-60" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  selectedType === null
                    ? "border-primary-40 bg-primary-10 text-primary-80"
                    : "border-primary/15 bg-white/90 text-primary-70 hover:border-primary/30 hover:text-primary-40"
                )}
              >
                Alle fagområder
              </button>
              {departments.map((dept) => (
                <button
                  key={dept.$id}
                  type="button"
                  onClick={() => setSelectedType(dept.type)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    selectedType === dept.type
                      ? "border-primary-40 bg-primary-10 text-primary-80"
                      : "border-primary/15 bg-white/90 text-primary-70 hover:border-primary/30 hover:text-primary-40"
                  )}
                >
                  {dept.type}
                </button>
              ))}
            </div>
          </div>


        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-primary-100">Enheter</h2>
            <p className="text-sm text-muted-foreground">
              {sortedDepartments.length
                ? `Viser ${sortedDepartments.length} enheter`
                : "Ingen enheter matcher filtrene dine akkurat nå."}
            </p>
          </div>
          <Button
            variant="ghost"
            className="text-primary-40"
            onClick={() => {
              setSearchTerm(initialFilters.search)
              setSelectedType(initialFilters.type)
              handleCampusSelect(initialFilters.campusId ?? activeCampusId ?? null)
            }}
          >
            Tilbakestill filtre
          </Button>
        </div>

        {sortedDepartments.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sortedDepartments.map((dept) => {
              const isActive = dept.active !== false
              const plainDescription = stripHtml(dept.description ?? "")
              return (
                <Card
                  key={dept.$id}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-primary/10 bg-white/90 p-6 shadow-card-hover transition hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl"
                >
                  <div className="absolute inset-x-12 top-0 h-1 rounded-b-full bg-linear-to-r from-blue-accent via-gold-default to-blue-accent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 overflow-hidden rounded-full border border-primary/10 bg-primary-10">
                        {dept.logo ? (
                          <Image src={dept.logo} alt={dept.Name} fill className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary-70">
                            {dept.Name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-primary-100">{dept.Name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{dept.campus.name || "Ukjent campus"}</span>
                          {dept.type ? <span>- {dept.type}</span> : null}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={isActive ? "gold" : "outline"}
                      className={cn(
                        "text-[11px] uppercase tracking-wide",
                        isActive ? "text-primary-100" : "border-primary/30 text-primary-50"
                      )}
                    >
                      {isActive ? "Aktiv" : "Pause"}
                    </Badge>
                  </div>

                  <div className="mt-4 flex-1 text-sm text-muted-foreground">
                    {plainDescription ? (
                      <p className="line-clamp-4 leading-relaxed">{plainDescription}</p>
                    ) : (
                      <p className="leading-relaxed">
                        Denne enheten oppdaterer sin profil. Ta kontakt med campusstyret for å høre hvordan du kan bidra.
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-primary/10 pt-4 text-sm text-primary-60">
                    <Button asChild variant="link" className="px-0 text-primary-40">
                      <Link href="/contact">Kontakt</Link>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-primary/20 p-10 text-center text-sm text-muted-foreground">
            Fant ingen enheter med disse filtrene. Juster søket ditt eller velg en annen campus.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-primary/10 bg-primary-10/40 p-8 shadow-inner">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-primary-100">Vil du starte noe nytt?</h2>
            <p className="text-sm text-muted-foreground">
              Har du en idé til en enhet, et prosjekt eller et tilbud studentene trenger? BISO støtter deg med erfaring, rammer og finansiering for å få det til.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="gradient">
                <Link href="/contact">Snakk med Campusledelsen</Link>
              </Button>

            </div>
          </div>
          <div className="relative h-48 w-full overflow-hidden rounded-3xl border border-primary/10">
            <Image src={LOGO_PLACEHOLDER} alt="Skap noe nytt" fill className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-primary-100/40 via-primary-100/10 to-transparent" />
          </div>
        </div>
      </section>
    </div>
  )
}
