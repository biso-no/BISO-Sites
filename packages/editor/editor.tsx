"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { pageBuilderConfig } from "./page-builder-config";
import type { PageBuilderDocument } from "./types";
import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";

export type PageBuilderEditorProps = Omit<
  ComponentProps<typeof Puck<typeof pageBuilderConfig>>,
  "config" | "data"
> & {
  data: PageBuilderDocument;
};

/**
 * PageBuilderEditor - Puck-based visual editor with loading states and error handling
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
export function PageBuilderEditor({ data, overrides, ...props }: PageBuilderEditorProps) {
  // Default overrides for better UX
  const defaultOverrides = {
    ...overrides,
    
    // Wrap fields with loading indicator for resolveData
    fields: overrides?.fields || (({ children, isLoading }) => (
      <div className="relative">
        {children}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}
      </div>
    )),
  };

  return (
    <Puck 
      config={pageBuilderConfig} 
      data={data} 
      overrides={defaultOverrides}
      {...props} 
    />
  );
}
