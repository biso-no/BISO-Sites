/**
 * The guide's screenshots: which admin screen, which page it belongs in, and
 * the step it follows. `capture.ts` takes them; a person then adds a
 * `<Screenshot>` tag after `afterStep` in `page`.
 *
 * Screens fed by outside services are shown only in states that need none:
 * the schedule dialog is captured before "Check availability" (which reads
 * Outlook), and the booking link before "Generate booking link".
 *
 * Screens that are only an outside service get no shot at all: IT users and
 * audit (Graph), analytics (Umami), documents (SharePoint), shop accounting
 * and expense approvals (24SevenOffice). The pages for those have text-only
 * steps. `manifest.test.ts` refuses a shot on any of those routes.
 */
import {
  DEMO_EVENTS_DEPARTMENT_ID,
  DRAFT_JOB_ID,
  MEMBERS_EVENT_ID,
  PAID_ORDER_ID,
  PUBLISHED_JOB_ID,
  PUBLISHED_NEWS_ID,
  PUBLISHED_PAGE_ID,
  REFUNDED_ORDER_ID,
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
const SHOP_ORDERS = "/shop?tab=orders";
const APPLICATIONS = `/jobs/${PUBLISHED_JOB_ID}/applications`;

const EARLIER_SHOTS: Shot[] = [
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

function shot(
  fields: Pick<Shot, "afterStep" | "caption" | "id" | "page" | "role" | "route">
): Shot {
  return { height: HEIGHT, width: WIDTH, ...fields };
}

/** Pages, news, departments, events, communications and the shop. */
const CONTENT_SHOTS: Shot[] = [
  shot({
    afterStep: "Review drafts (global admins and campus leaders)",
    caption:
      "Gjennomgå utkast (Review Drafts) with the draft article and the draft vacancy waiting. Godkjenn (Approve) publishes at once.",
    id: "drafts-review",
    page: `${GUIDE}/start-here/everyday-tools.mdx`,
    role: "globaladmin",
    route: "/drafts",
  }),
  shot({
    afterStep: "Open the page in the editor",
    caption: "Sider (Pages) with one published page and one draft page.",
    id: "pages-list",
    page: `${GUIDE}/pages-and-news/edit-a-page.mdx`,
    role: "globaladmin",
    route: "/pages",
  }),
  shot({
    afterStep: "Fill in the page settings",
    caption: "The page editor open on a published page.",
    id: "pages-editor",
    page: `${GUIDE}/pages-and-news/edit-a-page.mdx`,
    role: "globaladmin",
    route: `/pages/${PUBLISHED_PAGE_ID}`,
  }),
  shot({
    afterStep: "Start an article",
    caption:
      "Nyheter (News) with one published article and one draft, and the button that starts a new article.",
    id: "news-list",
    page: `${GUIDE}/pages-and-news/publish-news.mdx`,
    role: "globaladmin",
    route: "/news",
  }),
  shot({
    afterStep: "Fill in Essentials",
    caption:
      "A news article on its first step, Essentials: title, web address, campus and department.",
    id: "news-editor-essentials",
    page: `${GUIDE}/pages-and-news/publish-news.mdx`,
    role: "globaladmin",
    route: `/news/${PUBLISHED_NEWS_ID}`,
  }),
  shot({
    afterStep: "Open your department",
    caption:
      "A department member's own department, Demo Events, with its profile and its page.",
    id: "department-page-card",
    page: `${GUIDE}/pages-and-news/department-pages.mdx`,
    role: "department",
    route: `/departments/${DEMO_EVENTS_DEPARTMENT_ID}`,
  }),
  shot({
    afterStep: "A department's page in the admin",
    caption:
      "A department's page in the admin: Demo Events, with its profile and its page.",
    id: "department-detail",
    page: `${GUIDE}/departments-and-documents/index.mdx`,
    role: "department",
    route: `/departments/${DEMO_EVENTS_DEPARTMENT_ID}`,
  }),
  shot({
    afterStep: "Start an event",
    caption:
      "Arrangementer (Events) with the two seeded events, one of them members-only.",
    id: "events-list",
    page: `${GUIDE}/events/create-an-event.mdx`,
    role: "globaladmin",
    route: "/events",
  }),
  shot({
    afterStep: "See who's coming",
    caption:
      "The logistics page of the members-only event, with its three RSVPs.",
    id: "events-rsvps",
    page: `${GUIDE}/events/run-the-event.mdx`,
    role: "globaladmin",
    route: `/events/${MEMBERS_EVENT_ID}/segments`,
  }),
  shot({
    afterStep: "Start an announcement",
    caption:
      "Communications with one announcement that has been sent, and the New announcement button.",
    id: "communications-list",
    page: `${GUIDE}/announcements/send-an-announcement.mdx`,
    role: "globaladmin",
    route: "/communications",
  }),
  shot({
    afterStep: "Start a product",
    caption: "The shop catalogue with one published product and one draft.",
    id: "shop-catalogue",
    page: `${GUIDE}/shop/add-a-product.mdx`,
    role: "globaladmin",
    route: "/shop",
  }),
  shot({
    afterStep: "Open the orders",
    caption: "The Orders tab with one paid order and one refunded order.",
    id: "shop-orders",
    page: `${GUIDE}/shop/orders-and-refunds.mdx`,
    role: "globaladmin",
    route: SHOP_ORDERS,
  }),
  shot({
    afterStep: "Read the order",
    caption:
      "A paid order: its lines, the buyer and the payment, with the refund control.",
    id: "shop-order-detail",
    page: `${GUIDE}/shop/orders-and-refunds.mdx`,
    role: "globaladmin",
    route: `/shop/orders/${PAID_ORDER_ID}`,
  }),
  shot({
    afterStep: "Check the refund history",
    caption: "A refunded order, with the refund in its history.",
    id: "shop-order-refunded",
    page: `${GUIDE}/shop/orders-and-refunds.mdx`,
    role: "globaladmin",
    route: `/shop/orders/${REFUNDED_ORDER_ID}`,
  }),
];

/** Members, benefits and the settings screens that need no outside service. */
const MEMBER_AND_SETTINGS_SHOTS: Shot[] = [
  shot({
    afterStep: "Open the members list",
    caption: "The members list with three invented members.",
    id: "members-list",
    page: `${GUIDE}/members-and-benefits/find-a-member.mdx`,
    role: "globaladmin",
    route: "/members",
  }),
  shot({
    afterStep: "Open the benefits board",
    caption: "The benefits board for Oslo, with one published benefit.",
    id: "benefits-board",
    page: `${GUIDE}/members-and-benefits/publish-a-benefit.mdx`,
    role: "globaladmin",
    route: "/benefits",
  }),
  shot({
    afterStep: "Open the partners page",
    caption: "The offer partners for Oslo, with one partner and its benefit.",
    id: "benefits-partners",
    page: `${GUIDE}/members-and-benefits/partners-and-texts.mdx`,
    role: "globaladmin",
    route: "/benefits/partners",
  }),
  shot({
    afterStep: "Open Varsling",
    caption:
      "Varsling with two invented contacts for Oslo, one for HR and one for the head of campus.",
    id: "varsling-contacts",
    page: `${GUIDE}/access-and-settings/varsling.mdx`,
    role: "globaladmin",
    route: "/varsling",
  }),
  shot({
    afterStep: "Switch a feature flag",
    caption: "The feature flags, grouped, each with its on and off switch.",
    id: "settings-feature-flags",
    page: `${GUIDE}/access-and-settings/system-settings.mdx`,
    role: "globaladmin",
    route: "/settings/feature-flags",
  }),
];

export const SHOTS: Shot[] = [
  ...EARLIER_SHOTS,
  ...CONTENT_SHOTS,
  ...MEMBER_AND_SETTINGS_SHOTS,
];
