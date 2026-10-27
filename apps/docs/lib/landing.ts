/**
 * What the landing links to below the hero. Both lists start empty, and an
 * empty list renders nothing. Stages 2–4 append to them as their guide pages
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

export const readingPaths: ReadingPath[] = [];

export const taskGroups: TaskGroup[] = [];
