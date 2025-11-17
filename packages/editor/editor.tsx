"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { pageBuilderConfig } from "./page-builder-config";
import type { PageBuilderDocument } from "./types";
import type { ComponentProps } from "react";

export type PageBuilderEditorProps = Omit<
  ComponentProps<typeof Puck<typeof pageBuilderConfig>>,
  "config" | "data"
> & {
  data: PageBuilderDocument;
};

/**
 * PageBuilderEditor - Puck-based visual editor
 * 
 * Supports all Puck props including:
 * - overrides: Customize UI components (header, headerActions, etc.)
 * - headerActions: Custom actions in the header
 * - onChange: Handle data changes
 * 
 * @example
 * ```tsx
 * <PageBuilderEditor
 *   data={document}
 *   onChange={setDocument}
 *   overrides={{
 *     headerActions: ({ children }) => (
 *       <div className="flex gap-2">
 *         <CustomHeader />
 *         {children}
 *       </div>
 *     )
 *   }}
 * />
 * ```
 */
export function PageBuilderEditor({ data, ...props }: PageBuilderEditorProps) {
  return <Puck config={pageBuilderConfig} data={data} {...props} />;
}
