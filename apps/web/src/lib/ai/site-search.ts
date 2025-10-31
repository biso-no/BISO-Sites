import { tool } from "ai";
import { z } from "zod";

const VALID_INDICES = ["jobs", "events", "news", "units"] as const;
type ValidIndex = (typeof VALID_INDICES)[number];

function resolveBaseUrl() {
  // Prefer explicit base URL for server-side fetches
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  );
}

export const searchSiteContent = tool({
  description:
    "Search public BISO site content (jobs, events, news). Returns concise items with titles and links for user navigation.",
  inputSchema: z.object({
    query: z.string().min(1, "query required"),
    indices: z
      .array(z.enum(VALID_INDICES))
      .optional()
      .describe("Optional indices to restrict search: jobs, events, news"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .default(5)
      .describe("Max number of items to return"),
    locale: z
      .enum(["en", "no"])
      .optional()
      .describe("Optional locale for titles/snippets"),
  }),
  execute: async ({ query, indices, limit, locale }: { query: string; indices?: ValidIndex[]; limit: number; locale?: "en" | "no" }) => {
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, indices, limit, locale }),
        // Next.js will cache POST by default unless we disable; ensure fresh
        cache: "no-store",
      });
      if (!res.ok) {
        return { results: [], message: `Search failed with status ${res.status}` };
      }
      const data = (await res.json()) as { results: Array<{ title?: string; name?: string; description?: string; href?: string; index?: string }> };
      const items = (data.results || []).map((r) => ({
        title: r.title || r.name || "Untitled",
        description: r.description || undefined,
        href: r.href || "#",
        index: r.index || undefined,
      }));

      const count = items.length;
      const msg = locale === "no"
        ? (count > 0 ? `Fant ${count} relevante treff på nettsiden.` : "Fant ingen relevante treff på nettsiden.")
        : (count > 0 ? `Found ${count} relevant results on the site.` : "No relevant site results found.");

      return { results: items, totalResults: count, message: msg };
    } catch (error) {
      console.error("Error searching site content:", error);
      return { results: [], message: "Search failed" };
    }
  },
});
