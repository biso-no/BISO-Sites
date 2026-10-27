import { existsSync } from "node:fs";
import { join } from "node:path";

export const AREA_ROOTS = ["guide", "developers"] as const;

export type ResolvedHref =
  | { kind: "landing" }
  | { kind: "page"; file: string }
  | null;

const APP_ROOT = join(import.meta.dir, "..");
const QUERY_OR_HASH = /[?#].*$/;
const SLASHES = /^\/+|\/+$/g;

export function resolveHref(href: string): ResolvedHref {
  const path = href.replace(QUERY_OR_HASH, "").replace(SLASHES, "");
  if (path === "") {
    return { kind: "landing" };
  }

  const candidates = [
    `content/docs/${path}.mdx`,
    `content/docs/${path}/index.mdx`,
  ];
  for (const file of candidates) {
    if (existsSync(join(APP_ROOT, file))) {
      return { kind: "page", file };
    }
  }
  return null;
}
