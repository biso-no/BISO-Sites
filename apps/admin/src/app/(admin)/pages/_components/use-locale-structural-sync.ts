"use client";

import type { Locale } from "@repo/api/types/appwrite";
import type { Config, Data } from "@repo/editor";
import { useCallback, useEffect, useRef } from "react";

type ComponentData = Data["content"][number];

interface BlockStructure {
  id: string;
  type: string;
}

interface LocaleData {
  data: Data;
  description: string;
  title: string;
}

function extractStructure(content: ComponentData[]): BlockStructure[] {
  return content.map((block) => ({
    id: (block.props as Record<string, unknown>).id as string,
    type: block.type,
  }));
}

function isStructuralChange(
  prev: BlockStructure[],
  next: BlockStructure[]
): boolean {
  if (prev.length !== next.length) {
    return true;
  }
  return prev.some(
    (block, i) => block.id !== next[i]?.id || block.type !== next[i]?.type
  );
}

/**
 * Returns the set of field keys that hold translatable text in a given component.
 * Falls back to empty array if the config entry is missing.
 */
function getTextFieldKeys(
  componentConfig: Config["components"][string] | undefined
): string[] {
  if (!componentConfig?.fields) {
    return [];
  }
  return Object.entries(componentConfig.fields)
    .filter(([, field]: [string, unknown]) => {
      const f = field as { type?: string };
      return (
        f.type === "text" || f.type === "textarea" || f.type === "richtext"
      );
    })
    .map(([key]) => key);
}

/**
 * Merge source block structure into target locale content, preserving
 * the target's field values for blocks that already exist.
 *
 * - Existing blocks (matched by ID): use target's field values, adopted into source order
 * - New blocks (in source, not in target): copy with empty text fields
 * - Removed blocks (in target, not in source): dropped
 */
function syncContent(
  sourceContent: ComponentData[],
  targetContent: ComponentData[],
  config: Config
): ComponentData[] {
  const targetMap = new Map<string, ComponentData>();
  for (const block of targetContent) {
    const id = (block.props as Record<string, unknown>).id as string;
    targetMap.set(id, block);
  }

  return sourceContent.map((sourceBlock) => {
    const id = (sourceBlock.props as Record<string, unknown>).id as string;
    const existing = targetMap.get(id);
    if (existing) {
      // Preserve target locale's field values; block is already in the right position
      return existing;
    }

    // New block — copy structure but blank out translatable text fields
    const componentConfig = config.components?.[sourceBlock.type];
    const defaultProps =
      (componentConfig?.defaultProps as Record<string, unknown>) ?? {};
    const textKeys = getTextFieldKeys(componentConfig);

    const newProps: Record<string, unknown> = {
      ...(sourceBlock.props as Record<string, unknown>),
    };
    for (const key of textKeys) {
      newProps[key] = defaultProps[key] ?? "";
    }

    return { ...sourceBlock, props: newProps } as ComponentData;
  });
}

function syncZones(
  sourceZones: Record<string, ComponentData[]>,
  targetZones: Record<string, ComponentData[]>,
  config: Config
): Record<string, ComponentData[]> {
  const result: Record<string, ComponentData[]> = {};
  for (const [key, sourceContent] of Object.entries(sourceZones)) {
    result[key] = syncContent(sourceContent, targetZones[key] ?? [], config);
  }
  return result;
}

/**
 * Intercepts Puck onChange, detects structural mutations, and mirrors
 * block structure to all other locales while preserving their field values.
 */
export function useLocaleStructuralSync({
  currentLocale,
  localeData,
  setLocaleData,
  availableLocales,
  config,
}: {
  currentLocale: Locale;
  localeData: Record<Locale, LocaleData | null>;
  setLocaleData: React.Dispatch<
    React.SetStateAction<Record<Locale, LocaleData | null>>
  >;
  availableLocales: Locale[];
  config: Config;
}) {
  const lastStructureRef = useRef<BlockStructure[]>([]);

  // Reset tracked structure when locale changes
  useEffect(() => {
    const currentContent = localeData[currentLocale]?.data.content ?? [];
    lastStructureRef.current = extractStructure(currentContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocale, localeData]);

  const handleDataChange = useCallback(
    (nextData: Data) => {
      const nextStructure = extractStructure(nextData.content);
      const prevStructure = lastStructureRef.current;

      if (isStructuralChange(prevStructure, nextStructure)) {
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: structural sync iterates locales with block-level merging
        setLocaleData((prev) => {
          const updated = { ...prev };
          for (const locale of availableLocales) {
            if (locale === currentLocale) {
              continue;
            }
            const locData = updated[locale];
            if (!locData) {
              continue;
            }

            const syncedContent = syncContent(
              nextData.content,
              locData.data.content,
              config
            );

            const syncedZones =
              nextData.zones && Object.keys(nextData.zones).length > 0
                ? syncZones(
                    nextData.zones as Record<string, ComponentData[]>,
                    (locData.data.zones as Record<string, ComponentData[]>) ??
                      {},
                    config
                  )
                : locData.data.zones;

            updated[locale] = {
              ...locData,
              data: {
                ...locData.data,
                content: syncedContent,
                zones: syncedZones,
              },
            };
          }
          return updated;
        });
      }

      lastStructureRef.current = nextStructure;
    },
    [currentLocale, availableLocales, setLocaleData, config]
  );

  return { handleDataChange };
}
