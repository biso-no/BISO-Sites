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
  | "signup";

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
}

export interface ContactBlock {
  address: string;
  email: string;
  heading: string;
  hours: string;
  id: string;
  instagram: string;
  type: "contact";
}

export interface SignupBlock {
  heading: string;
  id: string;
  placeholder: string;
  type: "signup";
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
  | SignupBlock;

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
