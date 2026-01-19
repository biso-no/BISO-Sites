/**
 * Puck Stream Handler
 *
 * Processes JSONL patch operations from json-render and applies them
 * to Puck's Data structure. This enables real-time streaming updates
 * to the editor canvas as AI generates content.
 *
 * Supports targeted editing:
 * - Replace entire blocks: /content/2
 * - Modify block props: /content/2/props/title
 * - Insert at position: add operation on /content/N
 * - Remove blocks: remove operation on /content/N
 */

import type { Data } from "@puckeditor/core";

/**
 * JSONL Patch operation format from json-render
 */
export type PatchOperation = {
  op: "set" | "add" | "replace" | "remove";
  path: string; // e.g., "/root", "/content/2", "/content/2/props/title"
  value?: unknown;
};

/**
 * Block structure in Puck's content array
 */
type PuckBlock = {
  type: string;
  props: Record<string, unknown>;
};

/**
 * Parse a JSONL line into a PatchOperation
 */
export function parsePatch(line: string): PatchOperation | null {
  try {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      return null;
    }
    return JSON.parse(trimmed) as PatchOperation;
  } catch {
    return null;
  }
}

/**
 * Parse multiple JSONL lines
 */
export function parsePatches(text: string): PatchOperation[] {
  return text
    .split("\n")
    .map(parsePatch)
    .filter((p): p is PatchOperation => p !== null);
}

/**
 * Apply a single patch operation to Puck data
 *
 * @param data - Current Puck data state
 * @param patch - The patch operation to apply
 * @returns New Puck data with patch applied (immutable)
 */
export function applyPatchToPuckData(data: Data, patch: PatchOperation): Data {
  const pathParts = patch.path.split("/").filter(Boolean);

  // Handle root-level operations
  if (pathParts[0] === "root") {
    return handleRootPatch(data, pathParts.slice(1), patch);
  }

  // Handle content array operations
  if (pathParts[0] === "content") {
    return handleContentPatch(data, pathParts.slice(1), patch);
  }

  // Handle elements map (json-render format) - convert to content array
  if (pathParts[0] === "elements" || pathParts[0] === "children") {
    return handleElementsPatch(data, pathParts.slice(1), patch);
  }

  console.warn(`[PuckStreamHandler] Unknown path prefix: ${pathParts[0]}`);
  return data;
}

/**
 * Handle patches to root object
 */
function handleRootPatch(
  data: Data,
  pathParts: string[],
  patch: PatchOperation
): Data {
  const isRootReplacement =
    pathParts.length === 0 && (patch.op === "set" || patch.op === "replace");

  if (isRootReplacement) {
    return {
      ...data,
      root: patch.value as Data["root"],
    };
  }

  // Nested root prop update (e.g., /root/props/title)
  if (pathParts[0] === "props" && pathParts.length >= 2) {
    const propName = pathParts[1];
    return {
      ...data,
      root: {
        ...data.root,
        props: {
          ...(data.root?.props || {}),
          [propName]: patch.value,
        },
      },
    };
  }

  return data;
}

/**
 * Handle operations on the entire content array
 */
function handleWholeContentPatch(
  data: Data,
  content: PuckBlock[],
  patch: PatchOperation
): Data {
  switch (patch.op) {
    case "set":
    case "replace":
      return { ...data, content: patch.value as PuckBlock[] };
    case "add":
      return { ...data, content: [...content, patch.value as PuckBlock] };
    default:
      return data;
  }
}

/**
 * Handle operations on a specific block by index
 */
function handleBlockIndexPatch(
  data: Data,
  content: PuckBlock[],
  blockIndex: number,
  patch: PatchOperation
): Data {
  switch (patch.op) {
    case "set":
    case "replace":
      content[blockIndex] = patch.value as PuckBlock;
      return { ...data, content };
    case "add":
      content.splice(blockIndex, 0, patch.value as PuckBlock);
      return { ...data, content };
    case "remove":
      content.splice(blockIndex, 1);
      return { ...data, content };
    default:
      return data;
  }
}

/**
 * Handle patches to content array
 */
function handleContentPatch(
  data: Data,
  pathParts: string[],
  patch: PatchOperation
): Data {
  const content = [...(data.content || [])];

  if (pathParts.length === 0) {
    return handleWholeContentPatch(data, content, patch);
  }

  const blockIndex = Number.parseInt(pathParts[0], 10);
  if (Number.isNaN(blockIndex)) {
    console.warn(`[PuckStreamHandler] Invalid block index: ${pathParts[0]}`);
    return data;
  }

  if (pathParts.length === 1) {
    return handleBlockIndexPatch(data, content, blockIndex, patch);
  }

  const currentBlock = content[blockIndex];
  if (!currentBlock) {
    console.warn(`[PuckStreamHandler] Block at index ${blockIndex} not found`);
    return data;
  }

  // /content/N/props/... - update nested prop
  if (pathParts[1] === "props" && pathParts.length >= 3) {
    const propPath = pathParts.slice(2);
    content[blockIndex] = updateNestedProp(currentBlock, propPath, patch);
    return { ...data, content };
  }

  // /content/N/type - update block type
  if (pathParts[1] === "type" && pathParts.length === 2) {
    content[blockIndex] = { ...currentBlock, type: patch.value as string };
    return { ...data, content };
  }

  return data;
}

/**
 * Handle json-render elements/children format and convert to Puck content
 */
function handleElementsPatch(
  data: Data,
  pathParts: string[],
  patch: PatchOperation
): Data {
  if (pathParts.length === 0 && patch.op === "add" && patch.value) {
    // Add a new element - convert to Puck block format
    const element = patch.value as {
      key?: string;
      type: string;
      props?: Record<string, unknown>;
    };

    const puckBlock: PuckBlock = {
      type: element.type,
      props: {
        id: element.key || `${element.type}-${Date.now()}`,
        ...(element.props || {}),
      },
    };

    return {
      ...data,
      content: [...(data.content || []), puckBlock],
    };
  }

  // Handle element by key - find and update
  if (pathParts.length > 0) {
    const elementKey = pathParts[0];
    const content = data.content || [];
    const blockIndex = content.findIndex(
      (block) => (block.props as { id?: string }).id === elementKey
    );

    if (blockIndex !== -1) {
      // Delegate to content patch handler
      return handleContentPatch(
        data,
        [String(blockIndex), ...pathParts.slice(1)],
        patch
      );
    }
  }

  return data;
}

/**
 * Update a nested prop in a block
 */
function updateNestedProp(
  block: PuckBlock,
  propPath: string[],
  patch: PatchOperation
): PuckBlock {
  if (propPath.length === 1) {
    // Direct prop update
    return {
      ...block,
      props: {
        ...block.props,
        [propPath[0]]: patch.value,
      },
    };
  }

  // Deep nested update (e.g., items/0/title)
  const [firstKey, ...restPath] = propPath;
  const currentValue = block.props[firstKey];

  if (
    Array.isArray(currentValue) &&
    !Number.isNaN(Number.parseInt(restPath[0], 10))
  ) {
    // Array item update
    const arrayIndex = Number.parseInt(restPath[0], 10);
    const newArray = [...currentValue];

    if (restPath.length === 1) {
      // Replace entire array item
      newArray[arrayIndex] = patch.value;
    } else {
      // Update nested property in array item
      const item = newArray[arrayIndex];
      if (typeof item === "object" && item !== null) {
        newArray[arrayIndex] = {
          ...item,
          [restPath[1]]: patch.value,
        };
      }
    }

    return {
      ...block,
      props: {
        ...block.props,
        [firstKey]: newArray,
      },
    };
  }

  if (typeof currentValue === "object" && currentValue !== null) {
    // Object property update
    return {
      ...block,
      props: {
        ...block.props,
        [firstKey]: {
          ...currentValue,
          [restPath[0]]: patch.value,
        },
      },
    };
  }

  return block;
}

/**
 * Apply multiple patches in sequence
 */
export function applyPatches(data: Data, patches: PatchOperation[]): Data {
  return patches.reduce(
    (current, patch) => applyPatchToPuckData(current, patch),
    data
  );
}

/**
 * Create a streaming patch handler that processes incoming text chunks
 */
export function createStreamHandler(
  onDataChange: (data: Data) => void,
  initialData: Data
) {
  let currentData = initialData;
  let buffer = "";

  return {
    /**
     * Process an incoming text chunk
     */
    processChunk(chunk: string) {
      buffer += chunk;

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const patch = parsePatch(line);
        if (patch) {
          currentData = applyPatchToPuckData(currentData, patch);
          onDataChange(currentData);
        }
      }
    },

    /**
     * Finalize processing (handle any remaining buffer content)
     */
    finalize() {
      if (buffer.trim()) {
        const patch = parsePatch(buffer);
        if (patch) {
          currentData = applyPatchToPuckData(currentData, patch);
          onDataChange(currentData);
        }
      }
      buffer = "";
    },

    /**
     * Get current data state
     */
    getData() {
      return currentData;
    },

    /**
     * Reset to new initial data
     */
    reset(data: Data) {
      currentData = data;
      buffer = "";
    },
  };
}
