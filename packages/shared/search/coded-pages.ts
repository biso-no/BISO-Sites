import { baseEntry, type MapContext } from "./entries/common";
import {
  ALL_CAMPUSES,
  SEARCH_LOCALES,
  type SearchEntry,
  type SearchLocale,
} from "./types";

interface CodedText {
  description: string;
  keywords: string[];
  title: string;
}

export interface CodedPage {
  /** A campus id ("1".."4") for a campus landing page, else all campuses. */
  campusId?: string;
  path: string;
  text: Record<SearchLocale, CodedText>;
}

/**
 * Pages written in code rather than stored in the database. Kept by hand:
 * the sitemap test fails when a sitemap page is missing from this list.
 */
export const CODED_PAGES: readonly CodedPage[] = [
  {
    path: "/",
    text: {
      no: {
        title: "BISO – BI Student Organisation",
        description:
          "Studentforeningen ved Handelshøyskolen BI, med arrangementer, frivillige verv, studentfordeler og campusliv i Oslo, Bergen, Trondheim og Stavanger.",
        keywords: ["forside", "hjem", "biso", "studentforening", "bi"],
      },
      en: {
        title: "BISO – BI Student Organisation",
        description:
          "The student association at BI Norwegian Business School, with events, volunteer roles, student benefits and campus life in Oslo, Bergen, Trondheim and Stavanger.",
        keywords: ["home", "front page", "biso", "student organisation", "bi"],
      },
    },
  },
  {
    path: "/about",
    text: {
      no: {
        title: "Om BISO",
        description:
          "Alt du trenger å vite om studentforeningen: hvem vi er, hva vi gjør og hvordan vi er organisert.",
        keywords: [
          "rusmiddelpolicy",
          "ruspolicy",
          "om oss",
          "om biso",
          "hvem er vi",
          "studentforening",
        ],
      },
      en: {
        title: "About BISO",
        description:
          "Everything you need to know about the student union: who we are, what we do and how we are organised.",
        keywords: [
          "drugs policy",
          "drug policy",
          "about us",
          "about biso",
          "who we are",
          "student union",
        ],
      },
    },
  },
  {
    path: "/jobs",
    text: {
      no: {
        title: "Verv og stillinger",
        description:
          "Åpne verv og stillinger i BISO. Se hva som er ledig og søk.",
        keywords: [
          "verv",
          "stilling",
          "stillinger",
          "jobb",
          "søk",
          "frivillig",
        ],
      },
      en: {
        title: "Join our team",
        description: "Open positions at BISO. See what is available and apply.",
        keywords: [
          "jobs",
          "positions",
          "volunteer",
          "apply",
          "careers",
          "join",
        ],
      },
    },
  },
  {
    path: "/events",
    text: {
      no: {
        title: "Arrangementer",
        description:
          "Arrangementer for studentene på Handelshøyskolen BI, på alle campus.",
        keywords: [
          "arrangement",
          "arrangementer",
          "event",
          "events",
          "billetter",
        ],
      },
      en: {
        title: "Events",
        description:
          "Events for students at BI Norwegian Business School, across all campuses.",
        keywords: ["events", "event", "tickets", "what's on", "arrangementer"],
      },
    },
  },
  {
    path: "/news",
    text: {
      no: {
        title: "Nyheter",
        description: "Siste nytt, prestasjoner og historier fra BISO-miljøet.",
        keywords: ["nyheter", "nyhet", "siste nytt", "artikler", "historier"],
      },
      en: {
        title: "News and student stories",
        description:
          "The latest happenings, achievements and stories from the BISO community.",
        keywords: ["news", "stories", "articles", "updates", "nyheter"],
      },
    },
  },
  {
    path: "/shop",
    text: {
      no: {
        title: "Nettbutikk",
        description: "Merch, egenandel for turer, campusskap og medlemskap.",
        keywords: ["butikk", "nettbutikk", "merch", "kjøp", "skap", "genser"],
      },
      en: {
        title: "Shop",
        description: "Merch, trip deductibles, campus lockers and memberships.",
        keywords: ["shop", "store", "merch", "buy", "locker", "hoodie"],
      },
    },
  },
  {
    path: "/documents",
    text: {
      no: {
        title: "Dokumenter",
        description:
          "Vedtekter, statutter, retningslinjer og policyer som gjelder for BISO på alle campus.",
        keywords: [
          "dokumenter",
          "vedtekter",
          "statutter",
          "retningslinjer",
          "policy",
        ],
      },
      en: {
        title: "Documents",
        description:
          "Statutes, bylaws, guidelines and policies that govern BISO across every campus.",
        keywords: [
          "documents",
          "statutes",
          "bylaws",
          "guidelines",
          "policies",
          "vedtekter",
        ],
      },
    },
  },
  {
    path: "/campus",
    text: {
      no: {
        title: "Campus",
        description:
          "BISO på alle campus ved Handelshøyskolen BI: Oslo, Bergen, Trondheim og Stavanger.",
        keywords: ["campus", "oslo", "bergen", "trondheim", "stavanger"],
      },
      en: {
        title: "Campuses",
        description:
          "BISO on every BI Norwegian Business School campus: Oslo, Bergen, Trondheim and Stavanger.",
        keywords: [
          "campus",
          "campuses",
          "oslo",
          "bergen",
          "trondheim",
          "stavanger",
        ],
      },
    },
  },
  {
    path: "/campus/oslo",
    campusId: "1",
    text: {
      no: {
        title: "BISO Oslo",
        description: "BISO på campus Oslo.",
        keywords: ["oslo", "campus oslo", "nydalen"],
      },
      en: {
        title: "BISO Oslo",
        description: "BISO at the Oslo campus.",
        keywords: ["oslo", "campus oslo", "nydalen"],
      },
    },
  },
  {
    path: "/campus/bergen",
    campusId: "2",
    text: {
      no: {
        title: "BISO Bergen",
        description: "BISO på campus Bergen.",
        keywords: ["bergen", "campus bergen"],
      },
      en: {
        title: "BISO Bergen",
        description: "BISO at the Bergen campus.",
        keywords: ["bergen", "campus bergen"],
      },
    },
  },
  {
    path: "/campus/trondheim",
    campusId: "3",
    text: {
      no: {
        title: "BISO Trondheim",
        description: "BISO på campus Trondheim.",
        keywords: ["trondheim", "campus trondheim"],
      },
      en: {
        title: "BISO Trondheim",
        description: "BISO at the Trondheim campus.",
        keywords: ["trondheim", "campus trondheim"],
      },
    },
  },
  {
    path: "/campus/stavanger",
    campusId: "4",
    text: {
      no: {
        title: "BISO Stavanger",
        description: "BISO på campus Stavanger.",
        keywords: ["stavanger", "campus stavanger"],
      },
      en: {
        title: "BISO Stavanger",
        description: "BISO at the Stavanger campus.",
        keywords: ["stavanger", "campus stavanger"],
      },
    },
  },
  {
    path: "/campus/national",
    text: {
      no: {
        title: "BISO nasjonalt",
        description: "Det nasjonale BISO, som samler alle campus.",
        keywords: ["nasjonal", "nasjonalt", "national", "landsdekkende"],
      },
      en: {
        title: "BISO National",
        description: "National BISO, which brings all campuses together.",
        keywords: ["national", "nasjonalt", "all campuses"],
      },
    },
  },
  {
    path: "/membership",
    text: {
      no: {
        title: "Medlemskap i BISO",
        description:
          "Bli medlem i BISO og få fordeler, rabatter og tilgang til arrangementer ved Handelshøyskolen BI.",
        keywords: [
          "medlemskap",
          "medlem",
          "bli medlem",
          "medlemsfordeler",
          "rabatt",
          "fordeler",
        ],
      },
      en: {
        title: "BISO membership",
        description:
          "Become a BISO member and get benefits, discounts and access to events across BI Norwegian Business School.",
        keywords: [
          "membership",
          "member",
          "become a member",
          "member benefits",
          "discount",
          "benefits",
        ],
      },
    },
  },
  {
    path: "/business",
    text: {
      no: {
        title: "Bli partner",
        description:
          "Bli partner med BISO og kom i kontakt med fremtidige kolleger. Vis frem selskapet til BI-studenter på alle campus.",
        keywords: [
          "partner",
          "bli partner",
          "bedrift",
          "samarbeid",
          "sponsor",
          "næringsliv",
        ],
      },
      en: {
        title: "Become a partner",
        description:
          "Partner with BISO and connect with future colleagues. Show your company to BI students across all campuses.",
        keywords: [
          "partner",
          "become a partner",
          "business",
          "company",
          "sponsor",
          "collaboration",
        ],
      },
    },
  },
  {
    path: "/business-hotspot",
    text: {
      no: {
        title: "Business Hotspot",
        description:
          "Kom i kontakt med studenter på campus Oslo gjennom BISOs Business Hotspot.",
        keywords: [
          "business hotspot",
          "hotspot",
          "bedrift",
          "oslo",
          "studenter",
        ],
      },
      en: {
        title: "Business Hotspot",
        description:
          "Connect with students at the Oslo campus through BISO's Business Hotspot.",
        keywords: [
          "business hotspot",
          "hotspot",
          "company",
          "oslo",
          "students",
        ],
      },
    },
  },
  {
    path: "/contact",
    text: {
      no: {
        title: "Kontakt",
        description: "Kontakt BISO nasjonalt eller direkte på ditt campus.",
        keywords: [
          "kontakt",
          "kontakt oss",
          "e-post",
          "epost",
          "telefon",
          "adresse",
        ],
      },
      en: {
        title: "Contact",
        description: "Contact BISO nationally or directly at your campus.",
        keywords: [
          "contact",
          "contact us",
          "email",
          "phone",
          "address",
          "kontakt",
        ],
      },
    },
  },
  {
    path: "/units",
    text: {
      no: {
        title: "Enheter og avdelinger",
        description:
          "De studentdrevne enhetene og avdelingene som utgjør BISO på campusene ved Handelshøyskolen BI.",
        keywords: [
          "enheter",
          "avdelinger",
          "avdeling",
          "komité",
          "utvalg",
          "team",
        ],
      },
      en: {
        title: "Units and departments",
        description:
          "The student-run units and departments that make up BISO across BI Norwegian Business School campuses.",
        keywords: [
          "units",
          "departments",
          "department",
          "committee",
          "teams",
          "enheter",
        ],
      },
    },
  },
  {
    path: "/students",
    text: {
      no: {
        title: "For studenter",
        description:
          "Medlemsfordeler, verv og støtteressurser samlet på ett sted.",
        keywords: [
          "student",
          "studenter",
          "studentliv",
          "fordeler",
          "verv",
          "ny student",
        ],
      },
      en: {
        title: "For students",
        description:
          "Member benefits, positions and support resources in one place.",
        keywords: [
          "students",
          "student life",
          "benefits",
          "positions",
          "new student",
          "studenter",
        ],
      },
    },
  },
  {
    path: "/projects",
    text: {
      no: {
        title: "Prosjekter",
        description:
          "Prosjekter og store arrangementer som BISO arrangerer på tvers av campusene.",
        keywords: ["prosjekter", "prosjekt", "store arrangementer", "festival"],
      },
      en: {
        title: "Projects",
        description:
          "Projects and large events organised by BISO across the campuses.",
        keywords: [
          "projects",
          "project",
          "large events",
          "festival",
          "prosjekter",
        ],
      },
    },
  },
  {
    path: "/projects/fadderullan",
    text: {
      no: {
        title: "Fadderullan",
        description:
          "BISOs velkomstfestival, laget av frivillige fra alle campus for at nye studenter lett skal bli kjent og føle seg hjemme.",
        keywords: [
          "fadderullan",
          "fadder",
          "fadderuke",
          "velkomst",
          "ny student",
        ],
      },
      en: {
        title: "Fadderullan",
        description:
          "BISO's welcome festival, made by volunteers from every campus so new students can meet people and feel at home.",
        keywords: [
          "fadderullan",
          "welcome week",
          "freshers",
          "welcome festival",
          "new student",
          "fadder",
        ],
      },
    },
  },
  {
    path: "/projects/karrieredagene",
    text: {
      no: {
        title: "Karrieredagene",
        description:
          "Karrieredagene kobler studenter og arbeidsgivere gjennom stands, workshops og intervjuprogrammer.",
        keywords: [
          "karrieredagene",
          "karrieredag",
          "karriere",
          "arbeidsgivere",
          "stands",
          "intervju",
        ],
      },
      en: {
        title: "Karrieredagene",
        description:
          "Karrieredagene connects students and employers through stands, workshops and interview programmes.",
        keywords: [
          "karrieredagene",
          "career days",
          "career fair",
          "employers",
          "careers",
          "interview",
        ],
      },
    },
  },
  {
    path: "/projects/winter-games",
    text: {
      no: {
        title: "Winter Games",
        description:
          "Vinterturen som samler BI-studenter til ski, afterski og fellesskap. Destinasjonen skifter.",
        keywords: [
          "winter games",
          "vintertur",
          "ski",
          "skitur",
          "afterski",
          "tur",
        ],
      },
      en: {
        title: "Winter Games",
        description:
          "The winter trip that brings BI students together for skiing, after-ski and community. The destination rotates.",
        keywords: [
          "winter games",
          "winter trip",
          "ski",
          "skiing",
          "after-ski",
          "trip",
        ],
      },
    },
  },
  {
    path: "/okonomisk-stotte",
    text: {
      no: {
        title: "Økonomisk støtte",
        description:
          "Søk støtte fra BI-fondet til studentaktiviteter, prosjekter og arrangementer ved Handelshøyskolen BI.",
        keywords: [
          "støtte",
          "økonomisk støtte",
          "bi-fondet",
          "fond",
          "søknad",
          "penger",
          "stotte",
        ],
      },
      en: {
        title: "Financial support",
        description:
          "Apply to the BI Fund for support for student activities, projects and events at BI Norwegian Business School.",
        keywords: [
          "funding",
          "financial support",
          "bi fund",
          "grant",
          "apply",
          "støtte",
        ],
      },
    },
  },
  {
    path: "/resources",
    text: {
      no: {
        title: "Ressurser",
        description:
          "Støtteordninger, regler, politikk og mer for deg som er BI-student.",
        keywords: [
          "ressurser",
          "hjelp",
          "støtteordninger",
          "regler",
          "politikk",
          "student",
        ],
      },
      en: {
        title: "Resources",
        description: "Support schemes, rules, policy and more for BI students.",
        keywords: [
          "resources",
          "help",
          "support",
          "rules",
          "policy",
          "ressurser",
        ],
      },
    },
  },
  {
    path: "/safety",
    text: {
      no: {
        title: "Meld en bekymring",
        description:
          "Si fra om uønskede hendelser eller bekymringer. Alle skal være beskyttet.",
        keywords: [
          "varsling",
          "varsle",
          "trygghet",
          "bekymring",
          "trakassering",
          "si fra",
        ],
      },
      en: {
        title: "Report a concern",
        description:
          "Report unwanted incidents or concerns. Everyone should be protected.",
        keywords: [
          "safety",
          "report",
          "concern",
          "whistleblowing",
          "harassment",
          "varsling",
        ],
      },
    },
  },
  {
    path: "/press",
    text: {
      no: {
        title: "Presse og media",
        description:
          "Pressekontakt, logoer og retningslinjer for BI Studentorganisasjon.",
        keywords: [
          "presse",
          "media",
          "pressekontakt",
          "logo",
          "grafisk profil",
          "journalist",
        ],
      },
      en: {
        title: "Press and media",
        description:
          "Press contact, logos and brand guidelines for BI Student Organisation.",
        keywords: [
          "press",
          "media",
          "press contact",
          "logo",
          "brand guidelines",
          "journalist",
        ],
      },
    },
  },
  {
    path: "/privacy",
    text: {
      no: {
        title: "Personvernerklæring",
        description:
          "Hvordan BISO behandler personopplysninger i samsvar med GDPR og norsk personvernlovgivning.",
        keywords: [
          "personvern",
          "personvernerklæring",
          "gdpr",
          "personopplysninger",
        ],
      },
      en: {
        title: "Privacy policy",
        description:
          "How BISO processes personal data in accordance with GDPR and Norwegian privacy law.",
        keywords: [
          "privacy",
          "privacy policy",
          "gdpr",
          "personal data",
          "personvern",
        ],
      },
    },
  },
  {
    path: "/terms",
    text: {
      no: {
        title: "Kjøpsvilkår",
        description:
          "Vilkår for betaling, levering eller henting, angrerett og retur ved kjøp hos BISO.",
        keywords: [
          "kjøpsvilkår",
          "vilkår",
          "angrerett",
          "retur",
          "betaling",
          "levering",
        ],
      },
      en: {
        title: "Purchase terms",
        description:
          "Terms for payment, delivery or pickup, withdrawal rights and returns for purchases with BISO.",
        keywords: [
          "terms",
          "purchase terms",
          "refund",
          "returns",
          "payment",
          "delivery",
        ],
      },
    },
  },
];

/** "/" → "home", "/campus/bergen" → "campus-bergen". */
export function codedRowId(path: string): string {
  const id = path.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
  return id === "" ? "home" : id;
}

/**
 * One entry per page per locale. `skipPaths` drops pages that a servable
 * project page has taken over, so the same URL is not indexed twice.
 */
export function codedPageEntries(
  ctx: Pick<MapContext, "syncedAt">,
  skipPaths: ReadonlySet<string> = new Set()
): SearchEntry[] {
  return CODED_PAGES.filter((page) => !skipPaths.has(page.path)).flatMap(
    (page) =>
      SEARCH_LOCALES.map((locale) => {
        const { title, description, keywords } = page.text[locale];
        return {
          ...baseEntry(
            {
              type: "coded",
              rowId: codedRowId(page.path),
              locale,
              textLocale: locale,
              campusId: page.campusId ?? ALL_CAMPUSES,
              url: page.path,
            },
            ctx
          ),
          title,
          summary: description,
          body: description,
          keywords,
        };
      })
  );
}
