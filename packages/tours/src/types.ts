/**
 * Public types for the shared tour engine. This module is intentionally free of
 * any React / Appwrite / app-specific imports so it can be consumed from server
 * actions, client components, and tour-definition files alike.
 */

export type TourPlacement = "top" | "bottom" | "left" | "right" | "auto";

/** Where a step points. `element` resolves a CSS selector (prefer `[data-tour]`). */
export type TourStepTarget =
  | { type: "element"; selector: string }
  | { type: "center" };

/**
 * An optional animated demonstration overlaid on a step. `drag` loops a faux
 * cursor + ghost card from one element to another (e.g. showing how to drag a
 * candidate between pipeline columns). `from`/`to` are CSS selectors.
 */
export interface TourDragCoach {
  from: string;
  to: string;
  type: "drag";
}

export type TourCoach = TourDragCoach;

/**
 * An optional video shown inside a step card (e.g. a recorded walkthrough on the
 * closing step). `src` is played inline with native controls; `poster` is the
 * still frame shown before playback starts.
 */
export interface TourStepVideo {
  poster?: string;
  src: string;
  type: "video";
}

export type TourStepMedia = TourStepVideo;

export interface TourStep {
  /** Body copy, or an i18n key resolved by the provider's `translate`. */
  body: string;
  /** Optional looping demonstration (e.g. a drag) layered over this step. */
  coach?: TourCoach;
  /** Stable id, unique within the tour. Used for analytics + keys. */
  id: string;
  /** Optional video embedded in the step card, under the body copy. */
  media?: TourStepMedia;
  /** Preferred side of the target. `auto`/omitted lets the popover flip freely. */
  placement?: TourPlacement;
  /**
   * Concrete path this step lives on. When set and the current path differs, the
   * provider's injected `navigate` is called on step entry before resolving the
   * target — this is what enables multi-page tours. Omit for same-page steps.
   */
  route?: string;
  /** Extra px of breathing room around the spotlight cut-out. */
  spotlightPadding?: number;
  target: TourStepTarget;
  /** Title copy, or an i18n key resolved by the provider's `translate`. */
  title: string;
}

export interface TourDefinition {
  /** Unique tour id. Doubles as the persistence key. */
  id: string;
  steps: TourStep[];
  /** Bump to re-offer a tour after its content materially changes. */
  version: number;
}

export type TourStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "dismissed";

export interface TourProgressRecord {
  status: TourStatus;
  stepIndex: number;
  tourId: string;
  version: number;
}

/**
 * Persistence is injected by the host app so this package stays backend-agnostic.
 * The admin app implements this with server actions against the `tour_progress`
 * collection; a demo/test may implement it against memory or localStorage.
 */
export interface TourPersistenceAdapter {
  /** Returns every progress record for the current user. */
  load(): Promise<TourProgressRecord[]>;
  /** Upserts a single tour's progress record. */
  save(record: TourProgressRecord): Promise<void>;
}

export type TourEventName =
  | "tour_start"
  | "tour_step_view"
  | "tour_complete"
  | "tour_dismiss";

export interface TourEvent {
  data: Record<string, string | number>;
  name: TourEventName;
}

/**
 * Everything a custom step-card renderer needs. Supplied to the provider's
 * `renderStepCard` so a host can render a fully on-brand card while the package
 * keeps owning positioning, the overlay, keyboard nav, and persistence.
 */
export interface TourStepRenderContext {
  bodyId: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  labels: TourLabels;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  step: TourStep;
  titleId: string;
  total: number;
  translate?: (key: string) => string;
}

/** UI control labels. Localized by the host; English defaults provided. */
export interface TourLabels {
  back: string;
  close: string;
  finish: string;
  next: string;
  progress: (current: number, total: number) => string;
  skip: string;
}
