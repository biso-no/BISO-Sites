"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useEditorStore } from "@/editor/store";
import { useBlocks } from "@/editor/hooks";
import type { PageDoc, BlockType, EditorDepartment } from "@/editor/types";
import { EditorCallbacksContext } from "@/editor/callbacks";
import { ThemeScope } from "./theme-scope";
import { PalettePane } from "./palette";
import { CanvasPane } from "./canvas";
import { InspectorPane } from "./inspector";
import { Topbar } from "./topbar";

// Import block registrations (side effects)
import "@/blocks/index";

interface Props {
  initial: PageDoc | null;
  savePage: (doc: PageDoc) => Promise<void>;
  uploadFile: (fd: FormData) => Promise<{ fileId: string; url: string }>;
  departments: EditorDepartment[];
}

const DEBOUNCE_MS = 800;

export function EditorShell({ initial, savePage, uploadFile, departments }: Props) {
  const setDoc    = useEditorStore((s) => s.setDoc);
  const doc       = useEditorStore((s) => s.doc);
  const setSaving = useEditorStore((s) => s.setSaving);
  const undo      = useEditorStore((s) => s.undo);
  const redo      = useEditorStore((s) => s.redo);
  const reorder   = useEditorStore((s) => s.reorder);
  const insertBlock = useEditorStore((s) => s.insertBlock);
  const blocks    = useBlocks();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activePaletteType, setActivePaletteType] = useState<BlockType | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.source === "palette") {
      setActivePaletteType(data.type as BlockType);
    } else {
      setActiveDragId(event.active.id as string);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeData = active.data.current;

    if (activeData?.source === "palette" && over) {
      if (over.id === "canvas-end") {
        // Append after the last block
        const afterId = blocks.length > 0 ? blocks[blocks.length - 1].id : undefined;
        insertBlock(activeData.type as BlockType, afterId);
      } else {
        // Insert BEFORE the over block (= after the preceding block)
        const overIdx = blocks.findIndex((b) => b.id === over.id);
        const afterId = overIdx > 0 ? blocks[overIdx - 1].id : undefined;
        insertBlock(activeData.type as BlockType, afterId);
      }
    } else if (activeDragId && over && active.id !== over.id) {
      const fromIdx = blocks.findIndex((b) => b.id === active.id);
      const toIdx = blocks.findIndex((b) => b.id === over.id);
      if (fromIdx !== -1 && toIdx !== -1) reorder(fromIdx, toIdx);
    }

    setActiveDragId(null);
    setActivePaletteType(null);
    setOverId(null);
  }

  // Hydrate store with initial doc on mount
  useEffect(() => {
    if (initial) setDoc(initial);
  }, [initial, setDoc]);

  // Debounced save to Appwrite
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => {
    clearTimeout(saveTimer.current);
    setSaving("pending");
    saveTimer.current = setTimeout(async () => {
      try {
        await savePage(docRef.current);
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 2000);
      } catch {
        setSaving("error");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(doc), setSaving]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo]);

  return (
    <EditorCallbacksContext.Provider value={{ savePage, uploadFile, departments }}>
    <ThemeScope accent={initial?.meta.accentColor}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", position: "relative", zIndex: 2 }}>
          <Topbar />
          <div className="pe-shell">
            <PalettePane />
            <CanvasPane activeDragId={activeDragId} activePaletteType={activePaletteType} overId={overId} />
            <InspectorPane />
          </div>
        </div>

        <DragOverlay>
          {activeDragId && (() => {
            const block = blocks.find((b) => b.id === activeDragId);
            if (!block) return null;
            return (
              <div className="pe-drag-ghost">
                <div className="pe-drag-ghost__thumb" aria-hidden="true" />
                {block.type}
              </div>
            );
          })()}
          {activePaletteType && (
            <div className="pe-drag-ghost">
              <div className="pe-drag-ghost__thumb" aria-hidden="true" />
              {activePaletteType}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </ThemeScope>
    </EditorCallbacksContext.Provider>
  );
}
