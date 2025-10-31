import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { EditorData, User, Awareness } from "../types";

/**
 * Yjs Integration Layer for Real-time Collaboration
 */

export class YjsAdapter {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private dataMap: Y.Map<any>;
  private awarenessMap: Y.Map<any>;
  private undoManager: Y.UndoManager;
  private localUser: User;

  constructor(
    documentId: string,
    wsUrl: string,
    user: User,
    onUpdate?: (data: EditorData) => void
  ) {
    this.doc = new Y.Doc();
    this.localUser = user;

    // Create shared types
    this.dataMap = this.doc.getMap("editorData");
    this.awarenessMap = this.doc.getMap("awareness");

    // Setup undo/redo
    this.undoManager = new Y.UndoManager(this.dataMap, {
      trackedOrigins: new Set([this.doc.clientID]),
    });

    // Connect to WebSocket server
    if (typeof window !== "undefined") {
      this.provider = new WebsocketProvider(wsUrl, documentId, this.doc, {
        connect: true,
      });

      // Set local user awareness
      this.provider.awareness.setLocalState({
        user: this.localUser,
        cursor: null,
      });

      // Listen to changes
      this.dataMap.observe((event) => {
        if (onUpdate) {
          const data = this.getData();
          if (data) {
            onUpdate(data);
          }
        }
      });
    }
  }

  /**
   * Set editor data
   */
  setData(data: EditorData): void {
    this.doc.transact(() => {
      this.dataMap.set("content", data.content);
      this.dataMap.set("root", data.root);
      this.dataMap.set("zones", data.zones || {});
    });
  }

  /**
   * Get current editor data
   */
  getData(): EditorData | null {
    const content = this.dataMap.get("content");
    const root = this.dataMap.get("root");
    const zones = this.dataMap.get("zones");

    if (!content || !root) {
      return null;
    }

    return {
      content,
      root,
      zones: zones || {},
    };
  }

  /**
   * Update a specific part of the data
   */
  updateData(updates: Partial<EditorData>): void {
    this.doc.transact(() => {
      if (updates.content !== undefined) {
        this.dataMap.set("content", updates.content);
      }
      if (updates.root !== undefined) {
        this.dataMap.set("root", updates.root);
      }
      if (updates.zones !== undefined) {
        this.dataMap.set("zones", updates.zones);
      }
    });
  }

  /**
   * Get awareness information (active users, cursors, etc.)
   */
  getAwareness(): Awareness {
    if (!this.provider) {
      return {
        users: new Map(),
        localUser: this.localUser,
      };
    }

    const states = this.provider.awareness.getStates();
    const users = new Map<number, User>();

    states.forEach((state, clientId) => {
      if (state.user) {
        users.set(clientId, {
          ...state.user,
          cursor: state.cursor,
        });
      }
    });

    return {
      users,
      localUser: this.localUser,
    };
  }

  /**
   * Update local user cursor position
   */
  updateCursor(position: { x: number; y: number } | null): void {
    if (this.provider) {
      const currentState = this.provider.awareness.getLocalState();
      this.provider.awareness.setLocalState({
        ...currentState,
        cursor: position,
      });
    }
  }

  /**
   * Subscribe to awareness changes
   */
  onAwarenessChange(callback: (awareness: Awareness) => void): () => void {
    if (!this.provider) {
      return () => {};
    }

    const handler = () => {
      callback(this.getAwareness());
    };

    this.provider.awareness.on("change", handler);

    return () => {
      this.provider?.awareness.off("change", handler);
    };
  }

  /**
   * Undo last change
   */
  undo(): void {
    this.undoManager.undo();
  }

  /**
   * Redo last undone change
   */
  redo(): void {
    this.undoManager.redo();
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  /**
   * Disconnect and cleanup
   */
  destroy(): void {
    if (this.provider) {
      this.provider.destroy();
    }
    this.doc.destroy();
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): "connected" | "disconnected" | "connecting" {
    if (!this.provider) {
      return "disconnected";
    }

    if (this.provider.wsconnected) {
      return "connected";
    }

    if (this.provider.wsconnecting) {
      return "connecting";
    }

    return "disconnected";
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(
    callback: (status: "connected" | "disconnected" | "connecting") => void
  ): () => void {
    if (!this.provider) {
      return () => {};
    }

    const statusHandler = () => {
      callback(this.getConnectionStatus());
    };

    this.provider.on("status", statusHandler);

    return () => {
      this.provider?.off("status", statusHandler);
    };
  }
}

/**
 * Helper function to generate random user color
 */
export function generateUserColor(): string {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#52B788",
  ];
  return colors[Math.floor(Math.random() * colors.length)] || "#000000";
}

/**
 * Helper function to create a default user
 */
export function createUser(name?: string): User {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name || `User ${Math.floor(Math.random() * 1000)}`,
    color: generateUserColor(),
  };
}

