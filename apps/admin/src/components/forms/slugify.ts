const RE_SPACES = /\s+/g;
const RE_INVALID = /[^\w-]+/g;
const RE_MULTI_DASH = /--+/g;
const RE_LEADING_DASH = /^-+/;
const RE_TRAILING_DASH = /-+$/;

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(RE_SPACES, "-")
    .replace(RE_INVALID, "")
    .replace(RE_MULTI_DASH, "-")
    .replace(RE_LEADING_DASH, "")
    .replace(RE_TRAILING_DASH, "");
}
