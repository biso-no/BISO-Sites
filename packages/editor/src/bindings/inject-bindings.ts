import type { Data, ComponentData } from "@puckeditor/core";
import type { TemplateBinding } from "@repo/api/editorial";
import type { BindingSourceValue } from "../fields/binding-source-field";

/**
 * Distributes a flat TemplateBinding[] array from the database
 * into per-block `_bindings` metadata in the Puck Data document.
 *
 * This is the reverse of extractBindings() -- it enriches the layout document
 * so that the unified editor can display inline binding configuration per block.
 */
export function injectBindings(
  data: Data,
  bindings: TemplateBinding[],
): Data {
  const clone = structuredClone(data);

  // Index bindings by blockId for fast lookup
  const bindingsByBlock = new Map<string, TemplateBinding[]>();
  for (const binding of bindings) {
    const existing = bindingsByBlock.get(binding.blockId) ?? [];
    existing.push(binding);
    bindingsByBlock.set(binding.blockId, existing);
  }

  // Inject bindings into root
  const rootBindingsList = bindingsByBlock.get("root");
  if (rootBindingsList && rootBindingsList.length > 0) {
    const rootProps = (clone.root?.props ?? {}) as Record<string, unknown>;
    const rootBlockBindings: Record<string, BindingSourceValue> = {};

    for (const binding of rootBindingsList) {
      rootBlockBindings[binding.propPath] =
        convertToBindingSourceValue(binding);
    }

    rootProps._bindings = rootBlockBindings;
    if (clone.root) {
      clone.root.props = rootProps as Data["root"]["props"];
    }
  }

  // Inject bindings into content blocks
  function processBlock(block: ComponentData) {
    const props = block.props as Record<string, unknown>;
    const blockId = props.id as string;
    const blockBindingsList = bindingsByBlock.get(blockId);

    if (blockBindingsList && blockBindingsList.length > 0) {
      const blockBindings: Record<string, BindingSourceValue> = {};
      for (const binding of blockBindingsList) {
        blockBindings[binding.propPath] =
          convertToBindingSourceValue(binding);
      }
      props._bindings = blockBindings;
    }
  }

  for (const block of clone.content ?? []) {
    processBlock(block);
  }

  if (clone.zones) {
    for (const zoneBlocks of Object.values(clone.zones)) {
      for (const block of zoneBlocks as ComponentData[]) {
        processBlock(block);
      }
    }
  }

  return clone;
}

/**
 * Converts a stored TemplateBinding into the inline BindingSourceValue
 * format used by the binding-source-field custom field.
 */
function convertToBindingSourceValue(
  binding: TemplateBinding,
): BindingSourceValue {
  const source = binding.source;

  switch (source.type) {
    case "field":
      return {
        sourceType: "field",
        fieldId: source.fieldId,
        fallback: source.fallback,
      };

    case "relation":
      return {
        sourceType: "field",
        fieldId: source.fieldId,
      };

    case "query":
      return {
        sourceType: "query",
        query: {
          table: source.query.collection,
          limit: source.query.limit,
          sort: source.query.sort,
          filters: source.query.filters?.map((f: { field: string; operator: string; value?: unknown }) => ({
            field: f.field,
            operator: f.operator,
            value: f.value,
          })),
        },
      };

    case "context":
      return {
        sourceType: "context",
        contextKey: source.key,
      };

    case "static":
      return {
        sourceType: "static",
      };

    default:
      return { sourceType: "static" };
  }
}
