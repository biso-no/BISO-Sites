'use client';

/**
 * Base editor plugin set shared by all content types.
 *
 * Extends PortalEditorKit with:
 * - Table (for structured data across all types)
 * - Callout (highlight boxes)
 * - Column layout
 * - Image/media upload
 * - H4–H6 headings (portal kit only ships h1–h3)
 */

import {
  H4Plugin,
  H5Plugin,
  H6Plugin,
  HighlightPlugin,
  KbdPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
} from '@platejs/basic-nodes/react';
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from '@platejs/table/react';
import { CalloutPlugin } from '@platejs/callout/react';
import { ColumnItemPlugin, ColumnPlugin } from '@platejs/layout/react';
import { ImagePlugin } from '@platejs/media/react';
import {
  BlockSelectionAfterEditable,
  BlockSelectionPlugin,
} from '@platejs/selection/react';

import {
  H4Element,
  H5Element,
  H6Element,
} from '@repo/ui/components/ui/heading-node';
import {
  TableCellElement,
  TableCellHeaderElement,
  TableElement,
  TableRowElement,
} from '@repo/ui/components/ui/table-node';
import { CalloutElement } from '@repo/ui/components/ui/callout-node';
import {
  ColumnElement,
  ColumnGroupElement,
} from '@repo/ui/components/ui/column-node';
import { ImageElement } from '@repo/ui/components/ui/media-image-node';
import { HighlightLeaf } from '@repo/ui/components/ui/highlight-node';
import { KbdLeaf } from '@repo/ui/components/ui/kbd-node';

import { PortalEditorKit } from '../../portal-editor-kit';

export const BaseEditorPlugins = [
  ...PortalEditorKit,

  // Required by AIMenu for block-level selection operations
  BlockSelectionPlugin.configure({
    render: { afterEditable: BlockSelectionAfterEditable },
  }),

  // Extended headings
  H4Plugin.withComponent(H4Element),
  H5Plugin.withComponent(H5Element),
  H6Plugin.withComponent(H6Element),

  // Table
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableCellHeaderElement),

  // Callout blocks
  CalloutPlugin.withComponent(CalloutElement),

  // Column layout
  ColumnPlugin.withComponent(ColumnGroupElement),
  ColumnItemPlugin.withComponent(ColumnElement),

  // Media (image upload + inline images)
  ImagePlugin.withComponent(ImageElement),

  // Additional marks
  HighlightPlugin.withComponent(HighlightLeaf),
  KbdPlugin.withComponent(KbdLeaf),
  SubscriptPlugin,
  SuperscriptPlugin,
];
