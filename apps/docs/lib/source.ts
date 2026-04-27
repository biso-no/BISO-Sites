import { docs } from "collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

type PageDataWithText = InferPageType<typeof source>["data"] & {
  getText: (type: "raw" | "processed") => Promise<string>;
};

// Create a single loader for all documentation
// Root folders (marked with "root": true in meta.json) will automatically create sidebar tabs
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const pageData = page.data as PageDataWithText;
  const processed = await pageData.getText("processed");

  return `# ${page.data.title} (${page.url})

${processed}`;
}
