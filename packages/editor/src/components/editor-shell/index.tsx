"use client";

import {
  type CollisionDetection,
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
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { getBlock } from "@/blocks/registry";
import { EditorCallbacksContext } from "@/editor/callbacks";
import { withPublishStatusSync } from "@/editor/publish-status";
import { useEditorStore } from "@/editor/store";
import { findBlock, findSection } from "@/editor/tree";
import type {
  EditorCampus,
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
} from "@/editor/types";
import { autosaveSignature } from "./autosave-signature";
import { CanvasPane } from "./canvas";
import {
  acceptsDrop,
  applyDrop,
  type CanvasDrag,
  type DragSource,
  type DropTarget,
  dragSourceOf,
  dropIndicator,
  dropTargetOf,
  resolveDrop,
} from "./canvas/drop";
import { sectionLabel } from "./canvas/section-frame";
import { InspectorPane } from "./inspector";
import { PalettePane } from "./palette";
import { ThemeScope } from "./theme-scope";
import { Topbar } from "./topbar";

// Import block registrations (side effects)
import "@/blocks/index";

interface Props {
  activeLocale: EditorLocale;
  campuses?: EditorCampus[];
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

const EMPTY_CAMPUSES: EditorCampus[] = [];
const DEBOUNCE_MS = 800;

/**
 * Only the zones a drag can land in take part: sections see section and
 * new-section zones, blocks and palette items see blocks, column ends and
 * new-section zones. Then the closest centre wins, as before.
 */
const canvasCollisions: CollisionDetection = (args) => {
  const source = dragSourceOf(args.active.data.current);
  if (!source) {
    return closestCenter(args);
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => {
      const target = dropTargetOf(container.data.current);
      return target !== null && acceptsDrop(source.source, target.kind);
    }),
  });
};

/** What the drag overlay says while `source` is dragged. */
function dragLabel(doc: PageDoc, source: DragSource): string | null {
  if (source.source === "palette") {
    return getBlock(source.type)?.label ?? source.type;
  }
  if (source.source === "block") {
    const found = findBlock(doc, source.blockId);
    return found
      ? (getBlock(found.block.type)?.label ?? found.block.type)
      : null;
  }
  const found = findSection(doc, source.sectionId);
  return found ? sectionLabel(found.section) : null;
}

export function EditorShell({
  initial,
  savePage,
  uploadFile,
  departments,
  lockedMeta,
  onExit,
  campuses = EMPTY_CAMPUSES,
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
  const setStatus = useEditorStore((s) => s.setStatus);
  const doc = useEditorStore((s) => s.doc);
  // Mirror a publish/unpublish into the store, or the next autosave writes
  // the stale status back and undoes it.
  const publishCallbacks = useMemo(
    () => withPublishStatusSync({ onPublish, onUnpublish }, setStatus),
    [onPublish, onUnpublish, setStatus]
  );
  const setSaving = useEditorStore((s) => s.setSaving);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const drag = useMemo<CanvasDrag | null>(
    () =>
      dragSource
        ? {
            indicator: dropIndicator(
              doc,
              resolveDrop(doc, dragSource, dropTarget)
            ),
            source: dragSource,
          }
        : null,
    [doc, dragSource, dropTarget]
  );
  const overlayLabel = dragSource ? dragLabel(doc, dragSource) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    setDragSource(dragSourceOf(event.active.data.current));
    setDropTarget(null);
  }

  function handleDragOver(event: DragOverEvent) {
    setDropTarget(dropTargetOf(event.over?.data.current));
  }

  function resetDrag() {
    setDragSource(null);
    setDropTarget(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = dragSourceOf(event.active.data.current);
    if (source) {
      const store = useEditorStore.getState();
      applyDrop(
        resolveDrop(store.doc, source, dropTargetOf(event.over?.data.current)),
        store
      );
    }
    resetDrag();
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
  const _docSignature = autosaveSignature(doc);
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
        campuses,
        departments,
        lockedMeta,
        onExit,
        onPublish: publishCallbacks.onPublish,
        onUnpublish: publishCallbacks.onUnpublish,
        activeLocale,
        locales,
        onLocaleChange,
        onTranslateLocale,
        translatingLocale,
      }}
    >
      <ThemeScope accent={initial?.meta.accentColor}>
        <DndContext
          collisionDetection={canvasCollisions}
          onDragCancel={resetDrag}
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
              <CanvasPane drag={drag} />
              <InspectorPane />
            </div>
          </div>

          <DragOverlay>
            {overlayLabel && (
              <div className="pe-drag-ghost">
                <div aria-hidden="true" className="pe-drag-ghost__thumb" />
                {overlayLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </ThemeScope>
    </EditorCallbacksContext.Provider>
  );
}
