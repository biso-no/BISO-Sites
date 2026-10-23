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
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { getBlock } from "@/blocks/registry";
import { EditorCallbacksContext } from "@/editor/callbacks";
import { guardPublish, themeBlocksSave } from "@/editor/effective-theme";
import { withPublishStatusSync } from "@/editor/publish-status";
import { useEditorStore } from "@/editor/store";
import { findBlock, findSection } from "@/editor/tree";
import type {
  EditorCampus,
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
  PublishOutcome,
  StoredMeta,
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
import { createPendingSaves, type SaveRun, type SaveTo } from "./pending-save";
import { Topbar } from "./topbar";
import { useUnloadPrompt } from "./unload-prompt";

// Import block registrations (side effects)
import "@/blocks/index";

/** What the shell offers its host through `ref`. */
export interface EditorShellHandle {
  /**
   * Run the debounced save now and resolve once it is stored. Resolves at
   * once when nothing is pending, waits for a save already in flight, and
   * rejects when the latest save fails. While the theme blocks saving it
   * resolves without saving: a failing theme is never stored.
   */
  flushPendingSave: () => Promise<void>;
}

interface Props {
  activeLocale: EditorLocale;
  campuses?: EditorCampus[];
  departments: EditorDepartment[];
  initial: PageDoc | null;
  locales: EditorLocaleOption[];
  lockedMeta?: { department?: boolean; slug?: boolean };
  onDocChange?: (doc: PageDoc, locale: EditorLocale) => void;
  onExit?: () => void;
  /**
   * The last-chance save when the editor unmounts or the page is hidden with
   * a save pending, in place of `savePage`. A host whose save can outlive the
   * page (`sendBeacon`, `fetch` with `keepalive`) sends it that way here; one
   * that can't documents the limit. Default: `savePage`, best effort.
   */
  onFlush?: (
    doc: PageDoc,
    locale: EditorLocale
  ) => Promise<StoredMeta | undefined>;
  onLocaleChange: (locale: EditorLocale) => void;
  onPublish?: (locale: EditorLocale) => Promise<PublishOutcome | undefined>;
  onTranslateLocale?: (targetLocale: EditorLocale) => Promise<void>;
  onUnpublish?: (locale: EditorLocale) => Promise<void>;
  ref?: Ref<EditorShellHandle>;
  /** Resolves with what the server stored differently from `doc`, if anything. */
  savePage: (
    doc: PageDoc,
    locale: EditorLocale
  ) => Promise<StoredMeta | undefined>;
  topbarActions?: ReactNode;
  translatingLocale?: EditorLocale | null;
  uploadFile: (fd: FormData) => Promise<{ fileId: string; url: string }>;
}

const EMPTY_CAMPUSES: EditorCampus[] = [];
const DEBOUNCE_MS = 800;
const LATEST_EDITS_NOT_SAVED =
  "The latest edits could not be saved, so nothing was published";

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
  onFlush,
  onTranslateLocale,
  ref,
  translatingLocale,
  topbarActions,
}: Props) {
  const setDoc = useEditorStore((s) => s.setDoc);
  const setStatus = useEditorStore((s) => s.setStatus);
  const doc = useEditorStore((s) => s.doc);
  const setSaving = useEditorStore((s) => s.setSaving);
  // Closing the tab now would lose edits: a save is waiting out the debounce
  // or on its way (both "pending"), the last one failed, or nothing saves
  // while the colours fail.
  const unsaved = useEditorStore(
    (s) =>
      s.saving === "pending" || s.saving === "error" || s.saving === "blocked"
  );
  useUnloadPrompt(unsaved);
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
  const [pendingSaves] = useState(createPendingSaves);
  const localeRef = useRef(activeLocale);
  const savePageRef = useRef(savePage);
  const onDocChangeRef = useRef(onDocChange);
  const onFlushRef = useRef<SaveTo | undefined>(onFlush);
  const _docSignature = autosaveSignature(doc);
  localeRef.current = activeLocale;
  savePageRef.current = savePage;
  onDocChangeRef.current = onDocChange;
  onFlushRef.current = onFlush;

  const flushPendingSave = useCallback(async () => {
    if (useEditorStore.getState().saving === "blocked") {
      return;
    }
    if (!(await pendingSaves.flush())) {
      throw new Error(LATEST_EDITS_NOT_SAVED);
    }
  }, [pendingSaves]);
  useImperativeHandle(ref, () => ({ flushPendingSave }), [flushPendingSave]);

  // The last chance for a pending save: leaving the editor, or the page being
  // hidden (closed, reloaded, sent to the background). Best effort: on a real
  // unload the browser may cancel the request, which is why the tab asks
  // before closing while a save is pending.
  useEffect(() => {
    const flush = () => pendingSaves.start(onFlushRef.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [pendingSaves]);

  /**
   * `doc` with the publish status the store holds now, while it holds that
   * locale. An edit made while a publish (or unpublish) was on its way was
   * snapshotted with the old status, and saving that would take the page
   * off the site again (or put it back).
   */
  function withCurrentStatus(snapshot: PageDoc, locale: EditorLocale): PageDoc {
    const { status } = useEditorStore.getState().doc.meta;
    if (localeRef.current !== locale || snapshot.meta.status === status) {
      return snapshot;
    }
    return { ...snapshot, meta: { ...snapshot.meta, status } };
  }

  /**
   * After a server-side correction to the document (`apply`), treat the
   * corrected document as what is stored when `storedBefore` says the store
   * matched storage beforehand. The correction then fires no save: one would
   * be redundant, and a save right after a publish bumps the page row and
   * makes a queued auto-translation give up as stale.
   */
  function correctStoredDoc(apply: () => void, storedBefore: boolean) {
    apply();
    const hydrated = hydratedRef.current;
    if (storedBefore && hydrated?.locale === localeRef.current) {
      hydrated.signature = autosaveSignature(useEditorStore.getState().doc);
      hydrated.changed = false;
    }
  }
  const correctStoredDocRef = useRef(correctStoredDoc);
  correctStoredDocRef.current = correctStoredDoc;

  // Mirror a publish/unpublish into the store, or the next autosave writes
  // the stale status back and undoes it. A theme the publish copied to the
  // department leaves the page the same way: nothing unsaved means the store
  // matched storage, which the server has just stripped of the theme too.
  // Publish stores a pending edit first: it copies the stored draft live, so
  // an edit still waiting out the debounce would be left out.
  const publishCallbacks = useMemo(
    () =>
      withPublishStatusSync(
        {
          onPublish: guardPublish(
            onPublish &&
              (async (locale: EditorLocale) => {
                await flushPendingSave();
                return onPublish(locale);
              }),
            () => useEditorStore.getState().doc.meta
          ),
          onUnpublish,
        },
        setStatus,
        () => {
          const { saving } = useEditorStore.getState();
          correctStoredDocRef.current(
            () => useEditorStore.getState().dropPageTheme(),
            saving === "idle" || saving === "saved"
          );
        }
      ),
    [flushPendingSave, onPublish, onUnpublish, setStatus]
  );

  // Hydrate store when the editor enters a locale. Subsequent parent mirrors of
  // the same locale document must not rehydrate the store or autosave loops.
  useEffect(() => {
    if (!initial || hydratedLocaleRef.current === activeLocale) {
      return;
    }

    // Save the last locale's pending edits now: the hydration below changes
    // the document, which would otherwise cancel that save.
    pendingSaves.start();

    hydratedLocaleRef.current = activeLocale;
    setDoc(initial);
    hydratedRef.current = {
      changed: false,
      locale: activeLocale,
      signature: autosaveSignature(useEditorStore.getState().doc),
    };
  }, [activeLocale, initial, pendingSaves, setDoc]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: autosave is keyed by serialized document changes; refs keep the current locale/callbacks without firing a save for locale-only renders.
  useEffect(() => {
    pendingSaves.cancel();
    const localeSnapshot = localeRef.current;
    const hydrated = hydratedRef.current;
    if (hydrated?.locale !== localeSnapshot) {
      // The store still holds whatever was there before this locale loaded.
      return;
    }
    const docSnapshot = useEditorStore.getState().doc;
    const savePageSnapshot = savePageRef.current;

    onDocChangeRef.current?.(docSnapshot, localeSnapshot);
    if (themeBlocksSave(docSnapshot.meta)) {
      // Nothing saves while the colours fail; say so instead of "Saving…".
      setSaving("blocked");
      return;
    }
    if (useEditorStore.getState().saving === "blocked") {
      setSaving("idle");
    }
    if (
      !shouldAutosave(
        hydrated.signature,
        autosaveSignature(docSnapshot),
        hydrated.changed,
        false
      )
    ) {
      return;
    }
    hydrated.changed = true;

    const save: SaveRun = async (saveTo = savePageSnapshot) => {
      try {
        const result = await saveTo(
          withCurrentStatus(docSnapshot, localeSnapshot),
          localeSnapshot
        );
        // Only into the locale it was saved for: a save flushed by a locale
        // switch resolves while the store holds the other locale. The stored
        // slug and department replace what was sent, with no undo step.
        if (result && localeRef.current === localeSnapshot) {
          const sent = {
            department: docSnapshot.meta.department,
            slug: docSnapshot.meta.slug,
          };
          correctStoredDocRef.current(
            () => useEditorStore.getState().adoptStoredMeta(sent, result),
            autosaveSignature(useEditorStore.getState().doc) ===
              autosaveSignature(docSnapshot)
          );
        }
        // A theme block that arrived meanwhile owns the status.
        if (useEditorStore.getState().saving !== "blocked") {
          setSaving("saved");
          setTimeout(() => {
            if (useEditorStore.getState().saving === "saved") {
              setSaving("idle");
            }
          }, 2000);
        }
        return true;
      } catch (error) {
        console.error("[EditorShell autosave]", error);
        setSaving("error");
        // Unsaved: the next flush, locale switch or unmount tries again.
        pendingSaves.retry(save);
        return false;
      }
    };
    setSaving("pending");
    pendingSaves.schedule(save, DEBOUNCE_MS);
  }, [_docSignature, pendingSaves, setSaving]);

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
