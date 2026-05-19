// Core domain types for the BISO page editor.
// All mutations go through operations.ts; this file is pure types only.

export type BlockType =
  | "hero" | "marquee"
  | "text" | "quote" | "callout" | "twoCol"
  | "team" | "stats" | "timeline"
  | "image" | "gallery" | "video"
  | "events" | "jobs" | "news"
  | "cta" | "faq" | "contact" | "signup";

// ── Per-block shapes ─────────────────────────────────────────────────────────

export interface HeroBlock {
  id: string; type: "hero"; variant: "split" | "centered" | "full";
  eyebrow: string; title: string; subtitle: string;
  ctaLabel: string; ctaUrl: string; imageAlt?: string;
}

export interface MarqueeBlock {
  id: string; type: "marquee"; text: string;
}

export interface TextBodyItem {
  type: "h" | "h3" | "p" | "li";
  text: string;
}

export interface TextBlock {
  id: string; type: "text"; body: TextBodyItem[];
}

export interface QuoteBlock {
  id: string; type: "quote"; text: string; author: string; role: string;
}

export interface CalloutBlock {
  id: string; type: "callout"; tone: "info" | "warn" | "tip";
  title: string; body: string;
}

export interface TwoColBlock {
  id: string; type: "twoCol"; left: string; right: string;
}

export interface TeamMember {
  name: string; role: string; initials: string;
  hue: "claret" | "gold" | "leaf" | "sky";
}

export interface TeamBlock {
  id: string; type: "team"; heading: string; members: TeamMember[];
}

export interface StatItem { num: string; label: string; }
export interface StatsBlock {
  id: string; type: "stats"; items: StatItem[];
}

export interface TimelineItem { year: string; text: string; }
export interface TimelineBlock {
  id: string; type: "timeline"; heading: string; items: TimelineItem[];
}

export interface ImageBlock {
  id: string; type: "image"; caption: string; aspect: string;
  fileId?: string;  // Appwrite "media" bucket file ID
  src?: string;     // public view URL (set on upload) or external URL
}

export interface GalleryImage { fileId?: string; src?: string; }
export interface GalleryBlock {
  id: string; type: "gallery"; images: GalleryImage[];
}

export interface VideoBlock {
  id: string; type: "video"; caption: string;
  fileId?: string;  // Appwrite "media" bucket file ID
  url?: string;     // external URL or public view URL
}

export interface EventItem {
  date: string; title: string; where: string; going: number;
}

export interface EventsBlock {
  id: string; type: "events"; heading: string;
  /** "auto:<dept>:upcoming" or an Appwrite collection binding */
  source: string;
  items: EventItem[];
}

export interface JobsBlock {
  id: string; type: "jobs"; heading: string; source?: string;
}

export interface NewsBlock {
  id: string; type: "news"; heading: string; source?: string;
}

export interface CtaBlock {
  id: string; type: "cta"; title: string; label: string; url: string;
}

export interface FaqItem { q: string; a: string; }
export interface FaqBlock {
  id: string; type: "faq"; heading: string; items: FaqItem[];
}

export interface ContactBlock {
  id: string; type: "contact"; heading: string;
  email: string; instagram: string; address: string; hours: string;
}

export interface SignupBlock {
  id: string; type: "signup"; heading: string; placeholder: string;
}

export type Block =
  | HeroBlock | MarqueeBlock | TextBlock | QuoteBlock | CalloutBlock
  | TwoColBlock | TeamBlock | StatsBlock | TimelineBlock | ImageBlock
  | GalleryBlock | VideoBlock | EventsBlock | JobsBlock | NewsBlock
  | CtaBlock | FaqBlock | ContactBlock | SignupBlock;

// ── Page document ────────────────────────────────────────────────────────────

export interface PageMeta {
  title: string;
  slug: string;
  department: string;
  accentColor: string;
  description?: string;
  status: "draft" | "published";
}

export interface PageDoc {
  meta: PageMeta;
  blocks: Block[];
}

// ── Editor UI state (not persisted) ─────────────────────────────────────────

export type EditorMode     = "edit" | "preview";
export type EditorViewport = "desk" | "tab" | "mob";
export type SavingState    = "idle" | "pending" | "saved" | "error";

// ── Host-provided data types ─────────────────────────────────────────────────

export interface EditorDepartment { id: string; name: string; }
