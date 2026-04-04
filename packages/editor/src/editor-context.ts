export type EditorMode = "direct";

export interface EditorContext {
  constraints: {
    slugLocked: boolean;
  };
  /**
   * Content type key from the content type registry (e.g., "homepage", "news-listing")
   */
  contentType?: string;
  /**
   * Optional locale for dynamic content resolution (e.g. translated fields)
   */
  locale?: string;
  mode: EditorMode;
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
}
