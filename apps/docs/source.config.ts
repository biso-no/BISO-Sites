import { execFile } from "node:child_process";
import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
} from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";
import { createGitDateLookup } from "./lib/git-dates";
import { remarkStepIds } from "./lib/step-ids";

const gitDates = createGitDateLookup(
  (args) =>
    new Promise((resolve) => {
      execFile("git", args, (error, stdout) => {
        const failed = error !== null;
        resolve({ exitCode: failed ? 1 : 0, stdout: String(stdout) });
      });
    })
);

/** @public — collection consumed by fumadocs codegen (.source). */
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: frontmatterSchema.extend({
      who: z.string().optional(),
      covers: z.array(z.string()).optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  // An array lands after Fumadocs' own heading plugin, so step ids can avoid
  // heading ids.
  mdxOptions: { remarkPlugins: [remarkStepIds] },
  plugins: [lastModified({ versionControl: gitDates })],
});
