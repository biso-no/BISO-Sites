import { sanitizeCmsHtml } from '../lib/sanitize-html';
import { parseEditorV1Value } from './editor-v1/document';
import { toHtml } from './editor/serialization';

interface PlateContentRendererProps {
  value: string | null | undefined;
  className?: string;
}

/**
 * Renders CMS rich text (news articles, event descriptions, job listings).
 *
 * Both branches below sanitize before injection — see `sanitizeCmsHtml` for why
 * "authored by trusted admins" is not sufficient on its own here. The JSON path
 * is sanitized too: `toHtml` serializes stored node content verbatim, so it is
 * only as safe as whatever reached the database.
 */
export function PlateContentRenderer({ value, className }: PlateContentRendererProps) {
  if (!value) return null;

  const trimmed = value.trim();
  const articleClass = `prose dark:prose-invert max-w-none ${className ?? ''}`;

  // Raw HTML path (Job Studio Editor stores HTML strings)
  if (trimmed.startsWith('<')) {
    return (
      <article
        className={articleClass}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by sanitizeCmsHtml on the line above.
        dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(trimmed) }}
      />
    );
  }

  // Plate.js JSON path (ContentEditorV1 stores JSON block arrays)
  const { blocks } = parseEditorV1Value(trimmed);
  const html = toHtml(blocks);
  return (
    <article
      className={articleClass}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by sanitizeCmsHtml on the line above.
      dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(html) }}
    />
  );
}
