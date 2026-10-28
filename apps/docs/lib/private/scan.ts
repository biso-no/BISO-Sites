const TAG = /<Private\b[^>]*>/g;
const NAME = /\bname=(["'])([^"']+)\1/;

/** Finds `<Private>` tags in MDX text: their names, and tags with no literal name. */
export function scanPrivateUsages(source: string): {
  names: string[];
  unnamed: string[];
} {
  const names: string[] = [];
  const unnamed: string[] = [];
  for (const [tag] of source.matchAll(TAG)) {
    const match = NAME.exec(tag);
    if (match) {
      names.push(match[2] as string);
    } else {
      unnamed.push(tag);
    }
  }
  return { names, unnamed };
}
