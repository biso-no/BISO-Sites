import type { TourDefinition, TourStep } from "@repo/tours/types";
import { RECRUITMENT_GUIDE_VIDEO_URL } from "./recruitment-guide-video";
import type { RecruitmentTourContext } from "./registry";

const OVERVIEW = "/jobs";
const EDITOR = "/jobs/new";

/** Maps a step id to its `adminPortal.tours` i18n keys. */
function copy(step: string): { title: string; body: string } {
  return {
    title: `recruitmentHr.${step}.title`,
    body: `recruitmentHr.${step}.body`,
  };
}

/**
 * The multi-page HR walkthrough. Steps with a `route` cause the engine to
 * navigate there (via the injected router) before resolving their target. The
 * workspace steps need a real vacancy id — when none exists they are omitted so
 * the tour still runs end to end on the overview + editor.
 */
export function buildRecruitmentHrTour(
  context: RecruitmentTourContext
): TourDefinition {
  const workspace = context.vacancyId
    ? `/jobs/${context.vacancyId}/applications`
    : null;

  const workspaceSteps: TourStep[] = workspace
    ? [
        {
          id: "workspace",
          route: workspace,
          target: { type: "center" },
          ...copy("workspace"),
        },
        {
          id: "pipeline",
          route: workspace,
          target: {
            type: "element",
            selector: '[data-tour="workspace-pipeline"]',
          },
          placement: "top",
          coach: {
            type: "drag",
            from: '[data-tour="pipeline-stage-first"] .cand-card',
            to: '[data-tour="pipeline-stage-next"]',
          },
          ...copy("pipeline"),
        },
        {
          id: "interviews",
          route: `${workspace}?tab=interviews`,
          target: {
            type: "element",
            selector: '[data-tour="interviews-schedule"]',
          },
          placement: "left",
          ...copy("interviews"),
        },
        {
          id: "analytics",
          route: `${workspace}?tab=analytics`,
          target: {
            type: "element",
            selector: '[data-tour="analytics-overview"]',
          },
          placement: "top",
          ...copy("analytics"),
        },
        {
          id: "form",
          route: `${workspace}?tab=form`,
          target: { type: "element", selector: '[data-tour="form-builder"]' },
          placement: "top",
          ...copy("form"),
        },
        {
          id: "settings",
          route: `${workspace}?tab=settings`,
          target: {
            type: "element",
            selector: '[data-tour="settings-access"]',
          },
          placement: "top",
          ...copy("settings"),
        },
      ]
    : [];

  const steps: TourStep[] = [
    { id: "welcome", target: { type: "center" }, ...copy("welcome") },
    {
      id: "campus",
      route: OVERVIEW,
      target: { type: "element", selector: '[data-tour="campus-switcher"]' },
      placement: "right",
      ...copy("campus"),
    },
    {
      id: "vacancies",
      route: OVERVIEW,
      target: { type: "element", selector: '[data-tour="vacancy-list"]' },
      placement: "top",
      ...copy("vacancies"),
    },
    {
      id: "create",
      route: OVERVIEW,
      target: { type: "element", selector: '[data-tour="create-vacancy"]' },
      placement: "bottom",
      ...copy("create"),
    },
    {
      id: "editor",
      route: EDITOR,
      target: { type: "center" },
      ...copy("editor"),
    },
    ...workspaceSteps,
    {
      id: "finish",
      route: OVERVIEW,
      target: { type: "center" },
      media: { type: "video", src: RECRUITMENT_GUIDE_VIDEO_URL },
      ...copy("finish"),
    },
  ];

  return { id: "recruitment-hr", version: 1, steps };
}
