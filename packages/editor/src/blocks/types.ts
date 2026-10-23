import type { Block, BlockType, PageDoc } from "@/editor/types";
import type { ResolvedBackground } from "./_primitives/layout-types";

export interface BlockVariant {
  id: string;
  kind: string;
  label: string;
}

export interface PropSchema {
  key: string;
  label: string;
  options?: string[];
  type: "text" | "textarea" | "url" | "color" | "select" | "number";
}

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
  /**
   * Registered so existing documents still render, but not offered in the
   * palette or to the AI.
   */
  hidden?: true;
  Inspector: React.ComponentType<{ block: B; doc: PageDoc; onPatch: PatchFn }>;
  label: string;
  PaletteThumb: React.ComponentType;
  Render: React.ComponentType<{
    background: ResolvedBackground;
    block: B;
    edit: boolean;
    onPatch: PatchFn;
  }>;
  /** Inspector prop schema — rendered as form rows. */
  schema?: PropSchema[];
  type: BlockType;
  /**
   * True for blocks rebuilt in the redesign's visual language. `BlockView`
   * renders them bare, without the legacy `LayoutFrame`.
   */
  v2?: true;
  variants?: BlockVariant[];
}

export type PatchFn = (path: string, value: unknown) => void;
