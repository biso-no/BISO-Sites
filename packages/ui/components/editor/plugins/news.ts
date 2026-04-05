'use client';

/**
 * News/Articles editor plugin set.
 * Base + TocPlugin for long-form articles with table of contents.
 */

import { TocPlugin } from '@platejs/toc/react';

import { TocElement } from '@repo/ui/components/ui/toc-node';

import { BaseEditorPlugins } from './base';

export const NewsEditorPlugins = [
  ...BaseEditorPlugins,
  TocPlugin.configure({
    node: { component: TocElement },
    options: { topOffset: 80 },
  }),
];
