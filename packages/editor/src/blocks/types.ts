import type { Block, BlockType, PageDoc } from "@/editor/types";

export type PaletteGroup =
  | "text"
  | "media"
  | "structure"
  | "people"
  | "live"
  | "actions"
  | "extras";

/** Everything the editor needs to know about a block type. */
export interface BlockDefinition<B extends Block = Block> {
  /** Hint for the AI about what this block is for. */
  aiHint?: string;
  /** Keys that the AI can set via set_prop. */
  aiProps?: string[];
  category: string;
  description: string;
  empty: () => B;
  /** Palette group the block is offered under. */
  group: PaletteGroup;
  Inspector: React.ComponentType<{ block: B; doc: PageDoc; onPatch: PatchFn }>;
  label: string;
  PaletteThumb: React.ComponentType;
  Render: React.ComponentType<{
    block: B;
    edit: boolean;
    onPatch: PatchFn;
  }>;
  type: BlockType;
}

export interface PatchOptions {
  /**
   * Edits with the same key within one second share an undo step, so
   * continuous typing is not one step per keystroke.
   */
  coalesce?: string;
}

export type PatchFn = (
  path: string,
  value: unknown,
  options?: PatchOptions
) => void;
