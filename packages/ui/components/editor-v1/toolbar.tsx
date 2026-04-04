'use client';

import * as React from 'react';

import { insertCallout } from '@platejs/callout';
import { insertImage } from '@platejs/media';
import { upsertLink } from '@platejs/link';
import { KEYS } from 'platejs';
import type { TElement } from 'platejs';
import {
  useEditorRef,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from 'platejs/react';
import {
  Bold,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  PlusSquare,
  Quote,
  Sparkles,
  TextQuote,
} from 'lucide-react';

import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from '@repo/ui/components/ui/toolbar';

import { createEmptyParagraph, type EditorV1Variant } from './document';
import { editorV1VariantMeta } from './plugins';

function isBlockActive(editor: ReturnType<typeof useEditorRef>, type: string) {
  try {
    const block = editor.api.block<TElement>();
    return block ? block[0].type === type : false;
  } catch {
    return false;
  }
}

function MarkButton({
  nodeType,
  tooltip,
  children,
}: {
  nodeType: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  const state = useMarkToolbarButtonState({ nodeType });
  const { props } = useMarkToolbarButton(state);
  const { pressed, ...buttonProps } = props;

  return (
    <ToolbarButton pressed={pressed} tooltip={tooltip} {...buttonProps}>
      {children}
    </ToolbarButton>
  );
}

function BlockButton({
  blockType,
  tooltip,
  children,
}: {
  blockType: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  const editor = useEditorRef();
  const active = isBlockActive(editor, blockType);

  return (
    <ToolbarButton
      pressed={active}
      tooltip={tooltip}
      onMouseDown={(event) => {
        event.preventDefault();
        editor.tf.setNodes({ type: active ? KEYS.p : blockType } as Partial<TElement>);
      }}
    >
      {children}
    </ToolbarButton>
  );
}

function ListButton({
  listStyleType,
  tooltip,
  children,
}: {
  listStyleType: 'disc' | 'decimal';
  tooltip: string;
  children: React.ReactNode;
}) {
  const editor = useEditorRef();
  let active = false;
  try {
    const block = editor.api.block<TElement & { listStyleType?: string }>();
    active = block ? block[0].listStyleType === listStyleType : false;
  } catch {
    active = false;
  }

  return (
    <ToolbarButton
      pressed={active}
      tooltip={tooltip}
      onMouseDown={(event) => {
        event.preventDefault();
        try {
          const block = editor.api.block<TElement & { listStyleType?: string }>();
          const isActive = block ? block[0].listStyleType === listStyleType : false;
          editor.tf.setNodes(
            isActive
              ? ({ listStyleType: undefined, indent: undefined } as Partial<TElement>)
              : ({ listStyleType, indent: 1 } as Partial<TElement>)
          );
        } catch {
          // ignore editor-state edge cases
        }
      }}
    >
      {children}
    </ToolbarButton>
  );
}

function LinkButton() {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      tooltip="Insert link"
      onMouseDown={(event) => {
        event.preventDefault();
        const url = window.prompt('Paste the link URL');
        if (!url) return;

        const label = window.prompt('Optional link label', '');
        upsertLink(editor, {
          text: label || undefined,
          url,
        });
      }}
    >
      <LinkIcon className="size-4" />
    </ToolbarButton>
  );
}

function SectionTemplateButton({ variant }: { variant: EditorV1Variant }) {
  const editor = useEditorRef();
  const meta = editorV1VariantMeta[variant];

  return (
    <ToolbarButton
      tooltip="Add a new section"
      onMouseDown={(event) => {
        event.preventDefault();
        editor.tf.insertNodes([
          {
            type: KEYS.h2,
            children: [{ text: meta.sectionTitle }],
          } as TElement,
          createEmptyParagraph(meta.sectionBody),
        ]);
      }}
    >
      <PlusSquare className="size-4" />
      <span className="hidden sm:inline">Section</span>
    </ToolbarButton>
  );
}

function CalloutButton() {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      tooltip="Insert highlight box"
      onMouseDown={(event) => {
        event.preventDefault();
        insertCallout(editor, {
          icon: '💡',
          variant: 'info',
        });
      }}
    >
      <Sparkles className="size-4" />
      <span className="hidden sm:inline">Highlight</span>
    </ToolbarButton>
  );
}

function ImageButton() {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      tooltip="Insert image from URL"
      onMouseDown={(event) => {
        event.preventDefault();
        const url = window.prompt('Paste an image URL');
        if (!url) return;
        insertImage(editor, url);
      }}
    >
      <ImagePlus className="size-4" />
      <span className="hidden sm:inline">Image</span>
    </ToolbarButton>
  );
}

export function EditorV1Toolbar({ variant }: { variant: EditorV1Variant }) {
  return (
    <div className="border-white/8 border-b bg-white/[0.02] px-2 py-2">
      <Toolbar className="flex flex-wrap gap-1">
        <ToolbarGroup>
          <SectionTemplateButton variant={variant} />
          <CalloutButton />
          <ImageButton />
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup>
          <BlockButton blockType={KEYS.h1} tooltip="Heading 1">
            <Heading1 className="size-4" />
          </BlockButton>
          <BlockButton blockType={KEYS.h2} tooltip="Heading 2">
            <Heading2 className="size-4" />
          </BlockButton>
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup>
          <MarkButton nodeType={KEYS.bold} tooltip="Bold">
            <Bold className="size-4" />
          </MarkButton>
          <MarkButton nodeType={KEYS.italic} tooltip="Italic">
            <Italic className="size-4" />
          </MarkButton>
          <LinkButton />
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup>
          <ListButton listStyleType="disc" tooltip="Bullet list">
            <List className="size-4" />
          </ListButton>
          <ListButton listStyleType="decimal" tooltip="Numbered list">
            <ListOrdered className="size-4" />
          </ListButton>
          <BlockButton blockType={KEYS.blockquote} tooltip="Quote">
            <Quote className="size-4" />
          </BlockButton>
        </ToolbarGroup>
      </Toolbar>
    </div>
  );
}

export function EditorV1Helper({ variant }: { variant: EditorV1Variant }) {
  return (
    <div className="border-white/6 border-b bg-white/[0.015] px-4 py-2 text-white/55 text-xs">
      <div className="flex items-center gap-2">
        <TextQuote className="size-3.5 text-white/35" />
        <span>{editorV1VariantMeta[variant].helper}</span>
      </div>
    </div>
  );
}
