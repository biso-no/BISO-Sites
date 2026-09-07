"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { EditorCallbacksContext } from "@/editor/callbacks";
import { useBlocks } from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";
import type {
  BlockType,
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
} from "@/editor/types";
import { CanvasPane } from "./canvas";
import { InspectorPane } from "./inspector";
import { PalettePane } from "./palette";
import { ThemeScope } from "./theme-scope";
import { Topbar } from "./topbar";

// Import block registrations (side effects)
import "@/blocks/index";

interface Props {
  activeLocale: EditorLocale;
  departments: EditorDepartment[];
  initial: PageDoc | null;
  locales: EditorLocaleOption[];
  lockedMeta?: { department?: boolean; slug?: boolean };
  onDocChange?: (doc: PageDoc, locale: EditorLocale) => void;
  onExit?: () => void;
  onLocaleChange: (locale: EditorLocale) => void;
  onPublish?: (locale: EditorLocale) => Promise<void>;
  onTranslateLocale?: (targetLocale: EditorLocale) => Promise<void>;
  onUnpublish?: (locale: EditorLocale) => Promise<void>;
  savePage: (
    doc: PageDoc,
    locale: EditorLocale
  ) => Promise<{ slug?: string } | undefined>;
  topbarActions?: ReactNode;
  translatingLocale?: EditorLocale | null;
  uploadFile: (fd: FormData) => Promise<{ fileId: string; url: string }>;
}

const DEBOUNCE_MS = 800;

export function EditorShell({
  initial,
  savePage,
  uploadFile,
  departments,
  lockedMeta,
  onExit,
  onPublish,
  onUnpublish,
  activeLocale,
  locales,
  onLocaleChange,
  onDocChange,
  onTranslateLocale,
  translatingLocale,
  topbarActions,
}: Props) {
  const setDoc = useEditorStore((s) => s.setDoc);
  const doc = useEditorStore((s) => s.doc);
  const setSaving = useEditorStore((s) => s.setSaving);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const reorder = useEditorStore((s) => s.reorder);
  const insertBlock = useEditorStore((s) => s.insertBlock);
  const blocks = useBlocks();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activePaletteType, setActivePaletteType] = useState<BlockType | null>(
    null
  );
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
        const afterId = blocks.length > 0 ? blocks.at(-1)?.id : undefined;
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
      if (fromIdx !== -1 && toIdx !== -1) {
        reorder(fromIdx, toIdx);
      }
    }

    setActiveDragId(null);
    setActivePaletteType(null);
    setOverId(null);
  }

  // Keep the store's locale aligned with the editor's, so the canvas preview
  // requests auto-source feeds (events/jobs/news) in the language being edited
  // rather than the store default.
  const setLocale = useEditorStore((s) => s.setLocale);
  useEffect(() => {
    setLocale(activeLocale);
  }, [activeLocale, setLocale]);

  const hydratedLocaleRef = useRef<EditorLocale | null>(null);

  // Hydrate store when the editor enters a locale. Subsequent parent mirrors of
  // the same locale document must not rehydrate the store or autosave loops.
  useEffect(() => {
    if (!initial || hydratedLocaleRef.current === activeLocale) {
      return;
    }

    hydratedLocaleRef.current = activeLocale;
    setDoc(initial);
  }, [activeLocale, initial, setDoc]);

  // Debounced save to Appwrite
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const docRef = useRef(doc);
  const localeRef = useRef(activeLocale);
  const savePageRef = useRef(savePage);
  const onDocChangeRef = useRef(onDocChange);
  const _docSignature = JSON.stringify(doc);
  docRef.current = doc;
  localeRef.current = activeLocale;
  savePageRef.current = savePage;
  onDocChangeRef.current = onDocChange;

  // biome-ignore lint/correctness/useExhaustiveDependencies: autosave is keyed by serialized document changes; refs keep the current locale/callbacks without firing a save for locale-only renders.
  useEffect(() => {
    clearTimeout(saveTimer.current);
    const docSnapshot = docRef.current;
    const localeSnapshot = localeRef.current;
    const savePageSnapshot = savePageRef.current;
    const onDocChangeSnapshot = onDocChangeRef.current;

    onDocChangeSnapshot?.(docSnapshot, localeSnapshot);
    setSaving("pending");
    saveTimer.current = setTimeout(async () => {
      try {
        const result = await savePageSnapshot(docSnapshot, localeSnapshot);
        if (result?.slug && result.slug !== docSnapshot.meta.slug) {
          setDoc({
            ...docSnapshot,
            meta: { ...docSnapshot.meta, slug: result.slug },
          });
        }
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 2000);
      } catch (error) {
        console.error("[EditorShell autosave]", error);
        setSaving("error");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [_docSignature, setSaving]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.target instanceof HTMLElement && e.target.isContentEditable) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo]);

  return (
    <EditorCallbacksContext.Provider
      value={{
        savePage,
        uploadFile,
        departments,
        lockedMeta,
        onExit,
        onPublish,
        onUnpublish,
        activeLocale,
        locales,
        onLocaleChange,
        onTranslateLocale,
        translatingLocale,
      }}
    >
      <ThemeScope accent={initial?.meta.accentColor}>
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
          sensors={sensors}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100vh",
              overflow: "hidden",
              position: "relative",
              zIndex: 2,
            }}
          >
            <Topbar actions={topbarActions} />
            <div className="pe-shell">
              <PalettePane />
              <CanvasPane
                activeDragId={activeDragId}
                activePaletteType={activePaletteType}
                overId={overId}
              />
              <InspectorPane />
            </div>
          </div>

          <DragOverlay>
            {activeDragId &&
              (() => {
                const block = blocks.find((b) => b.id === activeDragId);
                if (!block) {
                  return null;
                }
                return (
                  <div className="pe-drag-ghost">
                    <div aria-hidden="true" className="pe-drag-ghost__thumb" />
                    {block.type}
                  </div>
                );
              })()}
            {activePaletteType && (
              <div className="pe-drag-ghost">
                <div aria-hidden="true" className="pe-drag-ghost__thumb" />
                {activePaletteType}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </ThemeScope>
    </EditorCallbacksContext.Provider>
  );
}
