import { resolveAllData } from "@measured/puck";
import { PageBuilderRenderer } from "./renderer";
import { pageBuilderConfig } from "./page-builder-config";
import type { PageBuilderDocument, PageBuilderMetadata } from "./types";

export interface ServerRendererProps {
  data: PageBuilderDocument;
  metadata?: PageBuilderMetadata;
}

/**
 * Server-side renderer that resolves all dynamic data before rendering
 * This should be used in Next.js Server Components for the web app
 */
export async function ServerRenderer({ data, metadata }: ServerRendererProps) {
  // Resolve all data (executes resolveData for all components)
  const resolvedData = await resolveAllData(data, pageBuilderConfig);

  return <PageBuilderRenderer data={resolvedData} metadata={metadata} />;
}

