'use client';

/**
 * Fixed toolbar — sits above the editor content area.
 * Renders a comprehensive set of formatting buttons using Plate's hooks
 * so they stay in sync with the editor selection state.
 */

import * as React from 'react';

import { KEYS } from 'platejs';
import {
  useEditorRef,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from 'platejs/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Sparkles,
  Strikethrough,
  Underline,
} from 'lucide-react';

import type { TElement } from 'platejs';

import { AIToolbarButton } from '@repo/ui/components/ui/ai-toolbar-button';
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from '@repo/ui/components/ui/toolbar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBlockActive(editor: ReturnType<typeof useEditorRef>, type: string) {
  try {
    const block = editor.api.block<TElement>();
    return block ? block[0].type === type : false;
  } catch {
    return false;
  }
}

// ── Mark button ───────────────────────────────────────────────────────────────

function MarkBtn({
  nodeType,
  children,
  tooltip,
}: {
  nodeType: string;
  children: React.ReactNode;
  tooltip: string;
}) {
  const state = useMarkToolbarButtonState({ nodeType });
  const { props } = useMarkToolbarButton(state);
  const { pressed, ...buttonProps } = props;
  return (
    <ToolbarButton
      pressed={pressed}
      tooltip={tooltip}
      {...buttonProps}
    >
      {children}
    </ToolbarButton>
  );
}

// ── Block button ──────────────────────────────────────────────────────────────

function BlockBtn({
  blockType,
  children,
  tooltip,
}: {
  blockType: string;
  children: React.ReactNode;
  tooltip: string;
}) {
  const editor = useEditorRef();
  const [active, setActive] = React.useState(false);

  // Sync on every render (Plate selection changes trigger re-render)
  React.useEffect(() => {
    setActive(isBlockActive(editor, blockType));
  });

  return (
    <ToolbarButton
      pressed={active}
      tooltip={tooltip}
      onMouseDown={(e) => {
        e.preventDefault();
        const isActive = isBlockActive(editor, blockType);
        editor.tf.setNodes({ type: isActive ? 'p' : blockType } as Partial<TElement>);
      }}
    >
      {children}
    </ToolbarButton>
  );
}

// ── List button ───────────────────────────────────────────────────────────────

function ListBtn({
  listStyleType,
  children,
  tooltip,
}: {
  listStyleType: 'disc' | 'decimal';
  children: React.ReactNode;
  tooltip: string;
}) {
  const editor = useEditorRef();
  return (
    <ToolbarButton
      tooltip={tooltip}
      onMouseDown={(e) => {
        e.preventDefault();
        try {
          const block = editor.api.block<TElement & { listStyleType?: string }>();
          const isActive = block ? block[0].listStyleType === listStyleType : false;
          editor.tf.setNodes(
            isActive
              ? ({ listStyleType: undefined, indent: undefined } as Partial<TElement>)
              : ({ listStyleType, indent: 1 } as Partial<TElement>)
          );
        } catch {
          // silent
        }
      }}
    >
      {children}
    </ToolbarButton>
  );
}

// ── Align button ──────────────────────────────────────────────────────────────

function AlignBtn({
  align,
  children,
  tooltip,
}: {
  align: string;
  children: React.ReactNode;
  tooltip: string;
}) {
  const editor = useEditorRef();
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    try {
      const block = editor.api.block<TElement & { align?: string }>();
      setActive(block ? block[0].align === align : false);
    } catch {
      setActive(false);
    }
  });

  return (
    <ToolbarButton
      pressed={active}
      tooltip={tooltip}
      onMouseDown={(e) => {
        e.preventDefault();
        editor.tf.setNodes({ align } as Partial<TElement>);
      }}
    >
      {children}
    </ToolbarButton>
  );
}


// ── Fixed Toolbar ─────────────────────────────────────────────────────────────

export interface FixedToolbarProps {
  className?: string;
}

export function FixedToolbar({ className }: FixedToolbarProps) {
  return (
    <Toolbar
      className={className}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* AI — uses existing AIToolbarButton which correctly separates
           onMouseDown:preventDefault and onClick:show() to preserve isFocusedLast */}
      <ToolbarGroup>
        <AIToolbarButton tooltip="AI Assistant (⌘J)" className="gap-1.5 text-primary">
          <Sparkles className="size-4" />
          <span className="text-xs font-medium">AI</span>
        </AIToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Headings */}
      <ToolbarGroup>
        <BlockBtn blockType={KEYS.h1} tooltip="Heading 1">
          <Heading1 className="size-4" />
        </BlockBtn>
        <BlockBtn blockType={KEYS.h2} tooltip="Heading 2">
          <Heading2 className="size-4" />
        </BlockBtn>
        <BlockBtn blockType={KEYS.h3} tooltip="Heading 3">
          <Heading3 className="size-4" />
        </BlockBtn>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Marks */}
      <ToolbarGroup>
        <MarkBtn nodeType={KEYS.bold} tooltip="Bold (⌘B)">
          <Bold className="size-4" />
        </MarkBtn>
        <MarkBtn nodeType={KEYS.italic} tooltip="Italic (⌘I)">
          <Italic className="size-4" />
        </MarkBtn>
        <MarkBtn nodeType={KEYS.underline} tooltip="Underline (⌘U)">
          <Underline className="size-4" />
        </MarkBtn>
        <MarkBtn nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <Strikethrough className="size-4" />
        </MarkBtn>
        <MarkBtn nodeType={KEYS.code} tooltip="Inline code (⌘E)">
          <Code className="size-4" />
        </MarkBtn>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Blocks */}
      <ToolbarGroup>
        <BlockBtn blockType={KEYS.blockquote} tooltip="Blockquote">
          <Quote className="size-4" />
        </BlockBtn>
        <ListBtn listStyleType="disc" tooltip="Bullet list">
          <List className="size-4" />
        </ListBtn>
        <ListBtn listStyleType="decimal" tooltip="Numbered list">
          <ListOrdered className="size-4" />
        </ListBtn>
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Alignment */}
      <ToolbarGroup>
        <AlignBtn align="left" tooltip="Align left">
          <AlignLeft className="size-4" />
        </AlignBtn>
        <AlignBtn align="center" tooltip="Align center">
          <AlignCenter className="size-4" />
        </AlignBtn>
        <AlignBtn align="right" tooltip="Align right">
          <AlignRight className="size-4" />
        </AlignBtn>
      </ToolbarGroup>

      {/* Link button (opens Plate's built-in link dialog) */}
      <ToolbarSeparator />
      <ToolbarGroup>
        <LinkToolbarBtn />
      </ToolbarGroup>
    </Toolbar>
  );
}

function LinkToolbarBtn() {
  const editor = useEditorRef();
  return (
    <ToolbarButton
      tooltip="Insert link"
      onMouseDown={(e) => {
        e.preventDefault();
        // Trigger Plate's link float via the editor API
        try {
          (editor.api as any).floatingLink?.show?.('edit', editor.id);
        } catch {
          // Fallback for environments without floatingLink
        }
      }}
    >
      <LinkIcon className="size-4" />
    </ToolbarButton>
  );
}
