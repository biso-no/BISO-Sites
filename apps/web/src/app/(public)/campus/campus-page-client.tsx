"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { CalendarDays, BriefcaseBusiness, Newspaper, ArrowUpRight, Sparkles, GraduationCap, Handshake, Users, ShieldCheck, MapPin, Mail, Phone, Building2, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useCampus } from "@/components/context/campus"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Badge } from "@repo/ui/components/ui/badge"
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area"
import { cn, formatDateReadable, getInitials } from '@repo/ui/lib/utils'
import type { Event } from "@/lib/types/event"
import type { Job } from "@/lib/types/job"
import type { NewsItem } from "@/lib/types/alumni"
import type { Department as DepartmentRecord } from "@/lib/admin/departments"
import type { CampusData } from "@/lib/types/campus-data"
import type { Locale } from "@/i18n/config"
import type { CampusMetadata } from "@/app/actions/campus"
import { NewsItemWithTranslations } from "@/lib/types/news"

type CampusLeader = {
  name: string
  email?: string
  phone?: string
  role?: string
  officeLocation?: string
  profilePhotoUrl?: string
}

type CampusLocation = {
  address?: string
  email?: string
  phone?: string
}

type BenefitConfig = {
  key: keyof Pick<CampusData, "studentBenefits" | "careerAdvantages" | "businessBenefits" | "socialNetwork" | "safety">
  title: string
  description: string
  icon: LucideIcon
}

type BenefitSection = BenefitConfig & { items: string[] }

const benefitConfigs: BenefitConfig[] = [
  {
    key: "studentBenefits",
    title: "Studentfordeler",
    description: "Oppdag fordelene du får som BISO-medlem på denne campusen.",
    icon: GraduationCap,
  },
  {
    key: "careerAdvantages",
    title: "Karriere og kompetanse",
    description: "Få støtte til praksis, kurs og nettverk som bygger CV-en din.",
    icon: BriefcaseBusiness,
  },
  {
    key: "socialNetwork",
    title: "Fellesskap og nettverk",
    description: "Bli en del av miljøet gjennom arrangementer og engasjement.",
    icon: Users,
  },
  {
    key: "safety",
    title: "Trygghet og støtte",
    description: "Vi sørger for at du får hjelp og oppfølging når du trenger det.",
    icon: ShieldCheck,
  },
  {
    key: "businessBenefits",
    title: "For samarbeidspartnere",
    description: "Muligheter for bedrifter som ønsker å samarbeide med campus.",
    icon: Handshake,
  },
]

type CampusMeta = {
  tagline: string
  description: string
  highlights: string[]
  focusAreas: string[]
  services: { title: string; description: string }[]
}

const defaultMeta: CampusMeta = {
  tagline: "Finn ditt fellesskap",
  description:
    "BISO samler engasjerte BI-studenter fra hele landet. Velg din campus for å se arrangementer, fordeler og fellesskap der du studerer.",
  highlights: [
    "Samarbeid mellom over 120 studentdrevne enheter",
    "Årlig kalender full av faglige og sosiale høydepunkter",
    "Ressurser og støtte til studentpolitikk og trivsel"
  ],
  focusAreas: ["Studentliv", "Karriere", "Påvirkning"],
  services: [
    {
      title: "Studentstøtte",
      description: "Kontakt campusens styre for hjelp med verv, midler eller arrangementer."
    },
    {
      title: "Fordelsprogram",
      description: "Få tilgang til eksklusive rabatter, arrangementer og medlemstilbud."
    },
    {
      title: "Karriere og nettverk",
      description: "Møt næringslivspartnere, delta på bedriftspresentasjoner og bygg din CV."
    }
  ]
}

const campusMetaMap: Record<string, CampusMeta> = {
  oslo: {
    tagline: "Hovedstadens hub for studentliv",
    description:
      "På BI Nydalen finner du Norges største studentmiljø innenfor økonomi og ledelse. BISO Oslo driver et pulserende campus med festivaler, student-politisk påvirkningsarbeid og et stort spekter av faglige initiativ.",
    highlights: [
      "Over 70 aktive enheter innen kultur, økonomi, HR og politikk",
      "Flaggskip-arrangement som Dancing With The Stars og Karrieredagen",
      "Sterkt samarbeid med næringsliv og partnere i Oslo-regionen"
    ],
    focusAreas: ["Festivaler", "Næringsliv", "Politikk"],
    services: [
      {
        title: "Campus-styret",
        description: "Få hjelp med ideer, søknader og støtteordninger fra BISOs lokale ledelse."
      },
      {
        title: "Event- og produksjonshjelp",
        description: "Tilgang på lys, lyd, foto og crew for å løfte arrangementet ditt."
      },
      {
        title: "Karrierehub",
        description: "Karrieredag, bedriftspresentasjoner og coaching gjennom hele året."
      }
    ]
  },
  bergen: {
    tagline: "Vestlandsk energi og fellesskap",
    description:
      "BISO Bergen kombinerer tradisjonsrike studentarrangement med sterk kobling til regionens næringsliv. Her får du nærhet til fjordopplevelser, festivaler og inkluderende sosiale møteplasser.",
    highlights: [
      "Årlige signaturarrangement som Kulturnatten og Bergen Business Conference",
      "Tett samarbeid med lokale bedrifter og gründermiljø",
      "Trygge sosiale arenaer og velferdsnettverk for nye studenter"
    ],
    focusAreas: ["Sosialt", "Næringsliv", "Velferd"],
    services: [
      {
        title: "Mentorprogram",
        description: "Bli matchet med alumner fra regionen og få innsikt i bransjen."
      },
      {
        title: "Kulturnettverket",
        description: "Utfold deg i revy, musikk, foto og skape nye tradisjoner for campus."
      },
      {
        title: "Studentvelferd",
        description: "Lavterskeltilbud og støtte via velværs- og likestillingsutvalg."
      }
    ]
  },
  trondheim: {
    tagline: "Innovasjon og studentpolitikk",
    description:
      "Trondheims campus er kjent for sterkt engasjement innen studentpolitikk, entreprenørskap og teknologisk utvikling. Her bygges fremtidens ledere gjennom samarbeid og nytenkning.",
    highlights: [
      "Toneangivende arbeid for studentpolitikk og kvalitet i studiene",
      "Innovasjonsarenaer i samarbeid med teknologimiljøet i byen",
      "Kompetanseprogram innen ledelse, økonomi og bærekraft"
    ],
    focusAreas: ["Politikk", "Entreprenørskap", "Bærekraft"],
    services: [
      {
        title: "Policy & Impact",
        description: "Jobb med studiepolitikk, kvalitet og påvirkningsarbeid for BI-studenter."
      },
      {
        title: "Startup-kollektivet",
        description: "Få hjelp til å realisere studentdrevne prosjekter og bedrifter."
      },
      {
        title: "Faglige nettverk",
        description: "Deltakelse i case-konkurranser, kurs og mentorordninger."
      }
    ]
  },
  stavanger: {
    tagline: "Karriereby med nordisk puls",
    description:
      "BISO Stavanger kombinerer olje- og energihovedstadens næringsliv med internasjonale impulser. Campusen byr på høy aktivitet rundt karriere, kultur og nytenkende arrangement",
    highlights: [
      "Career Week med ledende aktører fra energi og teknologi",
      "Egne enheter for internasjonale studenter og inkludering",
      "Samarbeid om bærekraft og samfunnsansvar med lokale partnere"
    ],
    focusAreas: ["Karriere", "Internasjonalt", "Bærekraft"],
    services: [
      {
        title: "Partnernettverk",
        description: "Møt selskaper fra regionen gjennom workshops og case-oppdrag."
      },
      {
        title: "International Hub",
        description: "Aktiviteter og støtte for internasjonale studenter på BI Stavanger."
      },
      {
        title: "Arrangementsteam",
        description: "Planlegg konserter, sosiale treff og temakvelder med erfarent crew."
      }
    ]
  },
  national: {
    tagline: "Felleskap på tvers av campuser",
    description:
      "Den nasjonale organisasjonen støtter lokale styrer, koordinerer politikk og sørger for at BISOs prosjekter løftes til hele landet. Perfekt for deg som vil påvirke helheten.",
    highlights: [
      "Koordinering av nasjonale prosjekter og kampanjer",
      "Tilrettelegging for politiske prosesser og landsmøter",
      "Ressurser innen finans, kommunikasjon og HR på tvers av campuser"
    ],
    focusAreas: ["Strategi", "Politikk", "Kompetanse"],
    services: [
      {
        title: "Prosjektstøtte",
        description: "Rådgivning og finansiering til større BISO-prosjekter og satsninger."
      },
      {
        title: "Ressurssenter",
        description: "Tilgang til maler, verktøy og delte tjenester for lokallagene."
      },
      {
        title: "Landsmøte & forum",
        description: "Delta i beslutningsarenaer som former BISOs retning nasjonalt."
      }
    ]
  }
}

const campusFallbackImage = "/images/placeholder.jpg"

const normalizeCampusName = (name?: string | null) =>
  (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, "-")
    .replace(/(^-|-$)/g, "")


const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left shadow-glow">
    <div className="text-xl font-semibold text-white">{value}</div>
    <div className="text-xs uppercase tracking-wide text-white/70">{label}</div>
  </div>
)

const ListItem = ({
  title,
  description,
  href,
  meta
}: {
  title: string
  description?: string
  href?: string
  meta?: string
}) => (
  <div className="rounded-2xl border border-primary/10 bg-white/70 p-4 shadow-card hover:border-primary/30 hover:shadow-lg transition">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-base font-semibold text-primary-100">{title}</div>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{description}</p>
        ) : null}
      </div>
      {href ? (
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-primary-40">
          <Link href={href}>
            <ArrowUpRight className="h-4 w-4" />
            <span className="sr-only">Les mer</span>
          </Link>
        </Button>
      ) : null}
    </div>
    {meta ? <div className="mt-2 text-xs uppercase tracking-wide text-primary-60">{meta}</div> : null}
  </div>
)

const mapToLeader = (entry: any): CampusLeader => ({
  name: entry?.name ?? entry?.displayName ?? "",
  email: entry?.email ?? entry?.mail ?? undefined,
  phone:
    entry?.phone ??
    (Array.isArray(entry?.businessPhones) ? entry.businessPhones[0] : undefined) ??
    entry?.mobilePhone ??
    undefined,
  role: entry?.role ?? entry?.jobTitle ?? "",
  officeLocation: entry?.officeLocation ?? undefined,
  profilePhotoUrl: entry?.profilePhotoUrl ?? entry?.imageUrl ?? undefined,
})

type CampusPageClientProps = {
  events: Event[]
  jobs: Job[]
  news: NewsItemWithTranslations[]
  departments: DepartmentRecord[]
  campusData: CampusData[]
  campusMetadata: Record<string, CampusMetadata>
  locale?: Locale
}

export const CampusPageClient = ({ events, jobs, news, departments, campusData, campusMetadata, locale = "no" }: CampusPageClientProps) => {
  const { campuses, activeCampus, activeCampusId, selectCampus, loading } = useCampus()

  const [leadership, setLeadership] = useState<CampusLeader[]>([])
  const [leadershipLoading, setLeadershipLoading] = useState(false)
  const [leadershipError, setLeadershipError] = useState<string | null>(null)

  const campusDataById = useMemo(() => {
    return campusData.reduce<Record<string, CampusData>>((acc, item) => {
      if (item?.$id) {
        acc[item.$id] = item
      }
      return acc
    }, {})
  }, [campusData])

  const campusDataByName = useMemo(() => {
    return campusData.reduce<Record<string, CampusData>>((acc, item) => {
      const key = (item?.name ?? '').toLowerCase().trim()
      if (key) {
        acc[key] = item
      }
      return acc
    }, {})
  }, [campusData])

  const activeCampusData = useMemo(() => {
    if (activeCampusId && campusDataById[activeCampusId]) {
      return campusDataById[activeCampusId]
    }
    if (activeCampus?.name) {
      const key = activeCampus.name.toLowerCase()
      return campusDataByName[key] ?? null
    }
    return null
  }, [activeCampusId, campusDataById, activeCampus, campusDataByName])

  const campusLocation = useMemo<CampusLocation | null>(() => {
    const raw = activeCampusData?.location
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return {
          address: typeof parsed.address === 'string' ? parsed.address : undefined,
          email: typeof parsed.email === 'string' ? parsed.email : undefined,
          phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
        }
      }
    } catch (error) {
      console.error('Failed to parse campus location', error)
    }
    return null
  }, [activeCampusData])

  const campusIdentifier = useMemo(() => {
    if (activeCampusId) return activeCampusId
    if ((activeCampus as any)?.$id) return (activeCampus as any).$id as string
    if (activeCampus?.name) return activeCampus.name
    return null
  }, [activeCampusId, activeCampus])

  const fallbackLeadership = useMemo(() => {
    if (!Array.isArray(activeCampusData?.departmentBoard)) return [] as CampusLeader[]
    return (activeCampusData?.departmentBoard ?? [])
      .map(mapToLeader)
      .filter((member) => member.name)
  }, [activeCampusData])

  // Function to get localized content from metadata
  const getLocalizedContent = useCallback((nbContent?: string | string[], enContent?: string | string[]) => {
    if (locale === "en" && enContent) return enContent
    return nbContent || enContent || ""
  }, [locale])

  useEffect(() => {
    if (!campusIdentifier) {
      setLeadership(fallbackLeadership)
      setLeadershipError(null)
      setLeadershipLoading(false)
      return
    }

    let cancelled = false
    setLeadershipLoading(true)
    setLeadershipError(null)

    fetch('/api/campus-leadership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campus: campusIdentifier }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch campus leadership')
        }
        return response.json()
      })
      .then((payload) => {
        if (cancelled) return
        const dataset = payload?.data ?? payload
        const members =
          Array.isArray(dataset?.members)
            ? dataset.members
            : Array.isArray(dataset?.data?.members)
              ? dataset.data.members
              : []
        if (Array.isArray(members) && members.length) {
          const mapped = members.map(mapToLeader).filter((member) => member.name)
          setLeadership(mapped)
          setLeadershipError(null)
        } else {
          setLeadership(fallbackLeadership)
          if (!fallbackLeadership.length) {
            setLeadershipError('Campusledelsen er ikke tilgjengelig akkurat nå.')
          }
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to load campus leadership', error)
        setLeadership(fallbackLeadership)
        if (!fallbackLeadership.length) {
          setLeadershipError('Campusledelsen er ikke tilgjengelig akkurat nå.')
        } else {
          setLeadershipError(null)
        }
      })
      .finally(() => {
        if (cancelled) return
        setLeadershipLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [campusIdentifier, fallbackLeadership])

  const heroMeta = useMemo(() => {
    if (!activeCampus) return defaultMeta
    
    // Try to find metadata by campus ID or name
    const metadata = campusMetadata[activeCampusId || ""] || 
                    Object.values(campusMetadata).find(m => 
                      m.campus_name.toLowerCase() === normalizeCampusName(activeCampus.name)
                    )
    
    if (metadata) {
      const services = metadata.services_nb || metadata.services_en
      let parsedServices: { title: string; description: string }[] = []
      
      try {
        if (services) {
          const servicesData = JSON.parse(locale === "en" && metadata.services_en ? metadata.services_en : services)
          parsedServices = Array.isArray(servicesData) ? servicesData : []
        }
      } catch (error) {
        console.error('Failed to parse services:', error)
      }
      
      return {
        tagline: getLocalizedContent(metadata.tagline_nb, metadata.tagline_en) as string || `Alt om ${activeCampus.name}`,
        description: getLocalizedContent(metadata.description_nb, metadata.description_en) as string || defaultMeta.description,
        highlights: getLocalizedContent(metadata.highlights_nb, metadata.highlights_en) as string[] || [],
        focusAreas: getLocalizedContent(metadata.focusAreas_nb, metadata.focusAreas_en) as string[] || [],
        services: parsedServices
      }
    }
    
    // Fallback to hardcoded data if no metadata
    const slug = normalizeCampusName(activeCampus.name)
    return campusMetaMap[slug] || {
      ...defaultMeta,
      tagline: `Alt om ${activeCampus.name}`,
      description: defaultMeta.description
    }
  }, [activeCampus, activeCampusId, campusMetadata, locale, getLocalizedContent])

  const campusSpecificDepartments = useMemo(() => {
    if (!activeCampusId) return departments
    return departments.filter((dept) => dept.campus_id === activeCampusId)
  }, [departments, activeCampusId])

  const campusSpecificEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const filtered = activeCampusId ? events.filter((event) => event.campus.$id === activeCampusId) : events

    const safeTime = (value?: string) => {
      if (!value) return Number.MAX_SAFE_INTEGER
      const time = new Date(value).getTime()
      return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
    }

    return filtered
      .filter((event) => {
        if (!event.start_date) return true
        const start = new Date(event.start_date)
        return Number.isNaN(start.getTime()) ? true : start >= today
      })
      .sort((a, b) => safeTime(a.start_date) - safeTime(b.start_date))
  }, [events, activeCampusId])

  const campusSpecificJobs = useMemo(() => {
    const filtered = activeCampusId ? jobs.filter((job) => job?.campus?.$id === activeCampusId) : jobs
    return filtered.sort((a, b) => (b.application_deadline || '').localeCompare(a.application_deadline || ''))
  }, [jobs, activeCampusId])

  const highlightedNews = useMemo(() => news.slice(0, 4), [news])

  const stats = useMemo(
    () => [
      {
        label: 'Aktive enheter',
        value: campusSpecificDepartments.length ? campusSpecificDepartments.length : '--',
      },
      {
        label: 'Kommende arrangementer',
        value: campusSpecificEvents.length ? campusSpecificEvents.length : '--',
      },
      {
        label: 'Ledige verv',
        value: campusSpecificJobs.length ? campusSpecificJobs.length : '--',
      },
    ],
    [campusSpecificDepartments.length, campusSpecificEvents.length, campusSpecificJobs.length]
  )

  const benefitSections = useMemo<BenefitSection[]>(() => {
    if (!activeCampusData) return []
    const suffix = locale === "en" ? "en" : "nb"
    return benefitConfigs
      .map((config) => {
        const localizedKey = `${config.key}_${suffix}` as keyof CampusData
        const localized = (activeCampusData as any)[localizedKey]
        const fallback = (activeCampusData as any)[config.key]
        const items = Array.isArray(localized)
          ? (localized as string[]).filter(Boolean)
          : Array.isArray(fallback)
            ? (fallback as string[]).filter(Boolean)
            : []
        return {
          ...config,
          items,
        }
      })
      .filter((section) => section.items.length)
  }, [activeCampusData, locale])

  const featuredServices = useMemo(() => heroMeta.services.slice(0, 3), [heroMeta.services])

  const renderCampusCard = (campusId: string, name: string) => {
    const slug = normalizeCampusName(name)
    const meta = campusMetaMap[slug] || defaultMeta
    const isActive = campusId === activeCampusId

    return (
      <button
        key={campusId}
        onClick={() => selectCampus(campusId)}
        className={cn(
          "relative flex h-full flex-col justify-between rounded-3xl border p-6 text-left transition-all",
          "border-primary/10 bg-white/80 shadow-card-hover hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl",
          isActive && "border-primary-30 bg-linear-to-br from-primary-100/95 via-blue-strong/90 to-blue-accent/80 text-white"
        )}
      >
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2">
            <Badge variant={isActive ? "gold" : "outline"} className={cn(isActive ? "text-primary-100" : "text-primary-70 border-primary/30")}>Campuser</Badge>
            {isActive ? <Badge variant="glass-dark">Valgt</Badge> : null}
          </div>
          <div>
            <h3 className={cn("text-xl font-semibold", isActive ? "text-white" : "text-primary-100")}>{name}</h3>
            <p className={cn("mt-2 text-sm", isActive ? "text-white/80" : "text-muted-foreground")}>{meta.tagline}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {meta.focusAreas.map((area) => (
            <Badge
              key={area}
              variant={isActive ? "glass-dark" : "outline"}
              className={cn(
                "text-xs",
                isActive ? "text-white/90 border-white/20" : "text-primary-60 border-primary/20"
              )}
            >
              {area}
            </Badge>
          ))}
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-[40px] border border-primary/10 bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.28),transparent_55%)]" />
        <div className="relative grid gap-10 px-6 py-12 md:px-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-16 xl:px-14">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              {activeCampus ? `${activeCampus.name} campus` : "Alle campuser"}
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-white md:text-5xl">
              {activeCampus ? `${activeCampus.name}` : "Opplev BISO på tvers av campuser"}
            </h1>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">{heroMeta.description}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-primary-100 hover:bg-white/90">
                <Link href="/membership">Bli medlem</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="glass"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href={`/events?campus=${activeCampusId || "all"}`}>Se arrangementer</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-white hover:bg-white/10"
              >
                <Link href={`/jobs?campus=${activeCampusId || "all"}`}>Finn et verv</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 pt-4">
              {stats.map((stat) => (
                <StatPill key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>
          </div>
          <div className="relative h-full">
            <div className="flex h-full flex-col justify-between gap-6 rounded-[32px] border border-white/20 bg-white/10 p-8 shadow-glow">
              <div>
                <h2 className="text-xl font-semibold text-white">Dette preger campus nå</h2>
                <p className="mt-2 text-sm text-white/70">{heroMeta.tagline}</p>
              </div>
              <ul className="space-y-4 text-sm text-white/85">
                {heroMeta.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-3">
                    <span className="mt-1 block h-2 w-2 shrink-0 rounded-full bg-gold-default" />
                    <span className="text-white/80">{highlight}</span>
                  </li>
                ))}
              </ul>
              <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-white/20">
                <Image src={campusFallbackImage} alt="Campus" fill className="object-cover" />
                <div className="absolute inset-0 bg-linear-to-t from-blue-strong/70 via-blue-strong/10 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>



      {activeCampusData ? (
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              {activeCampusData.description ? (
                <p className="text-base leading-relaxed text-muted-foreground/90">
                  {activeCampusData.description}
                </p>
              ) : null}
              {benefitSections.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {benefitSections.map((section) => (
                    <Card key={section.key} className="h-full border-primary/10 bg-white/90 p-6 shadow-card">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full border border-primary/10 bg-primary-20/60 p-2 text-primary-60">
                          <section.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-primary-100">{section.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-40" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              ) : null}
            </div>
            <Card className="border-primary/10 bg-white/90 p-6 shadow-card">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full border border-primary/10 bg-primary-20/60 p-2 text-primary-60">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-primary-100">Campus-kontakt</h3>
                    <p className="text-sm text-muted-foreground">
                      Finn kontaktinformasjon og sted for campusledelsen.
                    </p>
                  </div>
                </div>
                {campusLocation ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {campusLocation.address ? (
                      <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 h-4 w-4 text-primary-50" />
                        <span>{campusLocation.address}</span>
                      </div>
                    ) : null}
                    {campusLocation.email ? (
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-4 w-4 text-primary-50" />
                        <a href={`mailto:${campusLocation.email}`} className="underline-offset-2 hover:underline">
                          {campusLocation.email}
                        </a>
                      </div>
                    ) : null}
                    {campusLocation.phone ? (
                      <div className="flex items-start gap-3">
                        <Phone className="mt-0.5 h-4 w-4 text-primary-50" />
                        <a href={`tel:${campusLocation.phone}`} className="underline-offset-2 hover:underline">
                          {campusLocation.phone}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Kontakt oss for mer informasjon om denne campusen.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-primary-100">
              {activeCampus ? `Dette skjer ved ${activeCampus.name}` : "Aktuelt i BISO"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Få oversikt over kommende arrangementer, ledige verv og siste nytt fra organisasjonen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Button asChild variant="ghost" size="sm" className="text-primary-40">
              <Link href={`/events?campus=${activeCampusId || "all"}`}>Alle arrangementer</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-primary-40">
              <Link href={`/jobs?campus=${activeCampusId || "all"}`}>Alle verv</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-primary-40">
              <Link href="/news">Nyhetsarkiv</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-primary/10 bg-white/90 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-primary-100">
                  <CalendarDays className="h-5 w-5 text-primary-40" />
                  Arrangementer
                </CardTitle>
                <p className="text-sm text-muted-foreground">Neste høydepunkter på campus.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {campusSpecificEvents.length ? (
                campusSpecificEvents.slice(0, 4).map((event) => (
                  <ListItem
                    key={event.$id || event.title}
                    title={event.title}
                    description={event.description}
                    href={event.$id ? `/events/${event.$id}` : undefined}
                    meta={formatDateReadable(event.start_date)}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-primary/20 p-6 text-center text-sm text-muted-foreground">
                  Ingen publiserte arrangementer akkurat nå. Utforsk kalenderen for hele BISO.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white/90 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-primary-100">
                  <BriefcaseBusiness className="h-5 w-5 text-primary-40" />
                  Ledige verv
                </CardTitle>
                <p className="text-sm text-muted-foreground">Utvikle deg i studentorganisasjonen.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {campusSpecificJobs.length ? (
                campusSpecificJobs.slice(0, 4).map((job) => (
                  <ListItem
                    key={job.$id || job.slug}
                    title={job.title}
                    description={job.description?.replace(/<[^>]+>/g, "").slice(0, 160)}
                    href={job.slug ? `/jobs/${job.slug}` : undefined}
                    meta={job.application_deadline ? `Søknadsfrist: ${formatDateReadable(job.application_deadline)}` : "Løpende"}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-primary/20 p-6 text-center text-sm text-muted-foreground">
                  Ingen ledige verv akkurat nå. Følg med eller kontakt campusstyret for muligheter.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white/90 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-primary-100">
                  <Newspaper className="h-5 w-5 text-primary-40" />
                  Nyheter
                </CardTitle>
                <p className="text-sm text-muted-foreground">Historier og kunngjøringer fra BISO.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlightedNews.length ? (
                highlightedNews.map((article) => (
                  <ListItem
                    key={article.$id || article.title}
                    title={article.title}
                    description={article.summary}
                    href={article.$id ? `/news/${article.$id}` : undefined}
                    meta={formatDateReadable(article.date)}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-primary/20 p-6 text-center text-sm text-muted-foreground">
                  Ingen nyheter tilgjengelig akkurat nå. Besøk nyhetsarkivet for flere saker.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-primary-100">Lokale enheter og fagmiljø</h2>
            <p className="text-sm text-muted-foreground">
              Finn teamet som matcher dine interesser. Hver enhet drives av studenter og gir deg erfaring du kan ta med videre.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-primary-40">
            <Link href={`/units${activeCampusId ? `?campus_id=${activeCampusId}` : ""}`}>
              Se alle enheter
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campusSpecificDepartments.slice(0, 6).map((dept) => (
            <div
              key={dept.$id}
              className="group relative overflow-hidden rounded-3xl border border-primary/10 bg-white/90 p-5 shadow-card-hover transition hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl"
            >
              <div className="absolute inset-x-10 top-0 h-1 rounded-b-full bg-linear-to-r from-blue-accent via-gold-default to-blue-accent opacity-0 transition group-hover:opacity-100" />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-primary-100">{dept.name}</h3>
                {dept.type ? (
                  <Badge variant="outline" className="text-[11px] uppercase tracking-wide text-primary-60 border-primary/20">
                    {dept.type}
                  </Badge>
                ) : null}
              </div>
              {dept.description ? (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3" dangerouslySetInnerHTML={{ __html: dept.description }} />
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Besøk enheten for å lære mer om deres aktiviteter og hvordan du kan bidra.
                </p>
              )}
            </div>
          ))}
          {!campusSpecificDepartments.length ? (
            <div className="rounded-3xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">
              Lokale enheter lastes inn fortløpende. Kontakt campusstyret dersom du ønsker å starte noe nytt.
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-primary-100">Campusledelse</h2>
            <p className="text-sm text-muted-foreground">
              Møt teamet som leder {activeCampus ? activeCampus.name : 'campusene'} og støtter studentmiljøet.
            </p>
          </div>
          {activeCampus && campusLocation?.email ? (
            <Button asChild variant="ghost" size="sm" className="text-primary-40">
              <a href={`mailto:${campusLocation.email}`}>Kontakt campusledelsen</a>
            </Button>
          ) : null}
        </div>
        {leadershipLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary-50" />
              <span>Laster campusledelse...</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card
                  key={index}
                  className="h-full rounded-3xl border border-primary/10 bg-white/80 p-6 shadow-card animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-primary/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded bg-primary/10" />
                      <div className="h-3 w-16 rounded bg-primary/10" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : leadership.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {leadership.map((member) => (
              <Card
                key={member.email || member.name}
                className="flex h-full flex-col gap-4 rounded-3xl border border-primary/10 bg-white/90 p-6 shadow-card-hover transition"
              >
                <div className="flex items-center gap-4">
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border border-primary/10 bg-primary-10">
                    {member.profilePhotoUrl ? (
                      <Image src={member.profilePhotoUrl} alt={member.name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary-70">
                        {getInitials(member.name || '')}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-primary-100">{member.name || 'Ukjent'}</h3>
                    {member.role ? <p className="text-sm text-muted-foreground">{member.role}</p> : null}
                    {member.officeLocation ? <p className="text-xs text-primary-60">{member.officeLocation}</p> : null}
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {member.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary-50" />
                      <a href={`mailto:${member.email}`} className="underline-offset-2 hover:underline">
                        {member.email}
                      </a>
                    </div>
                  ) : null}
                  {member.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary-50" />
                      <a href={`tel:${member.phone}`} className="underline-offset-2 hover:underline">
                        {member.phone}
                      </a>
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">
            {leadershipError || 'Vi oppdaterer snart informasjon om campusledelsen.'}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-primary-100">Tjenester og støtte fra campus</h2>
          <p className="text-sm text-muted-foreground">
            Disse ordningene er her for å gjøre studenthverdagen bedre – uansett om du planlegger et arrangement, trenger støtte eller vil påvirke.
          </p>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {featuredServices.map((service) => (
              <Card
                key={service.title}
                className="min-w-[260px] flex-1 border-primary/10 bg-white/90 px-5 py-6 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-full border border-primary/10 bg-primary-20/40 p-2 text-primary-60">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-primary-100">{service.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      <section className="rounded-3xl border border-primary/10 bg-primary-10/40 p-8 shadow-inner">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-primary-100">Ta kontakt med campusstyret</h2>
            <p className="text-sm text-muted-foreground">
              Trenger du hjelp, vil starte et prosjekt eller lurer på hvordan du kan engasjere deg? Send oss en melding så kobler vi deg med riktig person lokalt.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="gradient">
                <Link href="/contact">Kontakt oss</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/safety">Varslingskanal</Link>
              </Button>
            </div>
          </div>
          <div className="relative h-48 w-full overflow-hidden rounded-3xl border border-primary/10">
            <Image src={campusFallbackImage} alt="BISO-campus" fill className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-primary-100/40 via-primary-100/10 to-transparent" />
          </div>
        </div>
      </section>
    </div>
  )
}
