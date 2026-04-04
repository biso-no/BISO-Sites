'use client';

import * as React from 'react';

import type { TElement } from 'platejs';

import {
  KEYS,
  type Editor as PlateEditor,
} from 'platejs';
import {
  Plate,
  createPlateEditor,
  useEditorRef,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from 'platejs/react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { Editor, EditorContainer } from '@repo/ui/components/ui/editor';
import { PortalEditorKit } from './portal-editor-kit';
import { AIKit } from './ai-kit';

function parseContent(value: string | null | undefined): TElement[] {
  if (!value) return [{ type: 'p', children: [{ text: '' }] }];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through
    }
  }
  // Legacy plain text — wrap in a paragraph
  return [{ type: 'p', children: [{ text: value }] }];
}

function isBlockActive(editor: PlateEditor, type: string): boolean {
  try {
    const block = editor.api.block<TElement>();
    return block ? block[0].type === type : false;
  } catch {
    return false;
  }
}

function toggleBlock(editor: PlateEditor, type: string) {
  const active = isBlockActive(editor, type);
  editor.tf.setNodes({ type: active ? 'p' : type } as Partial<TElement>);
}

function insertHorizontalRule(editor: PlateEditor) {
  editor.tf.insertNodes([
    { type: KEYS.hr, children: [{ text: '' }] } as TElement,
    { type: 'p', children: [{ text: '' }] } as TElement,
  ]);
}

function toggleList(editor: PlateEditor, listStyleType: 'disc' | 'decimal') {
  try {
    const block = editor.api.block<TElement & { listStyleType?: string }>();
    const isActive = block ? block[0].listStyleType === listStyleType : false;
    editor.tf.setNodes(
      isActive
        ? ({ listStyleType: undefined, indent: undefined } as Partial<TElement>)
        : ({ listStyleType, indent: 1 } as Partial<TElement>)
    );
  } catch {
    // Silent fail
  }
}

const BTN_BASE =
  'flex items-center justify-center w-7 h-7 rounded transition-all cursor-pointer border-0 bg-transparent';
const BTN_IDLE = 'text-white/40 hover:text-white hover:bg-white/08';
const BTN_ACTIVE = 'text-[#3DA9E0] bg-[rgba(61,169,224,0.12)]';

function MarkBtn({
  nodeType,
  children,
  tooltip,
}: {
  nodeType: string;
  children: React.ReactNode;
  tooltip?: string;
}) {
  const state = useMarkToolbarButtonState({ nodeType });
  const { props } = useMarkToolbarButton(state);
  const { pressed, ...buttonProps } = props;
  return (
    <button
      type="button"
      title={tooltip}
      className={`${BTN_BASE} ${pressed ? BTN_ACTIVE : BTN_IDLE}`}
      aria-pressed={pressed}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

function BlockBtn({
  blockType,
  children,
  tooltip,
}: {
  blockType: string;
  children: React.ReactNode;
  tooltip?: string;
}) {
  const editor = useEditorRef();
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    setActive(isBlockActive(editor, blockType));
  });

  return (
    <button
      type="button"
      title={tooltip}
      className={`${BTN_BASE} ${active ? BTN_ACTIVE : BTN_IDLE}`}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleBlock(editor, blockType);
      }}
    >
      {children}
    </button>
  );
}

function ListBtn({
  listStyleType,
  children,
  tooltip,
}: {
  listStyleType: 'disc' | 'decimal';
  children: React.ReactNode;
  tooltip?: string;
}) {
  const editor = useEditorRef();
  return (
    <button
      type="button"
      title={tooltip}
      className={`${BTN_BASE} ${BTN_IDLE}`}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleList(editor, listStyleType);
      }}
    >
      {children}
    </button>
  );
}

function HrBtn() {
  const editor = useEditorRef();
  return (
    <button
      type="button"
      title="Horizontal rule"
      className={`${BTN_BASE} ${BTN_IDLE}`}
      onMouseDown={(e) => {
        e.preventDefault();
        insertHorizontalRule(editor);
      }}
    >
      <Minus size={14} />
    </button>
  );
}

const SEP = (
  <div
    className="w-px self-stretch mx-1"
    style={{ background: 'rgba(255,255,255,0.08)' }}
  />
);

function EditorToolbar() {
  return (
    <div
      className="flex items-center gap-0.5 px-3 py-2 flex-wrap"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <BlockBtn blockType="h1" tooltip="Heading 1">
        <Heading1 size={14} />
      </BlockBtn>
      <BlockBtn blockType="h2" tooltip="Heading 2">
        <Heading2 size={14} />
      </BlockBtn>
      <BlockBtn blockType="h3" tooltip="Heading 3">
        <Heading3 size={14} />
      </BlockBtn>

      {SEP}

      <MarkBtn nodeType={KEYS.bold} tooltip="Bold (Ctrl+B)">
        <Bold size={14} />
      </MarkBtn>
      <MarkBtn nodeType={KEYS.italic} tooltip="Italic (Ctrl+I)">
        <Italic size={14} />
      </MarkBtn>
      <MarkBtn nodeType={KEYS.underline} tooltip="Underline (Ctrl+U)">
        <Underline size={14} />
      </MarkBtn>
      <MarkBtn nodeType={KEYS.strikethrough} tooltip="Strikethrough">
        <Strikethrough size={14} />
      </MarkBtn>
      <MarkBtn nodeType={KEYS.code} tooltip="Inline code (Ctrl+E)">
        <Code size={14} />
      </MarkBtn>

      {SEP}

      <BlockBtn blockType="blockquote" tooltip="Blockquote">
        <Quote size={14} />
      </BlockBtn>
      <ListBtn listStyleType="disc" tooltip="Bullet list">
        <List size={14} />
      </ListBtn>
      <ListBtn listStyleType="decimal" tooltip="Numbered list">
        <ListOrdered size={14} />
      </ListBtn>

      {SEP}

      <HrBtn />
    </div>
  );
}

export type PortalBodyEditorProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export function PortalBodyEditor({
  value,
  onChange,
  placeholder = 'Write something incredible...',
  minHeight = 240,
}: PortalBodyEditorProps) {
  const initialValue = React.useMemo(() => parseContent(value), []);

  const editor = React.useMemo(
    () =>
      createPlateEditor({
        plugins: [
          ...PortalEditorKit,
          ...AIKit
        ],
        value: initialValue,
      }),
    []
  );

  const handleChange = React.useCallback(
    ({ value: nodes }: { value: TElement[] }) => {
      onChange(JSON.stringify(nodes));
    },
    [onChange]
  );

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onFocusCapture={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          'rgba(61,169,224,0.40)';
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          (e.currentTarget as HTMLElement).style.borderColor =
            'rgba(255,255,255,0.08)';
        }
      }}
    >
      <Plate
        editor={editor}
        onChange={handleChange}
      >
        <EditorToolbar />
        <EditorContainer variant="default">
          <Editor
            variant="none"
            placeholder={placeholder}
            className="size-full px-5 py-4 text-sm text-white/90"
            style={{ minHeight }}
          />
        </EditorContainer>
      </Plate>
    </div>
  );
}
