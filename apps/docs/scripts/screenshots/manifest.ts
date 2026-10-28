/**
 * The guide's screenshots: which admin screen, which page it belongs in, and
 * the step it follows. `capture.ts` takes them; a person then adds a
 * `<Screenshot>` tag after `afterStep` in `page`.
 *
 * Screens fed by outside services are shown only in states that need none:
 * the schedule dialog is captured before "Check availability" (which reads
 * Outlook), and the booking link before "Generate booking link".
 */
import {
  DRAFT_JOB_ID,
  PUBLISHED_JOB_ID,
  SHOWCASE,
  type StaffRole,
} from "./seed-data";

/** Named actions `capture.ts` runs after the route has loaded. */
export const PREPARE_NAMES = [
  "open-schedule",
  "open-scorecard",
  "show-booking-link",
] as const;

export type PrepareName = (typeof PREPARE_NAMES)[number];

export interface Shot {
  afterStep: string;
  caption: string;
  height: number;
  id: string;
  /** Repo-relative path of the `.mdx` page the shot belongs in. */
  page: string;
  prepare?: PrepareName;
  /** The seeded user whose session is used. */
  role: StaffRole;
  /** Admin path, relative to DOCS_ADMIN_URL. */
  route: string;
  /** Take the shot with no session (the sign-in page). */
  signedOut?: boolean;
  width: number;
}

const GUIDE = "apps/docs/content/docs/guide";
const WIDTH = 1440;
const HEIGHT = 900;
const APPLICATIONS = `/jobs/${PUBLISHED_JOB_ID}/applications`;

export const SHOTS: Shot[] = [
  {
    afterStep: "Sign in",
    caption:
      "The sign-in page, headed Velkommen tilbake (Welcome Back), with the Logg inn med BISO-konto (Sign in with BISO account) button.",
    height: HEIGHT,
    id: "sign-in-page",
    page: `${GUIDE}/start-here/sign-in.mdx`,
    role: "hr",
    route: "/auth/login",
    signedOut: true,
    width: WIDTH,
  },
  {
    afterStep: "See where you land",
    caption:
      "A department member lands on Sider (Pages). The box at the top of the sidebar shows the campus and the department.",
    height: HEIGHT,
    id: "sign-in-department-landing",
    page: `${GUIDE}/start-here/sign-in.mdx`,
    role: "department",
    route: "/",
    width: WIDTH,
  },
  {
    afterStep: "Start a new vacancy, or copy last year's",
    caption:
      "Stillinger (Jobs) with one published vacancy and one draft. Utlys stilling (Post Job) starts a new vacancy.",
    height: HEIGHT,
    id: "recruitment-jobs-list",
    page: `${GUIDE}/recruitment/publish-a-vacancy.mdx`,
    role: "hr",
    route: "/jobs",
    width: WIDTH,
  },
  {
    afterStep: "Fill in Essentials",
    caption:
      "The vacancy editor on its first step, Essentials: title, web address, campus, department, teaser and tags.",
    height: HEIGHT,
    id: "recruitment-editor-essentials",
    page: `${GUIDE}/recruitment/publish-a-vacancy.mdx`,
    role: "hr",
    route: `/jobs/${DRAFT_JOB_ID}`,
    width: WIDTH,
  },
  {
    afterStep: "Open the vacancy's applications",
    caption:
      "The Pipeline tab: one column per stage, from Applied to Archived, with each candidate's AI match score.",
    height: HEIGHT,
    id: "recruitment-pipeline",
    page: `${GUIDE}/recruitment/review-applications.mdx`,
    role: "hr",
    route: APPLICATIONS,
    width: WIDTH,
  },
  {
    afterStep: "Read a candidate",
    caption:
      "A candidate's panel on the Overview tab: the AI match score and summary, with Compare, Schedule and Advance at the top.",
    height: HEIGHT,
    id: "recruitment-candidate-drawer",
    page: `${GUIDE}/recruitment/review-applications.mdx`,
    role: "hr",
    route: `${APPLICATIONS}?candidate=${SHOWCASE.drawerApplicationId}`,
    width: WIDTH,
  },
  {
    afterStep: "Open the scheduling dialog",
    caption:
      "The Schedule an interview dialog before you check availability: round, duration, location, panel and the time grid.",
    height: HEIGHT,
    id: "recruitment-schedule-dialog",
    page: `${GUIDE}/recruitment/book-interviews.mdx`,
    prepare: "open-schedule",
    role: "hr",
    route: APPLICATIONS,
    width: WIDTH,
  },
  {
    afterStep: "Make the booking link",
    caption:
      "Send a booking link on the Interviews tab: the candidate, the panel, the length and Generate booking link.",
    height: HEIGHT,
    id: "recruitment-booking-link",
    page: `${GUIDE}/recruitment/book-interviews.mdx`,
    prepare: "show-booking-link",
    role: "hr",
    route: `${APPLICATIONS}?tab=interviews`,
    width: WIDTH,
  },
  {
    afterStep: "Open the scorecard",
    caption:
      "The scorecard, opened with Write under Pending scorecards: five areas to rate, strengths, concerns and a recommendation.",
    height: HEIGHT,
    id: "recruitment-scorecard",
    page: `${GUIDE}/recruitment/book-interviews.mdx`,
    prepare: "open-scorecard",
    role: "hr",
    route: `${APPLICATIONS}?tab=interviews`,
    width: WIDTH,
  },
];
