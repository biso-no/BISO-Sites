import { describe, expect, test } from 'bun:test';

import { ContentEditor } from './content-editor';
import { LegacyContentEditor } from './content-editor-legacy';
import { ContentEditorV1 } from './editor-v1/content-editor-v1';

describe('ContentEditor rollout routing', () => {
  const props = {
    minHeight: 180,
    onChange: () => {},
    value: '',
  };

  test('routes news to editor-v1', () => {
    const element = ContentEditor({ ...props, variant: 'news' });
    expect(element.type).toBe(ContentEditorV1);
  });

  test('routes events to editor-v1', () => {
    const element = ContentEditor({ ...props, variant: 'events' });
    expect(element.type).toBe(ContentEditorV1);
  });

  test('routes jobs to editor-v1', () => {
    const element = ContentEditor({ ...props, variant: 'jobs' });
    expect(element.type).toBe(ContentEditorV1);
  });

  test('keeps base on legacy during phased rollout', () => {
    const element = ContentEditor({ ...props, variant: 'base' });
    expect(element.type).toBe(LegacyContentEditor);
  });

  test('keeps products on legacy during phased rollout', () => {
    const element = ContentEditor({ ...props, variant: 'products' });
    expect(element.type).toBe(LegacyContentEditor);
  });
});
