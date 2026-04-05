'use client';

import * as React from 'react';

import type { TElement } from 'platejs';

import { Plate, createPlateEditor } from 'platejs/react';

import { Editor, EditorContainer } from '@repo/ui/components/ui/editor';

import {
  parseEditorV1Value,
  stringifyEditorV1Document,
  type EditorV1Variant,
} from './document';
import { editorV1Plugins, editorV1VariantMeta } from './plugins';
import { EditorV1Helper, EditorV1Toolbar } from './toolbar';

export interface ContentEditorV1Props {
  variant: EditorV1Variant;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  className?: string;
}

export function ContentEditorV1({
  className,
  disabled = false,
  minHeight = 240,
  onChange,
  placeholder,
  value,
  variant,
}: ContentEditorV1Props) {
  const initialDocument = React.useMemo(() => parseEditorV1Value(value), []);
  const meta = editorV1VariantMeta[variant];

  const editor = React.useMemo(
    () =>
      createPlateEditor({
        plugins: editorV1Plugins,
        value: initialDocument.blocks,
      }),
    [initialDocument.blocks]
  );

  const handleChange = React.useCallback(
    ({ value: blocks }: { value: TElement[] }) => {
      onChange(
        stringifyEditorV1Document({
          blocks,
          version: 1,
        })
      );
    },
    [onChange]
  );

  return (
    <div
      className={className}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '1rem',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
      onFocusCapture={(event) => {
        (event.currentTarget as HTMLElement).style.borderColor = 'rgba(61,169,224,0.40)';
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          (event.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
        }
      }}
    >
      <Plate editor={editor} onChange={handleChange}>
        <EditorV1Toolbar variant={variant} />
        <EditorV1Helper variant={variant} />
        <EditorContainer variant="default">
          <Editor
            variant="none"
            placeholder={placeholder ?? meta.placeholder}
            disabled={disabled}
            className="size-full px-5 py-4 text-sm text-white/90"
            style={{ minHeight }}
          />
        </EditorContainer>
      </Plate>
    </div>
  );
}
