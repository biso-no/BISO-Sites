export type EditorContext = {
  /**
   * Optional locale for dynamic content resolution (e.g. translated fields)
   */
  locale?: string;
  page: {
    id?: string;
    status: "draft" | "published" | "archived";
    scope: "global" | "campus" | "department";
    campusId?: string | null;
    departmentId?: string | null;
  };
  user: {
    isGlobalAdmin: boolean;
    isCampusAdmin: boolean;
    campusNames: string[];
    departmentNames: string[];
    managedCampuses: string[];
  };
  constraints: {
    slugLocked: boolean;
  };
};
