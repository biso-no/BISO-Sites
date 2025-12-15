/**
 * Streaming JSON parser for real-time Puck content rendering
 * Detects block boundaries and emits events for immediate UI updates
 */

export type BlockStartEvent = {
  type: "block-start";
  blockIndex: number;
  blockType: string;
  partialBlock: {
    type: string;
    props: Record<string, unknown>;
  };
};

export type BlockUpdateEvent = {
  type: "block-update";
  blockIndex: number;
  props: Record<string, unknown>;
};

export type BlockCompleteEvent = {
  type: "block-complete";
  blockIndex: number;
  block: {
    type: string;
    props: Record<string, unknown>;
  };
};

export type ParseCompleteEvent = {
  type: "parse-complete";
  data: {
    content: Array<{
      type: string;
      props: Record<string, unknown>;
    }>;
    root?: {
      props?: Record<string, unknown>;
    };
  };
};

export type StreamEvent =
  | BlockStartEvent
  | BlockUpdateEvent
  | BlockCompleteEvent
  | ParseCompleteEvent;

export type StreamEventHandler = (event: StreamEvent) => void;

/**
 * Streaming JSON parser that emits events as blocks are detected
 */
export class StreamingJSONParser {
  private buffer = "";
  private blockIndex = -1;
  private inBlock = false;
  private braceDepth = 0;
  private currentBlockStart = -1;
  private emittedBlocks = new Set<number>();
  private readonly handler: StreamEventHandler;

  constructor(handler: StreamEventHandler) {
    this.handler = handler;
  }

  /**
   * Append a chunk of streamed text
   */
  append(chunk: string): void {
    this.buffer += chunk;
    this.parse();
  }

  /**
   * Parse the buffer and emit events
   */
  private parse(): void {
    // Look for content array start
    const contentMatch = this.buffer.match(/"content"\s*:\s*\[/);
    if (!contentMatch) {
      return;
    }

    const contentStart = (contentMatch.index ?? 0) + contentMatch[0].length;
    let pos = contentStart;

    while (pos < this.buffer.length) {
      const char = this.buffer[pos];

      // Track brace depth to understand nesting
      if (char === "{") {
        if (this.braceDepth === 0 && !this.inBlock) {
          // Start of a new block
          this.blockIndex++;
          this.inBlock = true;
          this.currentBlockStart = pos;
        }
        this.braceDepth++;
      } else if (char === "}") {
        this.braceDepth--;
        if (this.braceDepth === 0 && this.inBlock) {
          // End of current block
          this.handleBlockComplete(pos + 1);
          this.inBlock = false;
        }
      }

      // If we're in a block and have accumulated enough data, try to parse it
      if (this.inBlock && !this.emittedBlocks.has(this.blockIndex)) {
        this.tryEmitBlockStart();
      } else if (this.inBlock && this.emittedBlocks.has(this.blockIndex)) {
        this.tryEmitBlockUpdate();
      }

      pos++;
    }
  }

  /**
   * Try to emit a block-start event
   */
  private tryEmitBlockStart(): void {
    if (this.currentBlockStart === -1) {
      return;
    }

    const blockText = this.buffer.slice(this.currentBlockStart);
    
    // Try to parse the partial block
    try {
      // Look for the type field
      const typeMatch = blockText.match(/"type"\s*:\s*"([^"]+)"/);
      if (!typeMatch) {
        return;
      }

      const blockType = typeMatch[1];

      // Try to extract props that are complete
      const propsMatch = blockText.match(/"props"\s*:\s*\{/);
      if (!propsMatch) {
        return;
      }

      // Emit block-start event
      this.emittedBlocks.add(this.blockIndex);
      this.handler({
        type: "block-start",
        blockIndex: this.blockIndex,
        blockType,
        partialBlock: {
          type: blockType,
          props: { id: `${blockType}-${this.blockIndex + 1}` },
        },
      });
    } catch {
      // Not enough data yet, wait for more
    }
  }

  /**
   * Try to emit a block-update event with current props
   */
  private tryEmitBlockUpdate(): void {
    if (this.currentBlockStart === -1) {
      return;
    }

    const blockText = this.buffer.slice(this.currentBlockStart);

    try {
      // Try to parse the partial block to extract props
      const propsMatch = blockText.match(/"props"\s*:\s*(\{[^}]*\})/);
      if (propsMatch) {
        const propsText = propsMatch[1];
        const props = JSON.parse(propsText);

        this.handler({
          type: "block-update",
          blockIndex: this.blockIndex,
          props,
        });
      }
    } catch {
      // Props not complete yet, wait for more
    }
  }

  /**
   * Handle a complete block
   */
  private handleBlockComplete(endPos: number): void {
    if (this.currentBlockStart === -1) {
      return;
    }

    const blockText = this.buffer.slice(this.currentBlockStart, endPos);

    try {
      const block = JSON.parse(blockText);
      this.handler({
        type: "block-complete",
        blockIndex: this.blockIndex,
        block,
      });
    } catch (error) {
      // Failed to parse complete block
    }

    this.currentBlockStart = -1;
  }

  /**
   * Finalize parsing and emit complete event
   */
  finalize(): void {
    try {
      const data = JSON.parse(this.buffer);
      this.handler({
        type: "parse-complete",
        data,
      });
    } catch {
      // Failed to parse complete JSON
    }
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = "";
    this.blockIndex = -1;
    this.inBlock = false;
    this.braceDepth = 0;
    this.currentBlockStart = -1;
    this.emittedBlocks.clear();
  }
}
