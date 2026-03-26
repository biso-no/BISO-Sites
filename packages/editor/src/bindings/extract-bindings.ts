import type { Data, ComponentData } from "@puckeditor/core";
import type {
  TemplateBinding,
  TemplateBindingSource,
} from "@repo/api/editorial";
import type { BindingSourceValue } from "../fields/binding-source-field";

/**
 * Extracts per-block `_bindings` metadata from a Puck Data document
 * into the flat TemplateBinding[] format stored in the database.
 *
 * This bridges the inline editing experience (bindings stored on each block)
 * with the existing editorial system (flat bindings array on the template version).
 */
export function extractBindings(data: Data): TemplateBinding[] {
  const bindings: TemplateBinding[] = [];
  let counter = 0;

  function processBlock(block: ComponentData) {
    const props = block.props as Record<string, unknown>;
    const blockBindings = props._bindings as
      | Record<string, BindingSourceValue>
      | undefined;

    if (!blockBindings) return;

    for (const [propPath, source] of Object.entries(blockBindings)) {
      if (!source || source.sourceType === "static") continue;

      const converted = convertToTemplateBindingSource(source);
      if (!converted) continue;

      counter++;
      bindings.push({
        id: `binding_${counter}`,
        blockId: props.id as string,
        propPath,
        source: converted,
      });
    }
  }

  // Process root-level content blocks
  for (const block of data.content ?? []) {
    processBlock(block);
  }

  // Process zone blocks (slots like Section content, Columns, Tabs)
  if (data.zones) {
    for (const zoneBlocks of Object.values(data.zones)) {
      for (const block of zoneBlocks as ComponentData[]) {
        processBlock(block);
      }
    }
  }

  // Process root-level bindings
  const rootProps = data.root?.props as Record<string, unknown> | undefined;
  const rootBindings = rootProps?._bindings as
    | Record<string, BindingSourceValue>
    | undefined;

  if (rootBindings) {
    for (const [propPath, source] of Object.entries(rootBindings)) {
      if (!source || source.sourceType === "static") continue;

      const converted = convertToTemplateBindingSource(source);
      if (!converted) continue;

      counter++;
      bindings.push({
        id: `binding_${counter}`,
        blockId: "root",
        propPath,
        source: converted,
      });
    }
  }

  return bindings;
}

/**
 * Converts the inline BindingSourceValue (used in the editor UI)
 * into the TemplateBindingSource format (stored in the database).
 */
function convertToTemplateBindingSource(
  source: BindingSourceValue,
): TemplateBindingSource | null {
  switch (source.sourceType) {
    case "field":
      if (!source.fieldId) return null;
      return {
        type: "field",
        fieldId: source.fieldId,
        fallback: source.fallback,
      };

    case "query":
      if (!source.query?.table) return null;
      return {
        type: "query",
        query: {
          collection: source.query.table as TemplateBindingSource extends {
            type: "query";
            query: infer Q;
          }
            ? Q extends { collection: infer C }
              ? C
              : never
            : never,
          limit: source.query.limit,
          sort: source.query.sort,
          filters: source.query.filters?.map((f) => ({
            field: f.field,
            operator: f.operator as "equal" | "notEqual" | "contains",
            value: f.value,
          })),
        },
      };

    case "context":
      if (!source.contextKey) return null;
      // Map extended context keys to the base editorial context keys
      const validKeys = [
        "locale",
        "path",
        "entryId",
        "kind",
        "visibility",
        "isAuthenticated",
      ] as const;
      type ContextKey = (typeof validKeys)[number];
      if (validKeys.includes(source.contextKey as ContextKey)) {
        return {
          type: "context",
          key: source.contextKey as ContextKey,
        };
      }
      // campusId and departmentId map to static/field bindings in the future
      return null;

    default:
      return null;
  }
}

/**
 * Strips _bindings metadata from a Puck Data document before rendering.
 * The public-facing render pipeline should call this to clean the document.
 */
export function stripBindingsMetadata(data: Data): Data {
  const clone = structuredClone(data);

  function cleanBlock(block: ComponentData) {
    const props = block.props as Record<string, unknown>;
    delete props._bindings;
  }

  for (const block of clone.content ?? []) {
    cleanBlock(block);
  }

  if (clone.zones) {
    for (const zoneBlocks of Object.values(clone.zones)) {
      for (const block of zoneBlocks as ComponentData[]) {
        cleanBlock(block);
      }
    }
  }

  const rootProps = clone.root?.props as Record<string, unknown> | undefined;
  if (rootProps) {
    delete rootProps._bindings;
  }

  return clone;
}
