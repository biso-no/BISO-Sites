'use client';

import { CalloutPlugin } from '@platejs/callout/react';
import { ImagePlugin } from '@platejs/media/react';

import { PortalEditorKit } from '../portal-editor-kit';
import { CalloutElement } from '../ui/callout-node';
import { ImageElement } from '../ui/media-image-node';

import type { EditorV1Variant } from './document';

export const editorV1Plugins = [
  ...PortalEditorKit,
  CalloutPlugin.withComponent(CalloutElement),
  ImagePlugin.withComponent(ImageElement),
];

export const editorV1VariantMeta: Record<
  EditorV1Variant,
  {
    helper: string;
    placeholder: string;
    sectionTitle: string;
    sectionBody: string;
  }
> = {
  events: {
    helper: 'Create a clear event story with highlights, practical details, and a strong call to action.',
    placeholder: 'Describe the event, why it matters, and what attendees should expect…',
    sectionTitle: 'Program highlight',
    sectionBody: 'Add a concise description of this event section.',
  },
  jobs: {
    helper: 'Structure the posting so responsibilities, expectations, and next steps are easy to scan.',
    placeholder: 'Describe the opportunity, the responsibilities, and who should apply…',
    sectionTitle: 'Responsibilities',
    sectionBody: 'Explain this job section in plain, direct language.',
  },
  news: {
    helper: 'Write like an editor: lead with the most important information and keep each section readable.',
    placeholder: 'Write the story, update, or announcement in a clear editorial voice…',
    sectionTitle: 'Section title',
    sectionBody: 'Add the next part of the story here.',
  },
};
