import type { ProjectSlug } from "@repo/shared/utils/project-units";

/**
 * The flagship projects that run in several campuses and so have a hub page
 * with no department of its own. Winter Games is national-only: its page is
 * its national unit's, created from the department view.
 */
export const HUB_PROJECTS: readonly { name: string; slug: ProjectSlug }[] = [
  { name: "Fadderullan", slug: "fadderullan" },
  { name: "Karrieredagene", slug: "karrieredagene" },
  { name: "Bergensbaneløpet", slug: "bergensbanelopet" },
] as const;
