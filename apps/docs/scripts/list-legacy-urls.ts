import { readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const legacyDir = join(root, "legacy");
const MDX_EXT = /\.mdx$/;
const INDEX_SUFFIX = /\/index$/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(full);
    }
    return entry.name.endsWith(".mdx") ? [full] : [];
  });
}

const urls = walk(legacyDir).map((file) => {
  const rel = relative(legacyDir, file).replace(MDX_EXT, "");
  const route = rel.replace(INDEX_SUFFIX, "");
  return route === "index" ? "/docs" : `/docs/${route}`;
});

urls.sort();
writeFileSync(
  join(root, "legacy-urls.json"),
  `${JSON.stringify(urls, null, 2)}\n`
);
