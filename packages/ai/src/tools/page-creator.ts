import { tool } from "ai";
import { z } from "zod";

const pageCreationSchema = z.object({
  title: z.string().describe("The title of the page"),
  slug: z.string().describe("URL-friendly slug for the page (e.g., 'terms-of-service')"),
  locale: z.enum(["en", "no"]).describe("Language locale for the page"),
  description: z.string().optional().describe("SEO description for the page"),
});

type PageCreationParams = z.infer<typeof pageCreationSchema>;

export function createPageCreatorTool() {
  return tool({
    description: "Navigate to the new page editor with pre-filled values. The page is NOT saved to the database until the user clicks Save or Publish. Use this when the user wants to create a new page.",
    inputSchema: pageCreationSchema,
    execute: async ({ title, slug, locale, description }: PageCreationParams) => {
      return await Promise.resolve({
        success: true,
        action: {
          type: "create-page" as const,
          title,
          slug,
          locale,
          description,
        },
        message: `Opening new page editor with title "${title}" and slug "${slug}" in ${locale === "en" ? "English" : "Norwegian"}. Page will be saved when user clicks Save or Publish.`,
      });
    },
  });
}
