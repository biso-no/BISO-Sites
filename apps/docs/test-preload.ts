import { plugin } from "bun";
import { createMdxPlugin } from "fumadocs-mdx/bun";

// Preloaded by `bunfig.toml` for `bun test`. Without it, Bun loads each page's
// MDX as a file path, so pages have no text and the search index can't be
// built. With it, the pages compile through `source.config.ts` as in the build.
await plugin(createMdxPlugin());
