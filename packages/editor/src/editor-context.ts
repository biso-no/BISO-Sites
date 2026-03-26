export type EditorMode = "template" | "page" | "direct";

export type EditorContext = {
  /**
   * Editor mode:
   * - "template": Creating/editing a reusable template (globaladmin only)
   * - "page": Editing a page entry based on a template
   * - "direct": Direct page editing without a template
   */
  mode: EditorMode;
  /**
   * Content type key from the content type registry (e.g., "homepage", "news-listing")
   */
  contentType?: string;
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
