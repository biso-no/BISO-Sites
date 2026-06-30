"use client";

import { createContext } from "react";
import type { TourDefinition, TourStep } from "./types";

export interface TourContextValue {
  /** The currently running tour, or `null` when idle. */
  activeTour: TourDefinition | null;
  /** Every registered tour — used by the replay menu. */
  availableTours: TourDefinition[];
  back: () => void;
  /** The active step, or `null` when idle. */
  currentStep: TourStep | null;
  /** Complete the active tour (records `completed`). */
  finish: () => void;
  next: () => void;
  /** Dismiss the active tour (records `dismissed`). */
  skip: () => void;
  /** Start (or resume) a registered tour by id. */
  start: (tourId: string) => void;
  stepIndex: number;
  totalSteps: number;
}

export const TourContext = createContext<TourContextValue | null>(null);
