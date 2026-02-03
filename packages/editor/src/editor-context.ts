export type EditorContext = {
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

