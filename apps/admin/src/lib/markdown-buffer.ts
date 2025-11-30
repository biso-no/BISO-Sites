/**
 * Markdown buffer that accumulates text and only emits when we have
 * complete markdown syntax elements. This prevents showing raw markdown
 * like "##" before the heading text arrives.
 */

type BufferCallback = (content: string) => void;

// Patterns that indicate incomplete markdown at the end of a string
const INCOMPLETE_HEADING = /^#{1,6}$/m;
const INCOMPLETE_BOLD_ASTERISK = /\*{1,2}$/m;
const INCOMPLETE_BOLD_UNDERSCORE = /_{1,2}$/m;
const INCOMPLETE_LINK_TEXT = /\[$/m;
const INCOMPLETE_LINK_URL_START = /\]\($/m;
const INCOMPLETE_LINK_URL = /\]\([^)]*$/m;
const INCOMPLETE_LIST_ITEM = /^[-*+]\s*$/m;
const INCOMPLETE_NUMBERED_LIST = /^\d+\.\s*$/m;
const INCOMPLETE_CODE_BLOCK = /```[^`]*$/m;
const INCOMPLETE_INLINE_CODE = /`[^`]*$/m;

// Check if the buffer ends with incomplete markdown
function hasIncompleteMarkdown(text: string): boolean {
  const lastLine = text.split("\n").at(-1) ?? "";
  const trimmed = lastLine.trimEnd();

  return (
    INCOMPLETE_HEADING.test(trimmed) ||
    INCOMPLETE_BOLD_ASTERISK.test(trimmed) ||
    INCOMPLETE_BOLD_UNDERSCORE.test(trimmed) ||
    INCOMPLETE_LINK_TEXT.test(trimmed) ||
    INCOMPLETE_LINK_URL_START.test(trimmed) ||
    INCOMPLETE_LINK_URL.test(trimmed) ||
    INCOMPLETE_LIST_ITEM.test(trimmed) ||
    INCOMPLETE_NUMBERED_LIST.test(trimmed) ||
    INCOMPLETE_CODE_BLOCK.test(trimmed) ||
    INCOMPLETE_INLINE_CODE.test(trimmed)
  );
}

export class MarkdownBuffer {
  private buffer = "";
  private emittedLength = 0;
  private readonly onEmit: BufferCallback;

  constructor(onEmit: BufferCallback) {
    this.onEmit = onEmit;
  }

  /**
   * Append new content to the buffer
   */
  append(chunk: string): void {
    this.buffer += chunk;
    this.tryEmit();
  }

  /**
   * Try to emit safe content (complete markdown elements)
   */
  private tryEmit(): void {
    // Find the safe point to emit up to
    // We look for the last complete line that doesn't have incomplete markdown
    const lines = this.buffer.split("\n");

    // Always keep the last line in the buffer (it might be incomplete)
    if (lines.length <= 1) {
      // Single line - check if it has incomplete markdown
      if (!hasIncompleteMarkdown(this.buffer)) {
        this.emit(this.buffer);
      }
      return;
    }

    // Find how many complete lines we can emit
    let safeEndIndex = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      // Add the line length plus the newline
      safeEndIndex += lines[i].length + 1;
    }

    // Check if the last line has incomplete markdown
    const lastLine = lines.at(-1) ?? "";
    if (!hasIncompleteMarkdown(lastLine)) {
      safeEndIndex = this.buffer.length;
    }

    if (safeEndIndex > this.emittedLength) {
      const toEmit = this.buffer.substring(0, safeEndIndex);
      this.emit(toEmit);
    }
  }

  /**
   * Emit content (markdown - the RichTextEditor will convert to HTML)
   */
  private emit(content: string): void {
    this.emittedLength = content.length;
    this.onEmit(content);
  }

  /**
   * Flush any remaining content (call when streaming is complete)
   */
  flush(): void {
    if (this.buffer.length > this.emittedLength) {
      this.emit(this.buffer);
    }
  }

  /**
   * Get the current buffer content
   */
  getContent(): string {
    return this.buffer;
  }

  /**
   * Reset the buffer
   */
  reset(): void {
    this.buffer = "";
    this.emittedLength = 0;
  }
}

/**
 * Create a markdown buffer for streaming content
 */
function createMarkdownBuffer(
  onUpdate: (content: string) => void
): MarkdownBuffer {
  return new MarkdownBuffer(onUpdate);
}
