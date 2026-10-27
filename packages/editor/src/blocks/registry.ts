import type { Block, BlockType } from "@/editor/types";
import type { BlockDefinition, PaletteGroup } from "./types";

// Blocks register themselves here via registerBlock().
const registry = new Map<BlockType, BlockDefinition>();

export function registerBlock<B extends Block>(def: BlockDefinition<B>) {
  registry.set(def.type, def as unknown as BlockDefinition);
}

export function getBlock(type: BlockType): BlockDefinition | undefined {
  return registry.get(type);
}

export function allBlocks(): BlockDefinition[] {
  return [...registry.values()];
}

const GROUP_ORDER: { group: PaletteGroup; label: string }[] = [
  { group: "text", label: "Text and story" },
  { group: "media", label: "Media" },
  { group: "structure", label: "Structure" },
  { group: "people", label: "People" },
  { group: "live", label: "Live from BISO" },
  { group: "actions", label: "Actions" },
  { group: "extras", label: "Small extras" },
];

export interface PaletteItemData {
  desc: string;
  label: string;
  type: BlockType;
}

export interface PaletteGroupData {
  group: PaletteGroup;
  items: PaletteItemData[];
  label: string;
}

/**
 * The palette's block groups, derived from the registry so the palette and the
 * definitions cannot drift: items in registration order, empty groups dropped.
 */
export function paletteGroups(): PaletteGroupData[] {
  const offered = allBlocks();
  return GROUP_ORDER.map(({ group, label }) => ({
    group,
    label,
    items: offered
      .filter((def) => def.group === group)
      .map((def) => ({
        type: def.type,
        label: def.label,
        desc: def.description,
      })),
  })).filter((g) => g.items.length > 0);
}
