/** Plain shapes and grouping for the Projects tab. No server code here. */

export interface ProjectDepartment {
  id: string;
  name: string;
}

export interface ProjectView {
  /** Departments that booked on the project. */
  departments: ProjectDepartment[];
  /** Finance's own date (YYYY-MM-DD), or null when none is set. */
  eventDate: string | null;
  firstLineDate: string | null;
  id: string;
  lastLineDate: string | null;
  name: string;
  peakDate: string | null;
  series: string | null;
  year: number | null;
}

export interface ProjectGroup {
  projects: ProjectView[];
  /** The series name, or the project's own name when it has no series. */
  series: string;
}

export interface ProjectsView {
  /** Departments that appear on at least one project, for the filter. */
  departments: ProjectDepartment[];
  groups: ProjectGroup[];
  /** Newest full-sync time, or null when no sync has finished. */
  lastSyncedAt: string | null;
}

/** Groups projects by series (A to Z), newest year first within a series. */
export function groupProjects(projects: ProjectView[]): ProjectGroup[] {
  const bySeries = new Map<string, ProjectView[]>();
  for (const project of projects) {
    const key = project.series ?? project.name;
    bySeries.set(key, [...(bySeries.get(key) ?? []), project]);
  }
  return [...bySeries.entries()]
    .map(([series, items]) => ({
      projects: [...items].sort(
        (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name)
      ),
      series,
    }))
    .sort((a, b) => a.series.localeCompare(b.series));
}

/** Keeps the projects a department used; an empty id keeps everything. */
export function filterGroups(
  groups: ProjectGroup[],
  departmentId: string
): ProjectGroup[] {
  if (!departmentId) {
    return groups;
  }
  return groups
    .map((group) => ({
      ...group,
      projects: group.projects.filter((project) =>
        project.departments.some((department) => department.id === departmentId)
      ),
    }))
    .filter((group) => group.projects.length > 0);
}
