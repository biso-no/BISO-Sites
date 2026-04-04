'use client';

/**
 * Jobs editor plugin set.
 * Base + TogglePlugin for collapsible FAQ/requirements sections.
 */

import { TogglePlugin } from '@platejs/toggle/react';

import { ToggleElement } from '@repo/ui/components/ui/toggle-node';

import { BaseEditorPlugins } from './base';

export const JobsEditorPlugins = [
  ...BaseEditorPlugins,
  TogglePlugin.withComponent(ToggleElement),
];
