"use client";

import { useState, useEffect, useCallback } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "../config";
import { EditorData } from "../types";
import { YjsAdapter, createUser } from "../lib/yjs-adapter";
import { CollaborationUI, Cursors } from "../components/collaboration-ui";

interface CollaborativeEditorProps {
  documentId: string;
  wsUrl: string;
  userName?: string;
  data?: EditorData;
  onPublish?: (data: EditorData) => void | Promise<void>;
  headerPath?: string;
}

/**
 * Collaborative Editor with Real-time Collaboration via Yjs
 * 
 * @example
 * ```tsx
 * import { CollaborativeEditor } from "@repo/editor/editor/collaborative";
 * 
 * function MyCollabEditor() {
 *   return (
 *     <CollaborativeEditor
 *       documentId="page-123"
 *       wsUrl="ws://localhost:1234"
 *       userName="John Doe"
 *       onPublish={async (data) => {
 *         await saveToDatabase(data);
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export function CollaborativeEditor({
  documentId,
  wsUrl,
  userName,
  data: initialData,
  onPublish,
  headerPath,
}: CollaborativeEditorProps) {
  const [yjsAdapter, setYjsAdapter] = useState<YjsAdapter | null>(null);
  const [editorData, setEditorData] = useState<EditorData>(
    initialData || {
      content: [],
      root: { props: {} },
      zones: {},
    }
  );
  const [awareness, setAwareness] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("connecting");

  // Initialize Yjs adapter
  useEffect(() => {
    const user = createUser(userName);
    const adapter = new YjsAdapter(
      documentId,
      wsUrl,
      user,
      (data) => {
        setEditorData(data);
      }
    );

    // Set initial data
    if (initialData) {
      adapter.setData(initialData);
    }

    // Subscribe to awareness changes
    const unsubAwareness = adapter.onAwarenessChange((awarenessData) => {
      setAwareness(awarenessData);
    });

    // Subscribe to connection status
    const unsubStatus = adapter.onConnectionChange((status) => {
      setConnectionStatus(status);
    });

    // Initial awareness
    setAwareness(adapter.getAwareness());
    setConnectionStatus(adapter.getConnectionStatus());

    setYjsAdapter(adapter);

    return () => {
      unsubAwareness();
      unsubStatus();
      adapter.destroy();
    };
  }, [documentId, wsUrl, userName]);

  // Handle editor changes
  const handleChange = useCallback(
    (data: EditorData) => {
      if (yjsAdapter) {
        yjsAdapter.updateData(data);
      }
      setEditorData(data);
    },
    [yjsAdapter]
  );

  // Handle publish
  const handlePublish = async (publishedData: EditorData) => {
    if (onPublish) {
      await onPublish(publishedData);
    }
  };

  // Handle cursor movement
  useEffect(() => {
    if (!yjsAdapter) return;

    const handleMouseMove = (e: MouseEvent) => {
      yjsAdapter.updateCursor({ x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
      yjsAdapter.updateCursor(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [yjsAdapter]);

  if (!yjsAdapter || !awareness) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting to collaboration server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen flex flex-col">
      <CollaborationUI awareness={awareness} connectionStatus={connectionStatus} />
      <div className="flex-1 overflow-hidden">
        <Puck
          config={config}
          data={editorData}
          onPublish={handlePublish}
          onChange={handleChange}
          headerPath={headerPath}
        />
      </div>
      <Cursors awareness={awareness} />
    </div>
  );
}

