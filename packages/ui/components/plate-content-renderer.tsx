import { parseEditorV1Value } from './editor-v1/document';
import { toHtml } from './editor/serialization';

interface PlateContentRendererProps {
  value: string | null | undefined;
  className?: string;
}

export function PlateContentRenderer({ value, className }: PlateContentRendererProps) {
  if (!value) return null;

  const trimmed = value.trim();
  const articleClass = `prose dark:prose-invert max-w-none ${className ?? ''}`;

  // Raw HTML path (Job Studio Editor stores HTML strings)
  if (trimmed.startsWith('<')) {
    return (
      <article
        className={articleClass}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is authored by trusted admins in the CMS.
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    );
  }

  // Plate.js JSON path (ContentEditorV1 stores JSON block arrays)
  const { blocks } = parseEditorV1Value(trimmed);
  const html = toHtml(blocks);
  return (
    <article
      className={articleClass}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is authored by trusted admins in the CMS.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
