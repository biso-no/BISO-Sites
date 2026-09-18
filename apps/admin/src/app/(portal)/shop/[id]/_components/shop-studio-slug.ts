/**
 * Slug derivation for the product studio.
 *
 * Kept out of `shop-studio-editor.tsx` so the rules can be tested without
 * rendering the editor (and without dragging its dependency tree into the
 * test process).
 */

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * The slug a title edit should produce, or `null` to leave the slug untouched.
 *
 * Auto-derivation follows the title on **every** keystroke, not just the first:
 * deciding from `slug` being empty froze the slug after one character, because
 * typing `T` made it truthy. `locked` is the only thing that stops it — either
 * the product was loaded with a saved slug (rewriting it would 404 live links)
 * or an editor typed one by hand.
 */
export function nextAutoSlug({
  locked,
  title,
}: {
  locked: boolean;
  title: string;
}): string | null {
  if (locked) {
    return null;
  }
  return generateSlug(title);
}
