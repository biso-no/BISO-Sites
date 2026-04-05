import { parseEditorV1Value } from './editor-v1/document';
import { toHtml } from './editor/serialization';

interface PlateContentRendererProps {
  value: string | null | undefined;
  className?: string;
}

export function PlateContentRenderer({ value, className }: PlateContentRendererProps) {
  if (!value) return null;
  const { blocks } = parseEditorV1Value(value);
  const html = toHtml(blocks);
  return (
    <article
      className={`prose dark:prose-invert max-w-none ${className ?? ''}`}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is authored by trusted admins in the CMS.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
