'use client';

import { ContentEditorV1 } from './editor-v1/content-editor-v1';
import { LegacyContentEditor } from './content-editor-legacy';

export type ContentEditorVariant = 'base' | 'events' | 'news' | 'jobs' | 'products';

export interface ContentEditorProps {
  ariaLabel?: string;
  id?: string;
  variant?: ContentEditorVariant;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  className?: string;
}

function shouldUseEditorV1(variant: ContentEditorVariant) {
  return variant === 'news' || variant === 'events' || variant === 'jobs';
}

export function ContentEditor(props: ContentEditorProps) {
  const variant = props.variant ?? 'base';

  if (shouldUseEditorV1(variant)) {
    return <ContentEditorV1 {...props} variant={variant} />;
  }

  return <LegacyContentEditor {...props} variant={variant} />;
}
