import type { ComponentData, Config } from "@puckeditor/core";

/**
 * Content type definition.
 * Each content type describes a kind of page with recommended blocks,
 * a starter template, and metadata for the content type picker UI.
 */
export type ContentTypeDefinition = {
  /** Unique key for this content type */
  key: string;
  /** Human-readable name */
  name: string;
  /** Short description shown in the picker */
  description: string;
  /** Lucide icon name for the picker UI */
  icon: string;
  /** Content family */
  family: "page" | "policy" | "article";
  /** Block component names shown first in the sidebar "Recommended" section */
  suggestedBlocks: string[];
  /** Block component names hidden for this type (if any) */
  restrictedBlocks?: string[];
  /** Build the starter template blocks for this content type */
  buildStarter: (config: Config) => ComponentData[];
  /** Default root field values */
  rootDefaults?: Record<string, unknown>;
};

// ─── Helpers ─────────────────────────────────────────────────────────

function createId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function buildItem(
  config: Config,
  type: string,
  props: Record<string, unknown> = {}
): ComponentData {
  const defaults =
    (config.components?.[type]?.defaultProps as Record<string, unknown>) ?? {};
  return {
    type,
    props: {
      ...defaults,
      ...props,
      id: createId(type),
    },
  } as ComponentData;
}

// ─── Content Type Definitions ────────────────────────────────────────

const homepage: ContentTypeDefinition = {
  key: "homepage",
  name: "Homepage",
  description:
    "Main landing page with hero carousel, featured content, and highlights",
  icon: "Home",
  family: "page",
  suggestedBlocks: [
    "Hero",
    "About",
    "Events",
    "News",
    "JoinUs",
    "LogoGrid",
    "FeatureGrid",
    "StatsGrid",
  ],
  buildStarter: (cfg) => [
    buildItem(cfg, "Hero", {
      layout: "carousel",
      title: "Welcome",
      subtitle: "Your student organization",
      buttons: [
        { label: "Explore Events", href: "/events", variant: "gradient" },
        { label: "Join Us", href: "/membership", variant: "outline" },
      ],
    }),
    buildItem(cfg, "StatsGrid", {
      title: "By the numbers",
      columns: 4,
      variant: "card",
      items: [
        { value: "5000+", label: "Students", icon: "Users" },
        { value: "200+", label: "Events/year", icon: "Calendar" },
        { value: "30+", label: "Organizations", icon: "Building2" },
        { value: "10", label: "Campuses", icon: "MapPin" },
      ],
    }),
    buildItem(cfg, "FeatureGrid", {
      title: "What we do",
      subtitle: "Empowering students across the country",
      columns: 3,
      variant: "icon",
      items: [
        {
          title: "Community",
          description: "Connect with fellow students",
          icon: "Heart",
        },
        {
          title: "Events",
          description: "Unforgettable experiences",
          icon: "Calendar",
        },
        {
          title: "Career",
          description: "Professional development",
          icon: "Briefcase",
        },
      ],
    }),
    buildItem(cfg, "Events", { dataMode: "dynamic", scope: "all" }),
    buildItem(cfg, "News", { dataMode: "dynamic", scope: "all" }),
    buildItem(cfg, "JoinUs"),
    buildItem(cfg, "LogoGrid", {
      title: "Our partners",
      variant: "bordered",
      grayscale: true,
    }),
  ],
  rootDefaults: {
    contentType: "homepage",
    visibility: "public",
  },
};

const newsListing: ContentTypeDefinition = {
  key: "news-listing",
  name: "News Listing",
  description: "Browse and filter news articles",
  icon: "Newspaper",
  family: "page",
  suggestedBlocks: ["PageHeader", "FilterBar", "News", "CTA"],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "News & Updates",
      subtitle: "Stay informed with the latest from our community.",
      variant: "centered",
      breadcrumbs: [{ label: "News", href: "/news" }],
    }),
    buildItem(cfg, "FilterBar"),
    buildItem(cfg, "News", {
      dataMode: "dynamic",
      scope: "all",
      dataSource: { table: "news", limit: 12 },
    }),
    buildItem(cfg, "Spacer", { size: "lg" }),
  ],
  rootDefaults: { contentType: "news-listing", visibility: "public" },
};

const newsArticle: ContentTypeDefinition = {
  key: "news-article",
  name: "News Article",
  description: "Single news story with rich content",
  icon: "FileText",
  family: "article",
  suggestedBlocks: ["ArticleDetail", "RichText", "Image", "CTA"],
  buildStarter: (cfg) => [
    buildItem(cfg, "ArticleDetail", {
      showRelated: true,
      layout: "standard",
    }),
  ],
  rootDefaults: { contentType: "news-article", visibility: "public" },
};

const eventsListing: ContentTypeDefinition = {
  key: "events-listing",
  name: "Events Listing",
  description: "Calendar or grid view of upcoming events",
  icon: "CalendarDays",
  family: "page",
  suggestedBlocks: ["PageHeader", "EventsCalendar", "Events", "FilterBar"],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "Events",
      subtitle: "Discover what's happening next.",
      variant: "centered",
      breadcrumbs: [{ label: "Events", href: "/events" }],
    }),
    buildItem(cfg, "EventsCalendar", {
      view: "list",
      showFilters: true,
      dataMode: "dynamic",
      dataSource: { table: "events", limit: 20 },
    }),
    buildItem(cfg, "Spacer", { size: "lg" }),
  ],
  rootDefaults: { contentType: "events-listing", visibility: "public" },
};

const eventDetail: ContentTypeDefinition = {
  key: "event-detail",
  name: "Event Detail",
  description: "Single event page with registration and details",
  icon: "CalendarCheck",
  family: "page",
  suggestedBlocks: ["EventDetail", "MapEmbed", "CTA"],
  buildStarter: (cfg) => [
    buildItem(cfg, "EventDetail", {
      showRegistration: true,
      showMap: false,
    }),
  ],
  rootDefaults: { contentType: "event-detail", visibility: "public" },
};

const jobsListing: ContentTypeDefinition = {
  key: "jobs-listing",
  name: "Jobs & Positions",
  description: "Job listings with filters and search",
  icon: "Briefcase",
  family: "page",
  suggestedBlocks: ["Hero", "JobsList", "FilterBar", "StatsGrid", "CTA"],
  buildStarter: (cfg) => [
    buildItem(cfg, "Hero", {
      layout: "center",
      title: "Open Positions",
      subtitle: "Find your next opportunity with us.",
      buttons: [],
    }),
    buildItem(cfg, "StatsGrid", {
      columns: 3,
      variant: "simple",
      items: [
        { value: "0", label: "Open positions", icon: "Briefcase" },
        { value: "0", label: "Departments hiring", icon: "Building2" },
        { value: "0", label: "Paid roles", icon: "Banknote" },
      ],
    }),
    buildItem(cfg, "FilterBar"),
    buildItem(cfg, "JobsList", {
      dataMode: "dynamic",
      scope: "all",
      dataSource: { table: "jobs", limit: 20 },
    }),
    buildItem(cfg, "Spacer", { size: "lg" }),
  ],
  rootDefaults: { contentType: "jobs-listing", visibility: "public" },
};

const jobDetail: ContentTypeDefinition = {
  key: "job-detail",
  name: "Job Detail",
  description: "Single job position page with details and apply CTA",
  icon: "FileCheck",
  family: "page",
  suggestedBlocks: ["PageHeader", "RichText", "CTA", "ButtonRow"],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "Position Title",
      subtitle: "Department / Location",
      variant: "default",
    }),
    buildItem(cfg, "RichText", {
      content: "Job description and requirements go here...",
      variant: "default",
    }),
    buildItem(cfg, "CTA", {
      title: "Interested?",
      description: "Apply for this position and join our team.",
      variant: "brand",
      buttons: [{ label: "Apply Now", href: "#", variant: "secondary" }],
    }),
  ],
  rootDefaults: { contentType: "job-detail", visibility: "public" },
};

const departmentListing: ContentTypeDefinition = {
  key: "department-listing",
  name: "Departments & Units",
  description: "Browse all student organizations and departments",
  icon: "Building2",
  family: "page",
  suggestedBlocks: ["Hero", "DepartmentsGrid", "FilterBar", "CTA"],
  buildStarter: (cfg) => [
    buildItem(cfg, "Hero", {
      layout: "center",
      title: "Our Organizations",
      subtitle: "Explore student-run groups and committees.",
    }),
    buildItem(cfg, "DepartmentsGrid", {
      dataMode: "dynamic",
      showFilters: true,
      columns: 3,
      dataSource: { table: "departments", limit: 30 },
    }),
    buildItem(cfg, "CTA", {
      title: "Want to start a new organization?",
      description: "Learn how to establish your own student group.",
      variant: "default",
    }),
  ],
  rootDefaults: { contentType: "department-listing", visibility: "public" },
};

const departmentDetail: ContentTypeDefinition = {
  key: "department-detail",
  name: "Department Detail",
  description: "Department page with overview, news, team, and products",
  icon: "Users",
  family: "page",
  suggestedBlocks: [
    "Hero",
    "Tabs",
    "FeatureGrid",
    "TeamGrid",
    "News",
    "ProductsGrid",
    "CTA",
  ],
  buildStarter: (cfg) => [
    buildItem(cfg, "Hero", {
      layout: "split",
      title: "Department Name",
      subtitle: "A brief description of what this department does.",
      buttons: [
        { label: "Join us", href: "#", variant: "gradient" },
        { label: "Contact", href: "#", variant: "outline" },
      ],
    }),
    buildItem(cfg, "FeatureGrid", {
      title: "What we do",
      columns: 3,
      variant: "icon",
      items: [
        { title: "Activity 1", description: "Description", icon: "Star" },
        { title: "Activity 2", description: "Description", icon: "Zap" },
        { title: "Activity 3", description: "Description", icon: "Target" },
      ],
    }),
    buildItem(cfg, "TeamGrid", {
      title: "Our Team",
      columns: 3,
      variant: "card",
      members: [],
    }),
    buildItem(cfg, "News", {
      title: "Latest Updates",
      dataMode: "dynamic",
      scope: "page",
    }),
    buildItem(cfg, "CTA", {
      title: "Want to get involved?",
      description: "Join our team and help shape the community.",
      variant: "brand",
    }),
  ],
  rootDefaults: { contentType: "department-detail", visibility: "public" },
};

const shop: ContentTypeDefinition = {
  key: "shop",
  name: "Shop / Products",
  description: "Product catalog with categories and filters",
  icon: "ShoppingBag",
  family: "page",
  suggestedBlocks: ["PageHeader", "ProductsGrid", "FilterBar"],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "Shop",
      subtitle: "Browse our merchandise, tickets, and more.",
      variant: "centered",
    }),
    buildItem(cfg, "FilterBar"),
    buildItem(cfg, "ProductsGrid", {
      dataMode: "dynamic",
      scope: "all",
      dataSource: { table: "products", limit: 20 },
    }),
    buildItem(cfg, "Spacer", { size: "lg" }),
  ],
  rootDefaults: { contentType: "shop", visibility: "public" },
};

const productDetail: ContentTypeDefinition = {
  key: "product-detail",
  name: "Product Detail",
  description: "Single product page with images, pricing, and details",
  icon: "Package",
  family: "page",
  suggestedBlocks: [
    "PageHeader",
    "Image",
    "RichText",
    "ButtonRow",
    "ProductsGrid",
  ],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "Product Name",
      subtitle: "Category",
      variant: "default",
    }),
    buildItem(cfg, "RichText", {
      content: "Product description, features, and details...",
    }),
    buildItem(cfg, "ButtonRow", {
      buttons: [{ label: "Add to Cart", href: "#", variant: "gradient" }],
    }),
    buildItem(cfg, "ProductsGrid", {
      title: "You might also like",
      dataMode: "dynamic",
      dataSource: { table: "products", limit: 4 },
    }),
  ],
  rootDefaults: { contentType: "product-detail", visibility: "public" },
};

const membership: ContentTypeDefinition = {
  key: "membership",
  name: "Membership",
  description: "Membership plans, benefits, and pricing comparison",
  icon: "CreditCard",
  family: "page",
  suggestedBlocks: ["Hero", "PricingTable", "FeatureGrid", "Accordion", "CTA"],
  buildStarter: (cfg) => [
    buildItem(cfg, "Hero", {
      layout: "center",
      title: "Become a Member",
      subtitle: "Unlock exclusive benefits, discounts, and experiences.",
      buttons: [{ label: "Join Now", href: "#", variant: "gradient" }],
    }),
    buildItem(cfg, "PricingTable", {
      plans: [
        {
          name: "Semester",
          price: "149",
          currency: "kr",
          period: "semester",
          features: [
            "Event discounts",
            "Member prices in shop",
            "Community access",
          ],
          highlighted: false,
        },
        {
          name: "Full Year",
          price: "249",
          currency: "kr",
          period: "year",
          features: [
            "Everything in Semester",
            "Priority event access",
            "Exclusive merch",
          ],
          highlighted: true,
        },
      ],
    }),
    buildItem(cfg, "FeatureGrid", {
      title: "Member Benefits",
      columns: 3,
      variant: "card",
      items: [
        {
          title: "Discounts",
          description: "Save on events and products",
          icon: "Percent",
        },
        {
          title: "Priority Access",
          description: "First in line for events",
          icon: "Zap",
        },
        {
          title: "Community",
          description: "Join exclusive groups",
          icon: "Users",
        },
      ],
    }),
    buildItem(cfg, "Accordion", {
      title: "Frequently Asked Questions",
      items: [
        {
          title: "How do I become a member?",
          content: "Sign up through our member portal.",
        },
        {
          title: "Can I cancel my membership?",
          content: "Memberships are non-refundable but transferable.",
        },
      ],
    }),
  ],
  rootDefaults: { contentType: "membership", visibility: "public" },
};

const aboutInfo: ContentTypeDefinition = {
  key: "about-info",
  name: "About / Info Page",
  description: "General information page with rich content and navigation",
  icon: "Info",
  family: "page",
  suggestedBlocks: [
    "PageHeader",
    "RichText",
    "TableOfContents",
    "Accordion",
    "Image",
  ],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "About Us",
      subtitle: "Learn more about our organization.",
      variant: "default",
      breadcrumbs: [{ label: "About" }],
    }),
    buildItem(cfg, "TableOfContents"),
    buildItem(cfg, "RichText", {
      content:
        "Page content goes here. Use headings to create sections that appear in the table of contents.",
      variant: "default",
    }),
    buildItem(cfg, "Spacer", { size: "md" }),
  ],
  rootDefaults: { contentType: "about-info", visibility: "public" },
};

const policyLegal: ContentTypeDefinition = {
  key: "policy-legal",
  name: "Policy / Legal Document",
  description: "Structured document for bylaws, policies, and regulations",
  icon: "Scale",
  family: "policy",
  suggestedBlocks: ["PageHeader", "TableOfContents", "RichText"],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "Document Title",
      subtitle: "Effective from [date]",
      variant: "default",
      breadcrumbs: [{ label: "Policies" }],
    }),
    buildItem(cfg, "TableOfContents"),
    buildItem(cfg, "RichText", {
      content: "Document content with sections and subsections...",
      variant: "legal",
    }),
    buildItem(cfg, "Spacer", { size: "md" }),
  ],
  rootDefaults: { contentType: "policy-legal", visibility: "public" },
};

const contact: ContentTypeDefinition = {
  key: "contact",
  name: "Contact Page",
  description: "Contact form with office info and map",
  icon: "Mail",
  family: "page",
  suggestedBlocks: ["PageHeader", "ContactForm", "MapEmbed", "FeatureGrid"],
  buildStarter: (cfg) => [
    buildItem(cfg, "PageHeader", {
      title: "Contact Us",
      subtitle: "We'd love to hear from you.",
      variant: "centered",
    }),
    buildItem(cfg, "ContactForm", {
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "subject", label: "Subject", type: "text", required: true },
        { name: "message", label: "Message", type: "textarea", required: true },
      ],
      contactCards: [
        { title: "Email", value: "post@example.org", icon: "Mail" },
        { title: "Phone", value: "+47 123 45 678", icon: "Phone" },
        { title: "Address", value: "Campus Address, City", icon: "MapPin" },
      ],
    }),
  ],
  rootDefaults: { contentType: "contact", visibility: "public" },
};

const custom: ContentTypeDefinition = {
  key: "custom",
  name: "Custom Page",
  description: "Start from a blank canvas with all blocks available",
  icon: "Palette",
  family: "page",
  suggestedBlocks: [],
  buildStarter: () => [],
  rootDefaults: { contentType: "custom", visibility: "public" },
};

// ─── Registry ────────────────────────────────────────────────────────

export const CONTENT_TYPES: ContentTypeDefinition[] = [
  homepage,
  newsListing,
  newsArticle,
  eventsListing,
  eventDetail,
  jobsListing,
  jobDetail,
  departmentListing,
  departmentDetail,
  shop,
  productDetail,
  membership,
  aboutInfo,
  policyLegal,
  contact,
  custom,
];

export const CONTENT_TYPE_MAP = new Map(
  CONTENT_TYPES.map((ct) => [ct.key, ct])
);

/**
 * Get a content type definition by its key.
 */
export function getContentType(key: string): ContentTypeDefinition | undefined {
  return CONTENT_TYPE_MAP.get(key);
}

/**
 * Options for the root "Content Type" select field in the Puck editor.
 */
export const CONTENT_TYPE_OPTIONS = CONTENT_TYPES.map((ct) => ({
  label: ct.name,
  value: ct.key,
}));

/**
 * Get suggested blocks for a given content type.
 * Returns the suggestedBlocks array or an empty array for unknown types.
 */
export function getSuggestedBlocks(contentTypeKey: string): string[] {
  return CONTENT_TYPE_MAP.get(contentTypeKey)?.suggestedBlocks ?? [];
}

/**
 * Get restricted blocks for a given content type.
 * Returns blocks that should be hidden from the sidebar.
 */
export function getRestrictedBlocks(contentTypeKey: string): string[] {
  return CONTENT_TYPE_MAP.get(contentTypeKey)?.restrictedBlocks ?? [];
}

/**
 * Build the starter template for a content type.
 */
export function buildStarterTemplate(
  contentTypeKey: string,
  config: Config
): ComponentData[] {
  const ct = CONTENT_TYPE_MAP.get(contentTypeKey);
  if (!ct) {
    return [];
  }
  return ct.buildStarter(config);
}
