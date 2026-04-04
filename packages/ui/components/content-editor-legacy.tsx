'use client';

/**
 * ContentEditor
 *
 * A typed PlateJS editor that selects the right plugin set based on content type.
 * Drop-in replacement for PortalBodyEditor with AI copilot, floating toolbar,
 * and per-content-type plugin extensions.
 *
 * Usage:
 *   <ContentEditor variant="events" value={json} onChange={setJson} />
 *   <ContentEditor variant="news" value={json} onChange={setJson} placeholder="Write…" />
 */

import * as React from 'react';

import type { TElement } from 'platejs';

import { Plate, createPlateEditor } from 'platejs/react';

import { Editor, EditorContainer } from '@repo/ui/components/ui/editor';

import { AIKit } from './ai-kit';
import { CopilotKit } from './copilot-kit';
import { parsePlateContent } from './editor/serialization';
import { FixedToolbar } from './editor/toolbar/fixed-toolbar';
import { FloatingToolbar } from './editor/toolbar/floating-toolbar';

import { BaseEditorPlugins } from './editor/plugins/base';
import { EventsEditorPlugins } from './editor/plugins/events';
import { JobsEditorPlugins } from './editor/plugins/jobs';
import { NewsEditorPlugins } from './editor/plugins/news';
import { ProductsEditorPlugins } from './editor/plugins/products';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentEditorVariant = 'base' | 'events' | 'news' | 'jobs' | 'products';

export interface ContentEditorProps {
  /** Content type — selects the appropriate plugin set */
  variant?: ContentEditorVariant;
  /** Stored value: Plate JSON string, plain text, or null/undefined */
  value: string | null | undefined;
  /** Called with the new Plate JSON string on every change */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Minimum height of the editable area in px */
  minHeight?: number;
  disabled?: boolean;
  className?: string;
}

// ── Plugin selection ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPlugins(variant: ContentEditorVariant): any[] {
  switch (variant) {
    case 'events': return [...EventsEditorPlugins, ...AIKit, ...CopilotKit];
    case 'news':   return [...NewsEditorPlugins,   ...AIKit, ...CopilotKit];
    case 'jobs':   return [...JobsEditorPlugins,   ...AIKit, ...CopilotKit];
    case 'products': return [...ProductsEditorPlugins, ...AIKit, ...CopilotKit];
    default:       return [...BaseEditorPlugins,   ...AIKit, ...CopilotKit];
  }
}

// ── ContentEditor ─────────────────────────────────────────────────────────────

export function LegacyContentEditor({
  variant = 'base',
  value,
  onChange,
  placeholder = 'Write something incredible…',
  minHeight = 240,
  disabled = false,
  className,
}: ContentEditorProps) {
  const initialValue = React.useMemo(() => parsePlateContent(value), []);

  const editor = React.useMemo(
    () =>
      createPlateEditor({
        plugins: getPlugins(variant),
        value: initialValue,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variant]
  );

  const handleChange = React.useCallback(
    ({ value: nodes }: { value: TElement[] }) => {
      onChange(JSON.stringify(nodes));
    },
    [onChange]
  );

  return (
    <div
      className={className}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
      onFocusCapture={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(61,169,224,0.40)';
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
        }
      }}
    >
      <Plate editor={editor} onChange={handleChange}>
        {/* Fixed toolbar — must stay outside EditorContainer but inside Plate.
             ignore-click-outside/toolbar prevents Plate treating toolbar clicks as editor blur. */}
        <div className="ignore-click-outside/toolbar px-2 py-1 flex items-center flex-wrap gap-0.5">
          <FixedToolbar />
        </div>

        {/* Content area */}
        <EditorContainer variant="default">
          <Editor
            variant="none"
            placeholder={placeholder}
            disabled={disabled}
            className="size-full px-5 py-4 text-sm text-white/90"
            style={{ minHeight }}
          />
        </EditorContainer>

        {/* Floating toolbar — rendered into a portal at document level */}
        <FloatingToolbar />
      </Plate>
    </div>
  );
}

