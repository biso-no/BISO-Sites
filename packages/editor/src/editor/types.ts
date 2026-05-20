// Core domain types for the BISO page editor.
// All mutations go through operations.ts; this file is pure types only.

export type BlockType =
  | "hero"
  | "marquee"
  | "text"
  | "quote"
  | "callout"
  | "twoCol"
  | "team"
  | "stats"
  | "timeline"
  | "image"
  | "gallery"
  | "video"
  | "events"
  | "jobs"
  | "news"
  | "cta"
  | "faq"
  | "contact"
  | "signup"
  | "featureGrid"
  | "partners"
  | "linkTileGrid"
  | "tabs"
  | "departmentGrid"
  | "documents"
  | "featuredCards"
  | "campusSelector"
  | "stepGrid"
  | "scrollRow"
  | "productGrid"
  | "filterBar"
  | "profileHeader"
  | "multiStepForm";

// ── Per-block shapes ─────────────────────────────────────────────────────────

export interface HeroBlock {
  ctaLabel: string;
  ctaUrl: string;
  eyebrow: string;
  id: string;
  imageAlt?: string;
  subtitle: string;
  title: string;
  type: "hero";
  variant: "split" | "centered" | "full";
}

export interface MarqueeBlock {
  id: string;
  text: string;
  type: "marquee";
}

export interface TextBodyItem {
  text: string;
  type: "h" | "h3" | "p" | "li";
}

export interface TextBlock {
  body: TextBodyItem[];
  id: string;
  type: "text";
}

export interface QuoteBlock {
  author: string;
  id: string;
  role: string;
  text: string;
  type: "quote";
}

export interface CalloutBlock {
  body: string;
  id: string;
  title: string;
  tone: "info" | "warn" | "tip";
  type: "callout";
}

export interface TwoColBlock {
  id: string;
  left: string;
  right: string;
  type: "twoCol";
  variant?: "equal" | "leftWide" | "rightWide";
}

export interface TeamMember {
  hue: "claret" | "gold" | "leaf" | "sky";
  initials: string;
  name: string;
  role: string;
}

export interface TeamBlock {
  heading: string;
  id: string;
  members: TeamMember[];
  type: "team";
}

export interface StatItem {
  label: string;
  num: string;
}
export interface StatsBlock {
  id: string;
  items: StatItem[];
  type: "stats";
}

export interface TimelineItem {
  text: string;
  year: string;
}
export interface TimelineBlock {
  heading: string;
  id: string;
  items: TimelineItem[];
  type: "timeline";
}

export interface ImageBlock {
  aspect: string;
  caption: string;
  fileId?: string; // Appwrite "media" bucket file ID
  id: string;
  src?: string; // public view URL (set on upload) or external URL
  type: "image";
}

export interface GalleryImage {
  fileId?: string;
  src?: string;
}
export interface GalleryBlock {
  id: string;
  images: GalleryImage[];
  type: "gallery";
}

export interface VideoBlock {
  caption: string;
  fileId?: string; // Appwrite "media" bucket file ID
  id: string;
  type: "video";
  url?: string; // external URL or public view URL
}

export interface EventItem {
  date: string;
  going: number;
  title: string;
  where: string;
}

export interface EventsBlock {
  heading: string;
  id: string;
  items: EventItem[];
  /** "auto:<dept>:upcoming" or an Appwrite collection binding */
  source: string;
  type: "events";
}

export interface JobsBlock {
  heading: string;
  id: string;
  source?: string;
  type: "jobs";
}

export interface NewsBlock {
  heading: string;
  id: string;
  source?: string;
  type: "news";
}

export interface CtaBlock {
  id: string;
  label: string;
  title: string;
  type: "cta";
  url: string;
  variant?: "card" | "banner" | "gradient";
}

export interface FaqItem {
  a: string;
  q: string;
}
export interface FaqBlock {
  heading: string;
  id: string;
  items: FaqItem[];
  type: "faq";
  variant?: "list" | "accordion-themed";
}

export interface ContactCard {
  address?: string;
  email?: string;
  name: string;
  phone?: string;
  role: string;
}

export interface ContactBlock {
  address: string;
  email: string;
  heading: string;
  hours: string;
  id: string;
  instagram: string;
  members?: ContactCard[];
  type: "contact";
  variant?: "single" | "directory";
}

export interface SignupBlock {
  heading: string;
  id: string;
  placeholder: string;
  recipientEmail?: string;
  submitMode?: "email" | "database";
  topic?: string;
  type: "signup";
}

// ── New block shapes (Phase C) ────────────────────────────────────────────────

export interface FeatureGridItem {
  body: string;
  href?: string;
  icon: string;
  title: string;
}
export interface FeatureGridBlock {
  columns: 2 | 3 | 4;
  heading?: string;
  id: string;
  intro?: string;
  items: FeatureGridItem[];
  type: "featureGrid";
  variant?: "bordered" | "cards" | "minimal";
}

export interface PartnerItem {
  href?: string;
  logoFileId?: string;
  logoSrc?: string;
  name: string;
}
export interface PartnersBlock {
  heading?: string;
  id: string;
  items?: PartnerItem[];
  source: "auto" | "manual";
  type: "partners";
}

export interface LinkTileItem {
  description?: string;
  href: string;
  icon: string;
  title: string;
}
export interface LinkTileGridBlock {
  heading?: string;
  id: string;
  items: LinkTileItem[];
  type: "linkTileGrid";
}

export interface TabItem {
  body: string;
  label: string;
}
export interface TabsBlock {
  id: string;
  tabs: TabItem[];
  type: "tabs";
  variant?: "pills" | "underline" | "cards";
}

export interface DepartmentGridBlock {
  heading?: string;
  id: string;
  layout: "grid" | "list";
  showFilters: boolean;
  type: "departmentGrid";
}

export interface DocumentItem {
  fileId: string;
  size?: string;
  title: string;
}
export interface DocumentsBlock {
  heading?: string;
  id: string;
  items: DocumentItem[];
  type: "documents";
}

export interface FeaturedCardItem {
  body: string;
  eyebrow?: string;
  href?: string;
  stripeAccent: string;
  title: string;
}
export interface FeaturedCardsBlock {
  heading?: string;
  id: string;
  items: FeaturedCardItem[];
  type: "featuredCards";
}

export interface CampusSelectorBlock {
  heading?: string;
  id: string;
  mode: "switcher" | "cards";
  type: "campusSelector";
}

export interface StepGridItem {
  body: string;
  number: string;
  title: string;
}
export interface StepGridBlock {
  heading?: string;
  id: string;
  items: StepGridItem[];
  type: "stepGrid";
}

export interface ScrollRowItem {
  body: string;
  href?: string;
  icon?: string;
  title: string;
}
export interface ScrollRowBlock {
  heading?: string;
  id: string;
  items: ScrollRowItem[];
  type: "scrollRow";
}

export interface ProductGridBlock {
  heading?: string;
  id: string;
  source: "auto";
  tag?: string;
  type: "productGrid";
}

export interface FilterBarBlock {
  id: string;
  target: "news" | "jobs" | "units";
  type: "filterBar";
}

export interface ProfileHeaderBlock {
  heading?: string;
  id: string;
  showAvatar: boolean;
  showStats: boolean;
  type: "profileHeader";
}

export type FormFieldType =
  | "checkbox"
  | "email"
  | "hidden"
  | "radio"
  | "select"
  | "text"
  | "textarea";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  fieldType: FormFieldType;
  label: string;
  name: string;
  options?: FormFieldOption[];
  placeholder?: string;
  required?: boolean;
}

export interface FormStep {
  fields: FormField[];
  title: string;
}

export interface MultiStepFormBlock {
  accessTeamId?: string;
  adminLabel?: string;
  heading?: string;
  id: string;
  recipientEmail?: string;
  steps: FormStep[];
  submitMode?: "email" | "database";
  submitTarget: { collection: string; topic?: string };
  type: "multiStepForm";
}

export type Block =
  | HeroBlock
  | MarqueeBlock
  | TextBlock
  | QuoteBlock
  | CalloutBlock
  | TwoColBlock
  | TeamBlock
  | StatsBlock
  | TimelineBlock
  | ImageBlock
  | GalleryBlock
  | VideoBlock
  | EventsBlock
  | JobsBlock
  | NewsBlock
  | CtaBlock
  | FaqBlock
  | ContactBlock
  | SignupBlock
  | FeatureGridBlock
  | PartnersBlock
  | LinkTileGridBlock
  | TabsBlock
  | DepartmentGridBlock
  | DocumentsBlock
  | FeaturedCardsBlock
  | CampusSelectorBlock
  | StepGridBlock
  | ScrollRowBlock
  | ProductGridBlock
  | FilterBarBlock
  | ProfileHeaderBlock
  | MultiStepFormBlock;

// ── Page document ────────────────────────────────────────────────────────────

export interface PageMeta {
  accentColor: string;
  department: string;
  description?: string;
  slug: string;
  status: "draft" | "published";
  title: string;
}

export interface PageDoc {
  blocks: Block[];
  meta: PageMeta;
}

// ── Editor UI state (not persisted) ─────────────────────────────────────────

export type EditorMode = "edit" | "preview";
export type EditorViewport = "desk" | "tab" | "mob";
export type SavingState = "idle" | "pending" | "saved" | "error";

// ── Host-provided data types ─────────────────────────────────────────────────

export interface EditorDepartment {
  id: string;
  name: string;
}

export type EditorLocale = "no" | "en";

export interface EditorLocaleOption {
  hasDraft: boolean;
  label: string;
  locale: EditorLocale;
}
