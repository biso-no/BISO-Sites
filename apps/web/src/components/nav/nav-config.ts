import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  Flame,
  Gavel,
  Gift,
  GraduationCap,
  History,
  Info,
  Landmark,
  type LucideIcon,
  Mail,
  Newspaper,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
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

/** Static columns for the "For Studenter" panel (the Campus column is dynamic). */
export const STUDENT_COLUMNS: NavColumnConfig[] = [
  {
    id: "membership",
    headingKey: "columns.membership",
    links: [
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
        href: "/shop/membership",
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
        id: "bi-fondet",
        labelKey: "links.biFondet",
        href: "/bi-fondet",
        icon: Landmark,
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
    ],
  },
];
