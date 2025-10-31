"use client";

import { Render as PuckRender } from "@measured/puck";
import { config } from "../config";
import { EditorData } from "../types";

interface RenderProps {
  data: EditorData;
}

/**
 * The Puck Render component for displaying published pages
 * 
 * @example
 * ```tsx
 * import { Render } from "@repo/editor";
 * 
 * function PublishedPage({ pageData }) {
 *   return <Render data={pageData} />;
 * }
 * ```
 */
export function Render({ data }: RenderProps) {
  if (!data || !data.content) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">No content to display</p>
      </div>
    );
  }

  return <PuckRender config={config} data={data} />;
}
