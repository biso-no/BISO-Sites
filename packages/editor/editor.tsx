"use client";

import { Puck, type PuckProps } from "@measured/puck";
import "@measured/puck/puck.css";
import { pageBuilderConfig } from "./page-builder-config";
import type { PageBuilderDocument } from "./types";

export type PageBuilderEditorProps = Omit<
  PuckProps<typeof pageBuilderConfig>,
  "config" | "data"
> & {
  data: PageBuilderDocument;
};

export function PageBuilderEditor({ data, ...props }: PageBuilderEditorProps) {
  return <Puck config={pageBuilderConfig} data={data} {...props} />;
}
