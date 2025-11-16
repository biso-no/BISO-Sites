import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
  type DocsCollection,
  type GlobalConfig,
} from 'fumadocs-mdx/config';

// Define a single documentation source that includes all content
// Root folders will be automatically detected from meta.json files with "root": true

export const docs = defineDocs({
  dir: 'content/docs',
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
    remarkPlugins: [remarkMdxMermaid]
  },
});

export default config;
