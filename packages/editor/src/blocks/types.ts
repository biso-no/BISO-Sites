import type { Block, BlockType, PageDoc } from "@/editor/types";

export interface BlockVariant {
  id: string;
  label: string;
  kind: string;
}

export interface PropSchema {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "color" | "select" | "number";
  options?: string[];
}

/** Everything the editor needs to know about a block type. */
export interface BlockDefinition<B extends Block = Block> {
  type: BlockType;
  label: string;
  description: string;
  category: string;
  variants?: BlockVariant[];
  /** Keys that the AI can set via set_prop. */
  aiProps?: string[];
  /** Hint for the AI about what this block is for. */
  aiHint?: string;
  /** Inspector prop schema — rendered as form rows. */
  schema?: PropSchema[];
  empty: () => B;
  Render: React.ComponentType<{ block: B; edit: boolean; onPatch: PatchFn }>;
  Inspector: React.ComponentType<{ block: B; doc: PageDoc; onPatch: PatchFn }>;
  PaletteThumb: React.ComponentType;
}

export type PatchFn = (path: string, value: unknown) => void;
