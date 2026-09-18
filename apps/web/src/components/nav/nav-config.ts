import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Flame,
  Gavel,
  Gift,
  GraduationCap,
  History,
  Info,
  Landmark,
  type LucideIcon,
  Mail,
  Megaphone,
  Newspaper,
  PiggyBank,
  Receipt,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

export type PanelId = "students" | "projects" | "about";

export interface NavLinkConfig {
  href: string;
  icon?: LucideIcon;
  /** Stable id for React keys. */
  id: string;
  /** i18n key resolved against the `common.navigation` namespace. */
  labelKey: string;
}

export interface NavColumnConfig {
  /** i18n key resolved against the `common.navigation` namespace. */
  headingKey: string;
  id: string;
  links: NavLinkConfig[];
}

/** Panel triggers rendered in the desktop trigger row, in display order. */
/**
 * Routes that open on plain page content rather than a dark full-bleed hero.
 * The nav is transparent with white text until the page scrolls, which is
 * unreadable on a light background, so these routes get the solid nav from
 * the first paint. Each entry matches itself and everything nested below it.
 * Add a route here when its page does not start with a hero image.
 */
export const SOLID_NAV_ROUTES: readonly string[] = [
  "/about/academics-contact",
  "/applications",
  "/fs/approve",
  "/fs/new",
  "/policies",
  "/profile",
];

export function hasSolidNavRoute(pathname: string): boolean {
  return SOLID_NAV_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export const PANEL_TRIGGERS: { id: PanelId; labelKey: string }[] = [
  { id: "students", labelKey: "triggers.students" },
  { id: "projects", labelKey: "triggers.projects" },
  { id: "about", labelKey: "triggers.about" },
];

/** Standalone (non-panel) links shown beside the triggers. */
export const STANDALONE_LINKS: NavLinkConfig[] = [
  { id: "news", labelKey: "news", href: "/news", icon: Newspaper },
  { id: "shop", labelKey: "shop", href: "/shop", icon: ShoppingBag },
];

/** Key of the overflow ("…") trigger in the measured desktop row. */
export const OVERFLOW_TRIGGER_KEY = "overflow";

/**
 * The desktop row items that may be surrendered to the overflow menu when the
 * row runs out of room, **ordered by drop priority** — index 0 goes first.
 *
 * Everything absent from this list is load-bearing and never collapses: the
 * logo, the three mega-panel triggers, the campus/theme/locale/cart controls,
 * the membership CTA and the account menu. The row is only ever collapsed far
 * enough to fit, so on a wide viewport none of this applies.
 *
 * `memberPortal` is dropped early on purpose — it is the one entry that stays
 * reachable after it goes, from the account menu (`account-member-portal`
 * below), so losing it from the row costs the least.
 */
export const NAV_OVERFLOW_DROP_ORDER: readonly string[] = [
  "applyVerv",
  "partner",
  "memberPortal",
  "shop",
  "news",
];

/**
 * Entries of {@link NAV_OVERFLOW_DROP_ORDER} that only exist for signed-in
 * visitors, and so must be dropped from the drop order for everyone else — an
 * item the row never renders must not be counted as one the row could give up.
 */
export const AUTH_ONLY_OVERFLOW_KEYS: readonly string[] = ["memberPortal"];

/** Static columns for the "For Studenter" panel (the Campus column is dynamic). */
export const STUDENT_COLUMNS: NavColumnConfig[] = [
  {
    id: "membership",
    headingKey: "columns.membership",
    links: [
      {
        id: "students-overview",
        labelKey: "links.studentsOverview",
        href: "/students",
        icon: GraduationCap,
      },
      {
        id: "membership-overview",
        labelKey: "links.membershipOverview",
        href: "/membership",
        icon: BadgeCheck,
      },
      {
        id: "membership-benefits",
        labelKey: "links.membershipBenefits",
        href: "/membership#fordeler",
        icon: Gift,
      },
      {
        id: "membership-buy",
        labelKey: "links.buyMembership",
        href: "/membership/join",
        icon: CreditCard,
      },
    ],
  },
  {
    id: "resources",
    headingKey: "columns.resources",
    links: [
      { id: "units", labelKey: "links.units", href: "/units", icon: Users },
      { id: "jobs", labelKey: "links.jobs", href: "/jobs", icon: Briefcase },
      {
        id: "funding-support",
        labelKey: "links.fundingSupport",
        href: "/okonomisk-stotte",
        icon: PiggyBank,
      },
      {
        id: "study-quality",
        labelKey: "links.studyQuality",
        href: "/about/study-quality",
        icon: GraduationCap,
      },
      {
        id: "resources",
        labelKey: "links.resources",
        href: "/resources",
        icon: BookOpen,
      },
    ],
  },
];

/** i18n key for the dynamic Campus column heading in the students panel. */
export const STUDENT_CAMPUS_HEADING_KEY = "columns.campus";

/**
 * Flagship project keys. Titles/slugs are resolved against the existing
 * `projects.featured.<key>` message bundle (title + slug fields).
 */
export const PROJECT_FLAGSHIP_KEYS = [
  "fadderullan",
  "winterGames",
  "karrieredagene",
  "inspire",
] as const;

export const PROJECT_FLAGSHIP_ICON: LucideIcon = Sparkles;

/** Extra (non-flagship) links for the "Prosjekter" panel. */
export const PROJECT_LINKS: NavLinkConfig[] = [
  {
    id: "all-events",
    labelKey: "links.allEvents",
    href: "/events",
    icon: Calendar,
  },
];

/** Columns for the "Om BISO" panel. */
export const ABOUT_COLUMNS: NavColumnConfig[] = [
  {
    id: "organisation",
    headingKey: "columns.organisation",
    links: [
      { id: "about", labelKey: "links.aboutBiso", href: "/about", icon: Info },
      {
        id: "history",
        labelKey: "links.history",
        href: "/about/history",
        icon: History,
      },
      {
        id: "operations",
        labelKey: "links.operations",
        href: "/about/operations",
        icon: Building2,
      },
      {
        id: "alumni",
        labelKey: "links.alumni",
        href: "/about/alumni",
        icon: Users,
      },
    ],
  },
  {
    id: "policy",
    headingKey: "columns.policy",
    links: [
      {
        id: "politics",
        labelKey: "links.politics",
        href: "/about/politics",
        icon: Landmark,
      },
      {
        id: "bylaws",
        labelKey: "links.bylaws",
        href: "/about/bylaws",
        icon: Gavel,
      },
      {
        id: "documents",
        labelKey: "links.documents",
        href: "/documents",
        icon: FileText,
      },
      {
        id: "drugs-policy",
        labelKey: "links.drugsPolicy",
        href: "/policies/drugs-policy",
        icon: ShieldAlert,
      },
      {
        id: "safety",
        labelKey: "links.safety",
        href: "/safety",
        icon: ShieldAlert,
      },
    ],
  },
  {
    id: "contact",
    headingKey: "columns.contact",
    links: [
      {
        id: "contact",
        labelKey: "links.contact",
        href: "/contact",
        icon: Mail,
      },
      {
        id: "business",
        labelKey: "links.business",
        href: "/business",
        icon: Briefcase,
      },
      {
        id: "business-hotspot",
        labelKey: "links.businessHotspot",
        href: "/business-hotspot",
        icon: Flame,
      },
      {
        id: "press",
        labelKey: "links.press",
        href: "/press",
        icon: Megaphone,
      },
    ],
  },
];

/**
 * Personal links shown in the signed-in account menu (desktop dropdown and the
 * "Min konto" section of the mobile drawer), in display order.
 *
 * These routes live under `(protected)/` and have no other entry point in the
 * site — the account menu is how users find them.
 */
export const ACCOUNT_LINKS: NavLinkConfig[] = [
  {
    id: "account-profile",
    labelKey: "account.myProfile",
    href: "/profile",
    icon: UserRound,
  },
  {
    id: "account-applications",
    labelKey: "account.myApplications",
    href: "/applications",
    icon: FileText,
  },
  {
    id: "account-financial-services",
    labelKey: "account.financialServices",
    href: "/fs",
    icon: Receipt,
  },
  {
    id: "account-member-portal",
    labelKey: "memberPortal",
    href: "/member",
    icon: Sparkles,
  },
];

/**
 * Id of the entry gated on the `expenses_module` feature flag — filtered out of
 * {@link ACCOUNT_LINKS} when `NavAccount.showFinancialServices` is false, so we
 * never advertise a route that renders `<ExpensesUnavailable />`.
 */
export const FINANCIAL_SERVICES_LINK_ID = "account-financial-services";
