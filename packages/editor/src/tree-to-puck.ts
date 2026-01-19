/**
 * Tree to Puck Data Converter
 *
 * Converts json-render's UITree format to Puck's Data format.
 * Used when AI completes full page generation and we need to
 * load the result into the Puck editor.
 */

import type { UIElement, UITree } from "@json-render/core";
import type { Data } from "@puckeditor/core";

/**
 * Puck block structure
 */
type PuckBlock = {
  type: string;
  props: Record<string, unknown>;
};

/**
 * Convert a json-render UITree to Puck Data format
 *
 * json-render uses a flat structure:
 * {
 *   root: "root-key",
 *   elements: { "root-key": {...}, "element-1": {...}, ... }
 * }
 *
 * Puck uses:
 * {
 *   root: { props: {...} },
 *   content: [{ type: "Hero", props: {...} }, ...]
 * }
 *
 * @param tree - The json-render UI tree
 * @returns Puck Data structure
 */
export function treeToPuckData(tree: UITree | null): Data {
  if (!tree?.elements) {
    return {
      root: { props: {} },
      content: [],
    };
  }

  const content: PuckBlock[] = [];

  // Get the root element
  const rootElement = tree.elements[tree.root];

  // Process children of the root element
  if (rootElement?.children) {
    for (const childKey of rootElement.children) {
      const childElement = tree.elements[childKey];
      if (childElement) {
        const block = elementToPuckBlock(childElement);
        if (block) {
          content.push(block);
        }
      }
    }
  }

  return {
    root: {
      props: rootElement?.props || {},
    },
    content,
  };
}

/**
 * Convert a single UIElement to a Puck block
 */
function elementToPuckBlock(element: UIElement): PuckBlock | null {
  if (!element?.type) {
    return null;
  }

  // Ensure the block has an ID
  const id =
    element.key ||
    (element.props?.id as string) ||
    `${element.type}-${Date.now()}`;

  return {
    type: element.type,
    props: {
      id,
      ...element.props,
    },
  };
}

/**
 * Convert Puck Data back to json-render UITree format
 *
 * This is used to send the current page state to the AI for context
 */
export function puckDataToTree(data: Data): UITree {
  const elements: Record<string, UIElement> = {};
  const childKeys: string[] = [];

  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      const element = puckBlockToElement(block);
      elements[element.key] = element;
      childKeys.push(element.key);
    }
  }

  // Create root element
  const rootKey = "root";
  elements[rootKey] = {
    key: rootKey,
    type: "Root",
    props: data.root?.props || {},
    children: childKeys,
  };

  return {
    root: rootKey,
    elements,
  };
}

/**
 * Convert a Puck block to UIElement format
 */
function puckBlockToElement(block: PuckBlock): UIElement {
  const { id, ...restProps } = block.props as {
    id?: string;
    [key: string]: unknown;
  };

  const blockId = (id as string) || `${block.type}-${Date.now()}`;

  return {
    key: blockId,
    type: block.type,
    props: restProps,
  };
}

/**
 * Merge AI-generated content with existing Puck data
 *
 * @param existing - Current Puck data
 * @param generated - AI-generated tree
 * @param mode - How to merge: 'replace' | 'append' | 'insert'
 * @param insertIndex - Where to insert (for insert mode)
 */
export function mergePuckData(
  existing: Data,
  generated: UITree,
  mode: "replace" | "append" | "insert" = "replace",
  insertIndex?: number
): Data {
  const newContent = treeToPuckData(generated).content;

  switch (mode) {
    case "replace":
      return {
        root: existing.root,
        content: newContent,
      };

    case "append":
      return {
        root: existing.root,
        content: [...(existing.content || []), ...newContent],
      };

    case "insert": {
      const content = [...(existing.content || [])];
      const idx = insertIndex ?? content.length;
      content.splice(idx, 0, ...newContent);
      return {
        root: existing.root,
        content,
      };
    }

    default:
      return existing;
  }
}
