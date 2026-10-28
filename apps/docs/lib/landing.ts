/**
 * What the landing links to below the hero. Both lists grow as guide pages land, and an
 * empty list renders nothing. Each stage appends to them as its guide pages
 * land; `landing.test.ts` checks that every href resolves to a real page.
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
];

export const taskGroups: TaskGroup[] = [
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
        href: "/guide/recruitment/review-applications#steps",
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
];
