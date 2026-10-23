import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Gift,
  GraduationCap,
  History,
  Info,
  Landmark,
  type LucideIcon,
  Mail,
  Newspaper,
  PiggyBank,
  Receipt,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
  Wine,
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

/**
 * Routes whose page still opens on plain light content, so they get the solid
 * header from the first paint. Each entry matches itself and everything nested
 * below it.
 *
 * The header is transparent until the page scrolls, and its controls are drawn
 * for the navy surface. Every redesigned page opens on a navy band — a
 * `PageHeader`, a `deep` section, or a paper `Section clearNav`, which paints
 * the header's own height in navy — so the list is only for pages that do none
 * of those. Of the six routes it held before the merge, five open on a
 * `PageHeader` now (`/about/academics-contact`, `/applications`, `/profile`,
 * the approver's `/fs/approve`) or are a redirect (`/policies/drugs-policy`).
 * The one left is the expense composer: its split view sizes both panes to
 * the viewport under the header, so it has no band to open on, and without an
 * entry here its header was white on white.
 */
export const SOLID_NAV_ROUTES: readonly string[] = ["/fs/new"];

export function hasSolidNavRoute(pathname: string): boolean {
  return SOLID_NAV_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/** Panel triggers rendered in the desktop trigger row, in display order. */
export const PANEL_TRIGGERS: { id: PanelId; labelKey: string }[] = [
  { id: "students", labelKey: "triggers.students" },
  { id: "projects", labelKey: "triggers.projects" },
  { id: "about", labelKey: "triggers.about" },
];

/**
 * Standalone (non-panel) links shown beside the triggers, and listed in the
 * mobile drawer.
 *
 * Business is one of them because the About panel no longer carries the
 * business links: they left it when "Om BISO" was merged into one page, and
 * keep a header entry of their own instead. Business Hotspot is reached from
 * the business page.
 */
export const STANDALONE_LINKS: NavLinkConfig[] = [
  { id: "news", labelKey: "news", href: "/news", icon: Newspaper },
  { id: "shop", labelKey: "shop", href: "/shop", icon: ShoppingBag },
  { id: "business", labelKey: "partner", href: "/business", icon: Building2 },
];

/** Key of the overflow ("…") trigger in the measured desktop row. */
export const OVERFLOW_TRIGGER_KEY = "overflow";

/**
 * The desktop row items that may be surrendered to the overflow menu when the
 * row runs out of room, **ordered by drop priority** — index 0 goes first.
 *
 * Only the standalone links collapse. Everything else is load-bearing: the
 * logo, the three mega-panel triggers, and the utility group (campus, locale,
 * theme, cart, the membership CTA and the account menu), which sits outside
 * the measured row altogether. The row is only ever collapsed far enough to
 * fit, so on a wide viewport none of this applies.
 *
 * Business goes first, as the "Partner" button did before it: it is the entry
 * aimed least at students. News goes last.
 */
export const NAV_OVERFLOW_DROP_ORDER: readonly string[] = [
  "business",
  "shop",
  "news",
];

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
        href: "/about#studiekvalitet",
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

/**
 * Flagship project keys. Titles/slugs are resolved against the existing
 * `projects.featured.<key>` message bundle (title + slug fields).
 */
export const PROJECT_FLAGSHIP_KEYS = [
  "fadderullan",
  "winterGames",
  "karrieredagene",
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
        href: "/about#historie",
        icon: History,
      },
      {
        id: "operations",
        labelKey: "links.operations",
        href: "/about#drift",
        icon: Building2,
      },
      {
        id: "alumni",
        labelKey: "links.alumni",
        href: "/about#alumni",
        icon: GraduationCap,
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
        href: "/about#politikk",
        icon: Landmark,
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
        href: "/about/drugs-policy",
        icon: Wine,
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
        id: "press",
        labelKey: "links.press",
        href: "/press",
        icon: Newspaper,
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
