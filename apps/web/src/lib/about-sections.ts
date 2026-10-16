/**
 * The sections of the merged "Om BISO" page, in page order, and where the
 * retired subpages now land. The ids are the anchors; the nav, the section
 * menu and the redirects all read this one list.
 */
export const ABOUT_SECTIONS = [
  {
    component: "what-is-biso-section",
    id: "hva-er-biso",
    labelKey: "whatIsBiso",
  },
  { component: "what-we-do-section", id: "hva-vi-gjor", labelKey: "whatWeDo" },
  {
    component: "study-quality-section",
    id: "studiekvalitet",
    labelKey: "studyQuality",
  },
  { component: "politics-section", id: "politikk", labelKey: "politics" },
  { component: "history-section", id: "historie", labelKey: "history" },
  { component: "operations-section", id: "drift", labelKey: "operations" },
  { component: "alumni-saih-section", id: "alumni", labelKey: "alumni" },
  { component: "documents-section", id: "dokumenter", labelKey: "documents" },
] as const;

export type AboutSectionId = (typeof ABOUT_SECTIONS)[number]["id"];

/** Old subpage slug → anchor on the merged page. */
export const ABOUT_REDIRECTS: Record<string, `/about#${AboutSectionId}`> = {
  alumni: "/about#alumni",
  history: "/about#historie",
  operations: "/about#drift",
  politics: "/about#politikk",
  saih: "/about#alumni",
  "study-quality": "/about#studiekvalitet",
  "what-is-biso": "/about#hva-er-biso",
};
