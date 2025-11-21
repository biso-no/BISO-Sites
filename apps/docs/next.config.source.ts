import {
  remarkHeading,
  remarkMdxFiles,
  remarkMdxMermaid,
  remarkNpm,
  remarkSteps,
  remarkStructure,
} from "fumadocs-core/mdx-plugins";
import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  type GlobalConfig,
  metaSchema,
} from "fumadocs-mdx/config";

// Define a single documentation source that includes all content
// Root folders will be automatically detected from meta.json files with "root": true

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const config: GlobalConfig = defineConfig({
  mdxOptions: {
    remarkPlugins: [
      remarkMdxMermaid,
      remarkMdxFiles,
      remarkStructure,
      remarkHeading,
      remarkNpm,
      remarkSteps,
    ],
  },
});

export default config;
