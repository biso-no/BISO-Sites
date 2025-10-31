"use client";

import { useState, useEffect } from "react";
import { Awareness } from "../types";

interface CollaborationUIProps {
  awareness: Awareness;
  connectionStatus: "connected" | "disconnected" | "connecting";
}

/**
 * Collaboration UI showing active users and connection status
 */
export function CollaborationUI({ awareness, connectionStatus }: CollaborationUIProps) {
  const users = Array.from(awareness.users.values()).filter(
    (user) => user.id !== awareness.localUser.id
  );

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "disconnected":
        return "bg-red-500";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "disconnected":
        return "Disconnected";
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-background border-b">
      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-muted-foreground">{getStatusText()}</span>
      </div>

      {/* Active Users */}
      {users.length > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active:</span>
            <div className="flex -space-x-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-semibold text-white"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Cursor component for showing other users' cursors
 */
interface CursorProps {
  user: {
    id: string;
    name: string;
    color: string;
    cursor?: { x: number; y: number } | null;
  };
}

export function Cursor({ user }: CursorProps) {
  if (!user.cursor) return null;

  return (
    <div
      className="fixed pointer-events-none z-50 transition-all duration-100"
      style={{
        left: user.cursor.x,
        top: user.cursor.y,
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.65376 12.3673L11.6427 18.3562L12.4797 12.4404L18.3955 11.6034L5.65376 12.3673Z"
          fill={user.color}
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      <div
        className="mt-1 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </div>
    </div>
  );
}

/**
 * Container for all collaboration cursors
 */
interface CursorsProps {
  awareness: Awareness;
}

export function Cursors({ awareness }: CursorsProps) {
  const users = Array.from(awareness.users.values()).filter(
    (user) => user.id !== awareness.localUser.id && user.cursor
  );

  return (
    <>
      {users.map((user) => (
        <Cursor key={user.id} user={user} />
      ))}
    </>
  );
}

