"use client";

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DroppableContainer,
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
import { autosaveSignature, shouldAutosave } from "./autosave-signature";
import { CanvasPane } from "./canvas";
import {
  acceptsDrop,
  applyDrop,
  type CanvasDrag,
  type DragSource,
  type DropTarget,
  type DropZone,
  dragSourceOf,
  dropIndicator,
  dropTargetOf,
  rankDropZones,
  resolveDrop,
} from "./canvas/drop";
import { sectionLabel } from "./canvas/section-frame";
import { InspectorPane } from "./inspector";
import { PalettePane } from "./palette";
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
 * new-section zones. Then the closest wins (`rankDropZones`): centre to
 * centre, except that the full-width new-section boundaries are measured
 * vertically, so a drag over a side column can still reach them.
 */
const canvasCollisions: CollisionDetection = (args) => {
  const source = dragSourceOf(args.active.data.current);
  if (!source) {
    return closestCenter(args);
  }
  const { collisionRect, droppableRects } = args;
  const zones: DropZone<DroppableContainer>[] = [];
  for (const container of args.droppableContainers) {
    const target = dropTargetOf(container.data.current);
    const rect = droppableRects.get(container.id);
    if (target && rect && acceptsDrop(source.source, target.kind)) {
      zones.push({ id: container, kind: target.kind, rect });
    }
  }
  const center = {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  };
  return rankDropZones(center, zones).map(({ distance, id: container }) => ({
    data: { droppableContainer: container, value: distance },
    id: container.id,
  }));
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
  // The document as the current locale was hydrated, and whether it has
  // changed since. Autosave waits for a real change (C11), so opening a page
  // or a locale writes nothing back, and `/pages/new` creates no row until
  // the first edit.
  const hydratedRef = useRef<{
    changed: boolean;
    locale: EditorLocale;
    signature: string;
  } | null>(null);

  // Debounced save to Appwrite
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  const localeRef = useRef(activeLocale);
  const savePageRef = useRef(savePage);
  const onDocChangeRef = useRef(onDocChange);
  const _docSignature = autosaveSignature(doc);
  localeRef.current = activeLocale;
  savePageRef.current = savePage;
  onDocChangeRef.current = onDocChange;

  // Hydrate store when the editor enters a locale. Subsequent parent mirrors of
  // the same locale document must not rehydrate the store or autosave loops.
  useEffect(() => {
    if (!initial || hydratedLocaleRef.current === activeLocale) {
      return;
    }

    // Save the last locale's pending edits now: the hydration below changes
    // the document, which would otherwise cancel that save.
    clearTimeout(saveTimer.current);
    const pendingSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    pendingSave?.();

    hydratedLocaleRef.current = activeLocale;
    setDoc(initial);
    hydratedRef.current = {
      changed: false,
      locale: activeLocale,
      signature: autosaveSignature(useEditorStore.getState().doc),
    };
  }, [activeLocale, initial, setDoc]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: autosave is keyed by serialized document changes; refs keep the current locale/callbacks without firing a save for locale-only renders.
  useEffect(() => {
    clearTimeout(saveTimer.current);
    pendingSaveRef.current = null;
    const localeSnapshot = localeRef.current;
    const hydrated = hydratedRef.current;
    if (hydrated?.locale !== localeSnapshot) {
      // The store still holds whatever was there before this locale loaded.
      return;
    }
    const docSnapshot = useEditorStore.getState().doc;
    const savePageSnapshot = savePageRef.current;

    onDocChangeRef.current?.(docSnapshot, localeSnapshot);
    if (
      !shouldAutosave(
        hydrated.signature,
        autosaveSignature(docSnapshot),
        hydrated.changed
      )
    ) {
      return;
    }
    hydrated.changed = true;

    const save = async () => {
      pendingSaveRef.current = null;
      try {
        const result = await savePageSnapshot(docSnapshot, localeSnapshot);
        // Only into the locale it was saved for: a save flushed by a locale
        // switch resolves while the store holds the other locale.
        if (
          result?.slug &&
          result.slug !== docSnapshot.meta.slug &&
          localeRef.current === localeSnapshot
        ) {
          const current = useEditorStore.getState().doc;
          setDoc({ ...current, meta: { ...current.meta, slug: result.slug } });
        }
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 2000);
      } catch (error) {
        console.error("[EditorShell autosave]", error);
        setSaving("error");
      }
    };
    pendingSaveRef.current = save;
    setSaving("pending");
    saveTimer.current = setTimeout(save, DEBOUNCE_MS);
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
    </EditorCallbacksContext.Provider>
  );
}
