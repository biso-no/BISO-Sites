"use client";

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  MEMBERSHIP_TEXT_MAX_ITEMS,
  MEMBERSHIP_TEXT_SPOT_META,
} from "@repo/shared/utils/membership-texts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { MembershipSpotData } from "../../../_actions/membership-texts";
import {
  SERIF_STACK,
  STUDIO,
  StudioButton,
  studioSurface,
} from "../../../_components/studio";
import { DragHandle, useBoardSortable } from "../../_components/board-sortable";
import { PANEL_ERROR_COLOR } from "../../_components/panel-fields";
import { BOARD_FOCUS_RING } from "../../_lib/board-styles";
import {
  type DraftItem,
  draftFromSpot,
  emptyItem,
  hasErrors,
  patchItem,
  snapshot,
  toInput,
  validateDraft,
} from "../_lib/spot-draft";
import { resetSpot, saveSpot } from "./membership-text-actions";

/** A press that moves less than this is a click, never a drag. */
const DRAG_DISTANCE_PX = 8;
const FIELD_CLASS = "border-[#d8cdb6] bg-white text-[15px]";

export interface MembershipTextsEditorProps {
  locale: "en" | "no";
  spots: MembershipSpotData[];
  /** The website's origin, without a trailing slash. */
  webBaseUrl: string;
}

/** One card per place on the website that shows a membership list. */
export function MembershipTextsEditor({
  locale,
  spots,
  webBaseUrl,
}: MembershipTextsEditorProps) {
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const anyDirty = Object.values(dirty).some(Boolean);
  const reportDirty = useCallback(
    (spot: string, value: boolean) =>
      setDirty((current) =>
        current[spot] === value ? current : { ...current, [spot]: value }
      ),
    []
  );

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (!anyDirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  return (
    <div className="space-y-6">
      {spots.map((data) => (
        // One card per spot for good: fresh server data re-seeds a card
        // only while it has no unsaved edits.
        <SpotCard
          data={data}
          key={data.spot}
          locale={locale}
          onDirtyChange={reportDirty}
          webBaseUrl={webBaseUrl}
        />
      ))}
    </div>
  );
}

interface SpotCardProps {
  data: MembershipSpotData;
  locale: "en" | "no";
  onDirtyChange: (spot: string, dirty: boolean) => void;
  webBaseUrl: string;
}

function SpotCard({ data, locale, onDirtyChange, webBaseUrl }: SpotCardProps) {
  const t = useTranslations("adminPortal.benefits.texts");
  const router = useRouter();
  const { spot } = data;
  const meta = MEMBERSHIP_TEXT_SPOT_META[spot];
  const label = locale === "en" ? meta.labelEn : meta.labelNb;
  const { hasBody } = meta;

  const [items, setItems] = useState<DraftItem[]>(() => draftFromSpot(data));
  const [baseline, setBaseline] = useState(() =>
    snapshot(draftFromSpot(data), hasBody)
  );
  const [hasRows, setHasRows] = useState(data.hasRows);
  const [pending, setPending] = useState<"reset" | "save" | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = useRef(false);

  const errors = validateDraft(items, hasBody);
  const changed = snapshot(items, hasBody) !== baseline;
  const full = items.length >= MEMBERSHIP_TEXT_MAX_ITEMS;

  useEffect(() => {
    onDirtyChange(spot, changed);
    return () => onDirtyChange(spot, false);
  }, [changed, onDirtyChange, spot]);

  // Fresh server data (after a refresh) replaces the card's lines only when
  // there is nothing unsaved to lose.
  const seed = JSON.stringify(data);
  const [seen, setSeen] = useState(seed);
  if (seen !== seed) {
    setSeen(seed);
    if (!changed) {
      const fresh = draftFromSpot(data);
      setItems(fresh);
      setBaseline(snapshot(fresh, hasBody));
      setHasRows(data.hasRows);
      setAttempted(false);
    }
  }
  const headingId = useId();

  const update = (key: string, patch: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? patchItem(item, patch) : item))
    );

  const save = async () => {
    if (busy.current) {
      return;
    }
    setAttempted(true);
    if (hasErrors(errors)) {
      return;
    }
    busy.current = true;
    setPending("save");
    try {
      const sent = snapshot(items, hasBody);
      const result = await saveSpot(spot, toInput(items, hasBody));
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("saved"));
      setBaseline(sent);
      setHasRows(true);
      setAttempted(false);
      router.refresh();
    } catch {
      toast.error(t("failed"));
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  const reset = async () => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setPending("reset");
    try {
      const result = await resetSpot(spot);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("resetDone"));
      // The default text, shown and treated as saved right away, so Lagre
      // cannot put the old lines back before the refresh arrives.
      const fresh = draftFromSpot(result.data);
      setItems(fresh);
      setBaseline(snapshot(fresh, hasBody));
      setHasRows(result.data.hasRows);
      setAttempted(false);
      router.refresh();
    } catch {
      toast.error(t("failed"));
    } finally {
      busy.current = false;
      setPending(null);
      setConfirmOpen(false);
    }
  };

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-2xl"
      style={studioSurface}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2
            className="break-words font-normal text-[26px] leading-tight"
            id={headingId}
            style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
          >
            {label}
          </h2>
          <p className="mt-1 text-sm" style={{ color: STUDIO.ink3 }}>
            {t("seenOn", { path: meta.path })}
          </p>
          {hasRows ? null : (
            <p
              className="mt-2 inline-block rounded-full px-3 py-1 text-xs"
              style={{ background: STUDIO.paper3, color: STUDIO.ink2 }}
            >
              {t("notSaved")}
            </p>
          )}
        </div>
        <a
          className={`inline-flex items-center gap-1.5 rounded-sm text-sm underline-offset-4 hover:underline ${BOARD_FOCUS_RING}`}
          href={`${webBaseUrl}${meta.path}`}
          rel="noopener"
          style={{ color: STUDIO.claret }}
          target="_blank"
        >
          {t("viewOnSite")}
          <ExternalLink aria-hidden size={13} />
        </a>
      </header>

      <fieldset
        className="m-0 min-w-0 border-0 px-5 py-5 sm:px-6"
        disabled={pending !== null}
      >
        <ItemList
          errors={errors.items}
          hasBody={hasBody}
          items={items}
          label={label}
          onChange={update}
          onRemove={(key) =>
            setItems((current) => current.filter((item) => item.key !== key))
          }
          onReorder={setItems}
          showErrors={attempted}
        />
        {attempted && errors.card ? (
          <p
            className="mt-3 text-sm"
            role="alert"
            style={{ color: PANEL_ERROR_COLOR }}
          >
            {t(errors.card)}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StudioButton
            className={BOARD_FOCUS_RING}
            disabled={full || pending !== null}
            onClick={() => setItems((current) => [...current, emptyItem()])}
          >
            {t("addLine")}
          </StudioButton>
          {full ? (
            <p className="text-sm" style={{ color: STUDIO.ink3 }}>
              {t("tooMany")}
            </p>
          ) : null}
        </div>
      </fieldset>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
        <StudioButton
          className={`${BOARD_FOCUS_RING} disabled:opacity-50`}
          disabled={!changed || pending !== null}
          onClick={save}
          variant="primary"
        >
          {pending === "save" ? (
            <Loader2 aria-hidden className="animate-spin" size={14} />
          ) : null}
          {pending === "save" ? t("saving") : t("save")}
        </StudioButton>
        {hasRows ? (
          <ResetDialog
            label={label}
            onConfirm={reset}
            onOpenChange={setConfirmOpen}
            open={confirmOpen}
            pending={pending === "reset"}
          />
        ) : null}
      </footer>
    </article>
  );
}

function ResetDialog({
  label,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: {
  label: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}) {
  const t = useTranslations("adminPortal.benefits.texts");
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogTrigger asChild>
        <StudioButton className={BOARD_FOCUS_RING} variant="ghost">
          {t("reset")}
        </StudioButton>
      </AlertDialogTrigger>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("resetTitle", { label })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("resetBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className={BOARD_FOCUS_RING} disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`gap-2 hover:opacity-90 ${BOARD_FOCUS_RING}`}
            disabled={pending}
            onClick={(event) => {
              // Stay open until the reset has finished.
              event.preventDefault();
              onConfirm();
            }}
            style={{ background: PANEL_ERROR_COLOR, color: "#fff" }}
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" size={14} />
            ) : null}
            {t("reset")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ItemListProps {
  errors: Record<string, string>;
  hasBody: boolean;
  items: DraftItem[];
  label: string;
  onChange: (key: string, patch: Partial<DraftItem>) => void;
  onRemove: (key: string) => void;
  onReorder: (items: DraftItem[]) => void;
  showErrors: boolean;
}

function ItemList({
  errors,
  hasBody,
  items,
  label,
  onChange,
  onRemove,
  onReorder,
  showErrors,
}: ItemListProps) {
  const t = useTranslations("adminPortal.benefits.board");
  const tt = useTranslations("adminPortal.benefits.texts");
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const ids = items.map((item) => item.key);
  const titleOf = (id: UniqueIdentifier): string =>
    items.find((item) => item.key === id)?.title_nb.trim() || t("untitled");
  const placeOf = (id: UniqueIdentifier) => ({
    position: ids.indexOf(String(id)) + 1,
    total: ids.length,
  });
  // Spoken by screen readers while sorting; the defaults would read ids.
  const announcements: Announcements = {
    onDragCancel: ({ active }) =>
      t("drag.cancelled", { title: titleOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t("drag.dropped", { title: titleOf(active.id), ...placeOf(over.id) })
        : t("drag.cancelled", { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("drag.movedOver", {
            title: titleOf(active.id),
            ...placeOf(over.id),
          })
        : undefined,
    onDragStart: ({ active }) =>
      t("drag.pickedUp", { title: titleOf(active.id) }),
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) {
      onReorder(arrayMove(items, from, to));
    }
  };

  return (
    <DndContext
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("drag.instructions") },
      }}
      collisionDetection={closestCenter}
      id={dndId}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={tt("list", { label })} className="space-y-3">
          {items.map((item, index) => (
            <ItemRow
              error={
                showErrors || isLive(errors[item.key])
                  ? errors[item.key]
                  : undefined
              }
              hasBody={hasBody}
              index={index}
              item={item}
              key={item.key}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/** Too-long text is flagged as it is typed; a missing title waits for Lagre. */
const isLive = (error: string | undefined): boolean =>
  error === "titleTooLong" || error === "bodyTooLong";

interface ItemRowProps {
  error?: string;
  hasBody: boolean;
  index: number;
  item: DraftItem;
  onChange: (key: string, patch: Partial<DraftItem>) => void;
  onRemove: (key: string) => void;
}

function ItemRow({
  error,
  hasBody,
  index,
  item,
  onChange,
  onRemove,
}: ItemRowProps) {
  const t = useTranslations("adminPortal.benefits.texts");
  const board = useTranslations("adminPortal.benefits.board");
  const sortable = useBoardSortable(item.key);
  const n = index + 1;
  const errorId = `${item.key}-error`;
  return (
    <li
      className="flex items-start gap-2 rounded-xl border bg-white p-3"
      ref={sortable.frameRef}
      style={{
        ...sortable.frameStyle,
        borderColor: STUDIO.rule,
        boxShadow: sortable.isDragging
          ? "0 10px 26px rgba(26,24,20,0.14)"
          : undefined,
      }}
    >
      <DragHandle
        handle={sortable.handle}
        label={board("moveItem", {
          title: item.title_nb.trim() || board("untitled"),
        })}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          aria-label={t("itemTitle", { n })}
          className={FIELD_CLASS}
          onChange={(event) =>
            onChange(item.key, { title_nb: event.target.value })
          }
          type="text"
          value={item.title_nb}
        />
        {hasBody ? (
          <Textarea
            aria-label={t("itemBody", { n })}
            className={FIELD_CLASS}
            onChange={(event) =>
              onChange(item.key, { body_nb: event.target.value })
            }
            rows={3}
            value={item.body_nb}
          />
        ) : null}
        {error ? (
          <p
            className="text-sm"
            id={errorId}
            role="alert"
            style={{ color: PANEL_ERROR_COLOR }}
          >
            {t(error as "titleMissing" | "titleTooLong" | "bodyTooLong")}
          </p>
        ) : null}
        <details className="text-sm">
          <summary
            className={`cursor-pointer rounded-sm ${BOARD_FOCUS_RING}`}
            style={{ color: STUDIO.ink3 }}
          >
            {item.title_en.trim() ? t("englishOwn") : t("englishAuto")}
          </summary>
          <div className="mt-2 space-y-2">
            <Input
              aria-label={t("itemTitleEn", { n })}
              className={FIELD_CLASS}
              onChange={(event) =>
                onChange(item.key, { title_en: event.target.value })
              }
              type="text"
              value={item.title_en}
            />
            {hasBody ? (
              <Textarea
                aria-label={t("itemBodyEn", { n })}
                className={FIELD_CLASS}
                onChange={(event) =>
                  onChange(item.key, { body_en: event.target.value })
                }
                rows={3}
                value={item.body_en}
              />
            ) : null}
            <p style={{ color: STUDIO.ink4 }}>{t("englishHint")}</p>
          </div>
        </details>
      </div>
      <button
        aria-label={t("removeItem", { n })}
        className={`shrink-0 rounded-md px-2 py-1.5 text-sm hover:bg-[#f3eee5] ${BOARD_FOCUS_RING}`}
        onClick={() => onRemove(item.key)}
        style={{ color: STUDIO.ink3 }}
        type="button"
      >
        {t("remove")}
      </button>
    </li>
  );
}
