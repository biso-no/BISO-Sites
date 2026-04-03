/**
 * Puck 0.21 declaration merging — extends Puck's built-in interfaces with
 * our app-specific metadata and custom field types so all resolveData,
 * resolveFields, and resolvePermissions callbacks are fully typed without
 * casting to `any`.
 *
 * This file must be a module (has an import) so that `declare module` below
 * augments rather than replaces the @puckeditor/core type definitions.
 *
 * @see https://puckeditor.com/blog/puck-021 (Declaration merging section)
 */

// biome-ignore lint/correctness/noUnusedImports: needed to make this a module for augmentation
import type {} from "@puckeditor/core";

declare module "@puckeditor/core" {
  /**
   * Typed shape of the `metadata` prop passed to `<Puck metadata={...} />`.
   * Mirrors EditorContext (editor-context.ts) + locale.
   */
  export interface PuckMetadata {
    locale?: string;
    mode?: "direct";
    contentType?: string;
    page?: {
      id?: string;
      status?: string;
      scope?: "global" | "campus" | "department";
      campusId?: string | null;
      departmentId?: string | null;
    };
    user?: {
      isGlobalAdmin: boolean;
      isCampusAdmin: boolean;
      campusNames: string[];
      departmentNames: string[];
      managedCampuses: string[];
    };
    constraints?: {
      slugLocked: boolean;
    };
  }

  // Note on custom field types (`datetime-picker`, `table-picker`, `image`, `link`):
  // Puck's `CustomField.type` is locked to `"custom"` and cannot be extended via
  // declaration merging (TS2717). These field types are registered at runtime via
  // `overrides.fieldTypes` in puck-ui.tsx. The fields themselves still require
  // a type assertion (e.g. `type: "datetime-picker" as FieldType`) at the config
  // definition site until Puck exposes a proper extension point for this.
}
