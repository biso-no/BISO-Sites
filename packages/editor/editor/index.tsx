"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "../config";
import { EditorData } from "../types";

interface EditorProps {
  data?: EditorData;
  onPublish?: (data: EditorData) => void | Promise<void>;
  onChange?: (data: EditorData) => void;
  headerPath?: string;
}

/**
 * The main Puck Editor component
 * 
 * @example
 * ```tsx
 * import { Editor } from "@repo/editor";
 * 
 * function MyEditor() {
 *   const handlePublish = async (data) => {
 *     await saveToDatabase(data);
 *   };
 * 
 *   return <Editor onPublish={handlePublish} />;
 * }
 * ```
 */
export function Editor({ data, onPublish, onChange, headerPath }: EditorProps) {
  const initialData: EditorData = data || {
    content: [],
    root: { props: {} },
    zones: {},
  };

  const handlePublish = async (publishedData: EditorData) => {
    if (onPublish) {
      await onPublish(publishedData);
    }
  };

  return (
    <Puck
      config={config}
      data={initialData}
      onPublish={handlePublish}
      onChange={onChange}
      headerPath={headerPath}
    />
  );
}
