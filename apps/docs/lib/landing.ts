/**
 * What the landing links to below the hero. Each stage appends to both lists
 * as its guide pages land, and an empty list renders nothing.
 * `landing.test.ts` checks that every href resolves to a real page.
 */

export interface LandingLink {
  href: string;
  title: string;
}

/** A numbered reading path for one role, under "Start with your role". */
export interface ReadingPath {
  role: string;
  steps: LandingLink[];
}

/** Common tasks in one area; the heading links to the area's collection. */
export interface TaskGroup {
  href: string;
  tasks: LandingLink[];
  title: string;
}

export const readingPaths: ReadingPath[] = [
  {
    role: "HR team",
    steps: [
      { title: "Sign in and find your way", href: "/guide/start-here/sign-in" },
      { title: "How recruitment works", href: "/guide/recruitment" },
      {
        title: "Publish a vacancy",
        href: "/guide/recruitment/publish-a-vacancy",
      },
      {
        title: "Review applications",
        href: "/guide/recruitment/review-applications",
      },
      { title: "Book interviews", href: "/guide/recruitment/book-interviews" },
      {
        title: "Make offers, reject, and finish the round",
        href: "/guide/recruitment/make-offers-and-close",
      },
    ],
  },
  {
    role: "Department editor",
    steps: [
      { title: "Sign in and find your way", href: "/guide/start-here/sign-in" },
      { title: "How pages and news work", href: "/guide/pages-and-news" },
      {
        title: "Department pages",
        href: "/guide/pages-and-news/department-pages",
      },
      { title: "Edit a page", href: "/guide/pages-and-news/edit-a-page" },
      { title: "Publish news", href: "/guide/pages-and-news/publish-news" },
      { title: "Create an event", href: "/guide/events/create-an-event" },
    ],
  },
  {
    role: "Campus leader",
    steps: [
      { title: "Sign in and find your way", href: "/guide/start-here/sign-in" },
      { title: "Everyday tools", href: "/guide/start-here/everyday-tools" },
      {
        title: "Inbox and approvals",
        href: "/guide/start-here/inbox-and-approvals",
      },
      { title: "How the shop works", href: "/guide/shop" },
      {
        title: "Find a member",
        href: "/guide/members-and-benefits/find-a-member",
      },
      { title: "How access works", href: "/guide/access-and-settings" },
    ],
  },
  {
    role: "IT",
    steps: [
      { title: "Sign in and find your way", href: "/guide/start-here/sign-in" },
      { title: "How access works", href: "/guide/access-and-settings" },
      {
        title: "Manage Microsoft users",
        href: "/guide/access-and-settings/manage-users",
      },
      {
        title: "Hand over a role account",
        href: "/guide/access-and-settings/hand-over-a-role-account",
      },
      {
        title: "System settings",
        href: "/guide/access-and-settings/system-settings",
      },
    ],
  },
  {
    role: "Benefits editor",
    steps: [
      { title: "Sign in and find your way", href: "/guide/start-here/sign-in" },
      {
        title: "How membership and benefits work",
        href: "/guide/members-and-benefits",
      },
      {
        title: "Publish a benefit",
        href: "/guide/members-and-benefits/publish-a-benefit",
      },
      {
        title: "Partners and membership texts",
        href: "/guide/members-and-benefits/partners-and-texts",
      },
    ],
  },
  {
    role: "Developer or consultant",
    steps: [
      {
        title: "If you're hiring someone",
        href: "/developers/start-here/if-youre-hiring-someone",
      },
      {
        title: "Your first day",
        href: "/developers/start-here/your-first-day",
      },
      {
        title: "What BISO runs",
        href: "/developers/start-here/what-biso-runs",
      },
      { title: "Deploying", href: "/developers/keep-it-running/deploying" },
      {
        title: "When things break",
        href: "/developers/keep-it-running/when-things-break",
      },
    ],
  },
];

export const taskGroups: TaskGroup[] = [
  {
    title: "Start here",
    href: "/guide/start-here/sign-in",
    tasks: [
      {
        title: "Open the notification bell",
        href: "/guide/start-here/sign-in#open-the-notification-bell",
      },
      {
        title: "Ask the BISO Assistant",
        href: "/guide/start-here/everyday-tools#ask-the-biso-assistant-everyone",
      },
      {
        title: "Approve or reject a request",
        href: "/guide/start-here/inbox-and-approvals#approve-or-reject-a-request",
      },
    ],
  },
  {
    title: "Recruitment",
    href: "/guide/recruitment",
    tasks: [
      {
        title: "Publish a vacancy",
        href: "/guide/recruitment/publish-a-vacancy",
      },
      {
        title: "Shortlist or archive a candidate",
        href: "/guide/recruitment/review-applications#shortlist-or-archive-a-candidate",
      },
      {
        title: "Send a booking link",
        href: "/guide/recruitment/book-interviews#let-them-pick-booking-link",
      },
      {
        title: "Make an offer",
        href: "/guide/recruitment/make-offers-and-close",
      },
    ],
  },
  {
    title: "Pages and news",
    href: "/guide/pages-and-news",
    tasks: [
      { title: "Edit a page", href: "/guide/pages-and-news/edit-a-page" },
      {
        title: "Publish each language of a department page",
        href: "/guide/pages-and-news/department-pages#publish-each-language",
      },
      { title: "Publish news", href: "/guide/pages-and-news/publish-news" },
    ],
  },
  {
    title: "Departments and documents",
    href: "/guide/departments-and-documents",
    tasks: [
      {
        title: "Upload a new document",
        href: "/guide/departments-and-documents/documents#upload-a-new-document",
      },
      {
        title: "Upload a new version",
        href: "/guide/departments-and-documents/documents#upload-a-new-version",
      },
    ],
  },
  {
    title: "Events",
    href: "/guide/events",
    tasks: [
      { title: "Create an event", href: "/guide/events/create-an-event" },
      {
        title: "See who's coming",
        href: "/guide/events/run-the-event#see-whos-coming",
      },
      {
        title: "Keep the ticket link right",
        href: "/guide/events/run-the-event#keep-the-ticket-link-right",
      },
    ],
  },
  {
    title: "Announcements",
    href: "/guide/announcements",
    tasks: [
      {
        title: "Send an announcement",
        href: "/guide/announcements/send-an-announcement",
      },
      {
        title: "Choose who gets it",
        href: "/guide/announcements/send-an-announcement#choose-who-gets-it",
      },
    ],
  },
  {
    title: "Shop",
    href: "/guide/shop",
    tasks: [
      { title: "Add a product", href: "/guide/shop/add-a-product" },
      {
        title: "Refund an order",
        href: "/guide/shop/orders-and-refunds#refund-an-order",
      },
      {
        title: "Switch accounting posting on",
        href: "/guide/shop/accounting#switch-posting-on",
      },
    ],
  },
  {
    title: "Members and benefits",
    href: "/guide/members-and-benefits",
    tasks: [
      {
        title: "Find a member",
        href: "/guide/members-and-benefits/find-a-member",
      },
      {
        title: "Publish a benefit",
        href: "/guide/members-and-benefits/publish-a-benefit",
      },
      {
        title: "Scan member passes",
        href: "/guide/members-and-benefits/scan-member-passes",
      },
    ],
  },
  {
    title: "Access and settings",
    href: "/guide/access-and-settings",
    tasks: [
      {
        title: "Reset a password",
        href: "/guide/access-and-settings/manage-users#reset-a-password-global-admins",
      },
      {
        title: "Hand over a role account",
        href: "/guide/access-and-settings/hand-over-a-role-account",
      },
      {
        title: "Switch a feature flag",
        href: "/guide/access-and-settings/system-settings#switch-a-feature-flag",
      },
      {
        title: "Fix expense approval issues",
        href: "/guide/access-and-settings/expense-approvals",
      },
    ],
  },
  {
    title: "Analytics",
    href: "/guide/analytics",
    tasks: [
      { title: "Pick a period", href: "/guide/analytics#pick-a-period" },
      {
        title: "Read the key figures",
        href: "/guide/analytics#read-the-key-figures",
      },
    ],
  },
];
