"use client";

import { useContext } from "react";
import { TourContext, type TourContextValue } from "./tour-context";

/** Access the active tour and its controls. Must be used within a TourProvider. */
export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a <TourProvider>.");
  }
  return context;
}
