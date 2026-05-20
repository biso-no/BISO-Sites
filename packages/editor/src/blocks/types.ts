import type { Block, BlockType, PageDoc } from "@/editor/types";

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

/** Everything the editor needs to know about a block type. */
export interface BlockDefinition<B extends Block = Block> {
  /** Hint for the AI about what this block is for. */
  aiHint?: string;
  /** Keys that the AI can set via set_prop. */
  aiProps?: string[];
  category: string;
  description: string;
  empty: () => B;
  Inspector: React.ComponentType<{ block: B; doc: PageDoc; onPatch: PatchFn }>;
  label: string;
  PaletteThumb: React.ComponentType;
  Render: React.ComponentType<{ block: B; edit: boolean; onPatch: PatchFn }>;
  /** Inspector prop schema — rendered as form rows. */
  schema?: PropSchema[];
  type: BlockType;
  variants?: BlockVariant[];
}

export type PatchFn = (path: string, value: unknown) => void;
