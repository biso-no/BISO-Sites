import { Render } from "@measured/puck";
import "@measured/puck/puck.css";
import { pageBuilderConfig } from "./page-builder-config";
import type { PageBuilderDocument, PageBuilderMetadata } from "./types";

export interface PageBuilderRendererProps {
  data: PageBuilderDocument;
  metadata?: PageBuilderMetadata;
}

export function PageBuilderRenderer({ data, metadata }: PageBuilderRendererProps) {
  return <Render config={pageBuilderConfig} data={data} metadata={metadata} />;
}
