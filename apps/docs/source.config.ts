import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/** @public — collection consumed by fumadocs codegen (.source). */
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig();
