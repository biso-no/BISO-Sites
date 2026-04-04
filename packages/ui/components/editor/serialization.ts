/**
 * Serialization utilities for PlateJS content.
 *
 * The canonical storage format is Plate JSON (TElement[] serialized as a string).
 * These helpers convert that JSON to other formats for rendering and export.
 */

import type { SlateEditor, TElement } from 'platejs';

import { serializeMd } from '@platejs/markdown';

// ── Parse stored value → TElement[] ──────────────────────────────────────────

export function parsePlateContent(value: string | null | undefined): TElement[] {
  const empty: TElement[] = [{ type: 'p', children: [{ text: '' }] }];

  if (!value) return empty;
  const trimmed = value.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as TElement[];
    } catch {
      // fall through
    }
  }

  // Legacy plain text — wrap in a paragraph
  return [{ type: 'p', children: [{ text: value }] }];
}

// ── Serialize TElement[] → JSON string ───────────────────────────────────────

export function stringifyPlateContent(nodes: TElement[]): string {
  return JSON.stringify(nodes);
}

// ── Convert Plate JSON → Markdown ─────────────────────────────────────────────

export function toMarkdown(editor: SlateEditor, nodes?: TElement[]): string {
  const value = nodes ?? (editor.children as TElement[]);
  return serializeMd(editor, { value });
}

// ── Convert Plate JSON → HTML (basic) ─────────────────────────────────────────
// For a full HTML serialization use Plate's static renderer or a server-side
// serializer. This minimal version is suitable for email previews / feeds.

export function toHtml(nodes: TElement[]): string {
  function nodeToHtml(node: TElement | { text: string; [key: string]: unknown }): string {
    // Text leaf
    if ('text' in node) {
      let text = escapeHtml(String(node.text));
      if ((node as any).bold) text = `<strong>${text}</strong>`;
      if ((node as any).italic) text = `<em>${text}</em>`;
      if ((node as any).underline) text = `<u>${text}</u>`;
      if ((node as any).strikethrough) text = `<s>${text}</s>`;
      if ((node as any).code) text = `<code>${text}</code>`;
      return text;
    }

    const el = node as TElement;
    const children = (el.children as Array<TElement | { text: string }>)
      .map(nodeToHtml)
      .join('');

    switch (el.type) {
      case 'h1': return `<h1>${children}</h1>`;
      case 'h2': return `<h2>${children}</h2>`;
      case 'h3': return `<h3>${children}</h3>`;
      case 'h4': return `<h4>${children}</h4>`;
      case 'h5': return `<h5>${children}</h5>`;
      case 'h6': return `<h6>${children}</h6>`;
      case 'p': return `<p>${children}</p>`;
      case 'blockquote': return `<blockquote>${children}</blockquote>`;
      case 'hr': return '<hr />';
      case 'ul': return `<ul>${children}</ul>`;
      case 'ol': return `<ol>${children}</ol>`;
      case 'li': return `<li>${children}</li>`;
      case 'a': return `<a href="${escapeHtml(String((el as any).url ?? ''))}">${children}</a>`;
      case 'img': return `<img src="${escapeHtml(String((el as any).url ?? ''))}" alt="${escapeHtml(String((el as any).caption ?? ''))}" />`;
      case 'code_block': return `<pre><code>${children}</code></pre>`;
      case 'code_line': return `${children}\n`;
      case 'callout': return `<blockquote class="callout">${children}</blockquote>`;
      case 'table': return `<table>${children}</table>`;
      case 'tr': return `<tr>${children}</tr>`;
      case 'td': return `<td>${children}</td>`;
      case 'th': return `<th>${children}</th>`;
      default: return `<div>${children}</div>`;
    }
  }

  return nodes.map(nodeToHtml).join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
