import type { Locale } from "../config";

export async function loadMessages(locale: Locale) {
  switch (locale) {
    case "no":
      return (await import("./no")).default;
    default:
      return (await import("./en")).default;
  }
}

export const messageNamespaces = [
  "academicsContact",
  "businessHotspot",
  "campus",
  "units",
  "common",
  "cookies",
  "contact",
  "applications",
  "documents",
  "expenses",
  "home",
  "unused",
  "varsling",
  "partner",
  "press",
  "privacy",
  "policies",
  "about",
  "resources",
  "membership",
  "students",
  "shop",
  "terms",
  "projects",
  "memberPortal",
  "fundingProgram",
  "projectDetail",
  "volunteer",
  "admin",
  "adminUsers",
  "adminShop",
  "adminJobs",
  "adminEvents",
  "adminExpenses",
  "adminUnits",
  "adminSettings",
] as const;
