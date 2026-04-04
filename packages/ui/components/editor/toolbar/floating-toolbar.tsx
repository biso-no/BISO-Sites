'use client';

/**
 * Floating toolbar — appears above selected text.
 * Uses Plate's selection state to detect non-collapsed selections
 * and positions itself using a portal anchored to the selection range.
 */

import * as React from 'react';

import { KEYS } from 'platejs';
import {
  useEditorRef,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from 'platejs/react';
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline,
} from 'lucide-react';

import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from '@repo/ui/components/ui/toolbar';

// ── Mark button ───────────────────────────────────────────────────────────────

function FloatMarkBtn({
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
    <ToolbarButton pressed={pressed} tooltip={tooltip} size="sm" {...buttonProps}>
      {children}
    </ToolbarButton>
  );
}

// ── Floating Toolbar content ──────────────────────────────────────────────────

function FloatingToolbarContent() {
  const editor = useEditorRef();

  return (
    <Toolbar className="flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-0.5 shadow-md">
      <ToolbarGroup>
        <FloatMarkBtn nodeType={KEYS.bold} tooltip="Bold">
          <Bold className="size-3.5" />
        </FloatMarkBtn>
        <FloatMarkBtn nodeType={KEYS.italic} tooltip="Italic">
          <Italic className="size-3.5" />
        </FloatMarkBtn>
        <FloatMarkBtn nodeType={KEYS.underline} tooltip="Underline">
          <Underline className="size-3.5" />
        </FloatMarkBtn>
        <FloatMarkBtn nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <Strikethrough className="size-3.5" />
        </FloatMarkBtn>
        <FloatMarkBtn nodeType={KEYS.code} tooltip="Inline code">
          <Code className="size-3.5" />
        </FloatMarkBtn>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          size="sm"
          tooltip="Link"
          onMouseDown={(e) => {
            e.preventDefault();
            try {
              (editor.api as any).floatingLink?.show?.('edit', editor.id);
            } catch {
              // silent
            }
          }}
        >
          <LinkIcon className="size-3.5" />
        </ToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}

// ── Floating Toolbar (positioned via native Selection API) ────────────────────

export function FloatingToolbar() {
  const editor = useEditorRef();
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function updatePosition() {
      const selection = window.getSelection();
      if (
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        !selection.toString().trim()
      ) {
        setRect(null);
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const domRect = range.getBoundingClientRect();
        setRect(domRect);
      } catch {
        setRect(null);
      }
    }

    document.addEventListener('selectionchange', updatePosition);
    return () => document.removeEventListener('selectionchange', updatePosition);
  }, [editor]);

  if (!rect) return null;

  const toolbarWidth = 280;
  const gap = 8;
  const left = Math.max(
    8,
    Math.min(
      rect.left + rect.width / 2 - toolbarWidth / 2,
      window.innerWidth - toolbarWidth - 8
    )
  );
  const top = rect.top + window.scrollY - (toolbarRef.current?.offsetHeight ?? 40) - gap;

  return (
    <div
      ref={toolbarRef}
      className="pointer-events-auto fixed z-50"
      style={{ left, top }}
      // Prevent the toolbar from stealing focus / collapsing selection
      onMouseDown={(e) => e.preventDefault()}
    >
      <FloatingToolbarContent />
    </div>
  );
}
