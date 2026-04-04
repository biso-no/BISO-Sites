'use client';

/**
 * Events editor plugin set.
 * Base + DatePlugin for inline event dates within content.
 */

import { DatePlugin } from '@platejs/date/react';

import { DateElement } from '@repo/ui/components/ui/date-node';

import { BaseEditorPlugins } from './base';

export const EventsEditorPlugins = [
  ...BaseEditorPlugins,
  DatePlugin.withComponent(DateElement),
];
