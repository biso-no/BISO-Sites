import { describe, expect, test } from 'bun:test';

import {
  parseEditorV1Value,
  stringifyEditorV1Document,
} from './document';

describe('editor-v1 document boundary', () => {
  test('wraps legacy plain text in a paragraph', () => {
    const document = parseEditorV1Value('Legacy copy');

    expect(document.version).toBe(1);
    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]).toMatchObject({
      children: [{ text: 'Legacy copy' }],
      type: 'p',
    });
  });

  test('reuses serialized plate arrays without migration', () => {
    const json = JSON.stringify([{ type: 'h2', children: [{ text: 'Hello' }] }]);
    const document = parseEditorV1Value(json);

    expect(document.blocks).toEqual([{ type: 'h2', children: [{ text: 'Hello' }] }]);
  });

  test('round-trips v1 documents back to string payloads', () => {
    const value = stringifyEditorV1Document({
      version: 1,
      blocks: [{ type: 'p', children: [{ text: 'Round trip' }] }],
    });

    expect(JSON.parse(value)).toEqual([
      { type: 'p', children: [{ text: 'Round trip' }] },
    ]);
  });
});
