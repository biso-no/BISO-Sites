import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { ChevronDown, ChevronRight, Loader2, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { SERIF_STACK, STUDIO, StudioButton } from "../../../_components/studio";
import { BenefitDiscardDialog } from "../../_components/benefit-discard-dialog";
import {
  errorProps,
  FieldError,
  PANEL_ERROR_COLOR,
  PANEL_INPUT_CLASS,
  PanelLabel,
  PanelQuestion,
  panelInputStyle,
} from "../../_components/panel-fields";
import { PartnerLogo } from "../../_components/partner-logo";
import { describeBenefitSaveError } from "../../_lib/benefit-save-error";
import { type AdminLocale, benefitTitle } from "../../_lib/board-display";
import { BOARD_FOCUS_RING } from "../../_lib/board-styles";
import {
  isPartnerFormDirty,
  type PartnerFormErrors,
  type PartnerFormValues,
  partnerFormValues,
  toPartnerInput,
  validatePartnerForm,
} from "../_lib/partner-form";
import { type PartnerCard, visibleDealCount } from "../_lib/partners-state";
import {
  createPartner,
  deletePartner,
  endPartner,
  restartPartner,
  updatePartner,
} from "./partner-actions";
import { PartnerDeleteDialog } from "./partner-delete-dialog";
import { PartnerEndDialog } from "./partner-end-dialog";

/** The server's limits (`benefit_partners`), so a box stops where it would. */
const NAME_MAX = 200;
const URL_MAX = 500;
const DESCRIPTION_MAX = 1000;

const DELETE_OUTLINE = {
  background: "transparent",
  border: "1px solid #f1c9c9",
  color: PANEL_ERROR_COLOR,
} as const;

const FOOTER_BUTTON = `${BOARD_FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-70`;

type PendingAction = "delete" | "end" | "restart" | "save";
type Confirmation = "delete" | "end";
type Result = { data: unknown } | { error: string };

interface RunMessages {
  /** Shown when the request fails, with a known reason under it. */
  failed: string;
  /** A known reason is shown instead of `failed`, not under it. */
  reasonFirst?: boolean;
  succeeded: string;
}

const textareaStyle = {
  ...panelInputStyle,
  lineHeight: 1.5,
  resize: "vertical",
} as const;

export interface PartnerSheetProps {
  campusLabel: (campusId: string) => string;
  /** The partner being edited, or null for a new one. */
  card: PartnerCard | null;
  /** Where a new partner starts. */
  defaultCampusId: string;
  /** Campuses the viewer may put a partner on, in tab order. */
  editableCampusIds: readonly string[];
  locale: AdminLocale;
  onClose: () => void;
  /** Where focus goes once the sheet has closed. */
  onCloseAutoFocus: (event: Event) => void;
  open: boolean;
}

/**
 * Adds or edits a deal partner in a panel over the cards. From here a
 * partnership also ends, starts again or is deleted for good, each behind
 * a plain confirmation that says what happens to the offers.
 */
export function PartnerSheet({
  campusLabel,
  card,
  defaultCampusId,
  editableCampusIds,
  locale,
  onClose,
  onCloseAutoFocus,
  open,
}: PartnerSheetProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tBenefits = useTranslations("adminPortal.benefits");
  const tPanel = useTranslations("adminPortal.benefits.panel");
  const router = useRouter();
  const partner = card?.partner ?? null;
  const editable = partner ? partner.editable : true;
  const [initial] = useState(() => partnerFormValues(partner, defaultCampusId));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PartnerFormErrors>({});
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const focusBeforeDiscard = useRef<HTMLElement | null>(null);
  // False once the sheet has closed or unmounted, so a request that finishes
  // later does not close a sheet opened since.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const dirty = editable && isPartnerFormDirty(values, initial);
  // A partner the viewer cannot change is named, not offered for editing.
  let sheetTitle = t("partnerPanelNew");
  if (partner) {
    sheetTitle = editable ? t("partnerPanelEdit") : partner.name;
  }

  const close = () => {
    live.current = false;
    onClose();
  };

  /** ✕, Esc and the backdrop: never mid-request, and not past unsaved work. */
  const requestClose = () => {
    if (pending) {
      return;
    }
    if (dirty) {
      const active = document.activeElement;
      focusBeforeDiscard.current =
        active instanceof HTMLElement ? active : null;
      setConfirmingDiscard(true);
      return;
    }
    close();
  };

  const update = <K extends keyof PartnerFormValues>(
    key: K,
    value: PartnerFormValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "name" || key === "website") {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  /**
   * Runs one request; success toasts, closes and shows the fresh page. The
   * buttons stay disabled while the sheet slides away, and a closing sheet
   * sends nothing more, so a second click can't save or delete twice.
   */
  const run = async (
    action: PendingAction,
    request: () => Promise<Result>,
    messages: RunMessages
  ) => {
    if (pending !== null || !live.current) {
      return;
    }
    setPending(action);
    let result: Result;
    try {
      result = await request();
    } catch {
      result = { error: "" };
    }
    setConfirming(null);
    if ("error" in result) {
      setPending(null);
      // The server's reason is English and for developers; it stays here.
      console.warn("[partners] request failed:", result.error);
      const details = describeBenefitSaveError(result.error, (key) =>
        tBenefits(key)
      );
      if (messages.reasonFirst) {
        toast.error(details ?? messages.failed);
      } else {
        toast.error(
          messages.failed,
          details ? { description: details } : undefined
        );
      }
      return;
    }
    toast.success(messages.succeeded);
    if (live.current) {
      close();
    }
    router.refresh();
  };

  const save = () => {
    const found = validatePartnerForm(values);
    setErrors(found);
    if (found.name) {
      nameRef.current?.focus();
      return;
    }
    if (found.website) {
      websiteRef.current?.focus();
      return;
    }
    const input = toPartnerInput(values);
    run(
      "save",
      () => (partner ? updatePartner(partner.id, input) : createPartner(input)),
      { failed: t("failed"), succeeded: t("saved") }
    );
  };

  const changePartnership = (action: Exclude<PendingAction, "save">) => {
    if (!partner) {
      return;
    }
    const requests = {
      delete: () => deletePartner(partner.id),
      end: () => endPartner(partner.id),
      restart: () => restartPartner(partner.id),
    };
    const succeeded = {
      delete: t("deletedToast"),
      end: t("endedToast"),
      restart: t("restartedToast"),
    };
    const isDelete = action === "delete";
    run(action, requests[action], {
      failed: isDelete ? tPanel("deleteFailed") : t("changeFailed"),
      // "Kunne ikke endre samarbeidet" says nothing a known reason doesn't.
      reasonFirst: !isDelete,
      succeeded: succeeded[action],
    });
  };

  return (
    <Sheet
      onOpenChange={(next) => {
        if (!next) {
          requestClose();
        }
      }}
      open={open}
    >
      <SheetContent
        className="flex w-full flex-col gap-0 border-[#e5dcca] bg-[#fffdf8] p-0 shadow-[-8px_0_24px_rgba(26,24,20,0.08)] sm:max-w-[520px]"
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (pending || dirty) {
            event.preventDefault();
            requestClose();
          }
        }}
        onInteractOutside={(event) => {
          // A stray click beside the sheet must not throw work away.
          if (pending || dirty) {
            event.preventDefault();
          }
        }}
        onOpenAutoFocus={(event) => {
          // A new partner starts with its name.
          if (!partner) {
            event.preventDefault();
            nameRef.current?.focus();
          }
        }}
        overlayClassName="bg-[#1a1814]/30"
        showCloseButton={false}
        side="right"
      >
        <header
          className="flex shrink-0 items-start justify-between gap-4 border-b px-5 pt-5 pb-4 sm:px-7"
          style={{ borderColor: STUDIO.rule }}
        >
          <div className="min-w-0">
            <SheetDescription
              className="text-[12.5px]"
              style={{ color: STUDIO.ink3 }}
            >
              {campusLabel(values.campusId)}
            </SheetDescription>
            <SheetTitle
              className="mt-1 font-normal text-[30px] leading-[1.1]"
              style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
            >
              {sheetTitle}
            </SheetTitle>
          </div>
          <button
            aria-label={t("close")}
            className={`-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-[#f3eee5] ${BOARD_FOCUS_RING}`}
            onClick={requestClose}
            style={{ color: STUDIO.ink3 }}
            type="button"
          >
            <X aria-hidden size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
          {editable ? null : (
            <p
              className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6"
              style={{
                background: STUDIO.paper2,
                borderColor: STUDIO.rule2,
                color: STUDIO.ink2,
              }}
            >
              <Lock
                aria-hidden
                className="mt-1 shrink-0"
                size={15}
                style={{ color: STUDIO.ink3 }}
              />
              {t("readOnly")}
            </p>
          )}
          <PartnerFields
            campusLabel={campusLabel}
            editable={editable}
            editableCampusIds={editableCampusIds}
            errors={errors}
            nameRef={nameRef}
            update={update}
            values={values}
            websiteRef={websiteRef}
          />
        </div>

        {editable ? (
          <PartnerSheetFooter
            card={card}
            confirming={confirming}
            dirty={dirty}
            locale={locale}
            onChangePartnership={changePartnership}
            onConfirmingChange={(next) => {
              // A confirmation opens and closes only while nothing runs.
              if (!pending) {
                setConfirming(next);
              }
            }}
            onSave={save}
            pending={pending}
          />
        ) : null}
        {editable ? (
          <BenefitDiscardDialog
            onDiscard={close}
            onOpenChange={setConfirmingDiscard}
            open={confirmingDiscard}
            returnFocus={() => focusBeforeDiscard.current?.focus()}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

interface PartnerFieldsProps {
  campusLabel: (campusId: string) => string;
  editable: boolean;
  editableCampusIds: readonly string[];
  errors: PartnerFormErrors;
  nameRef: RefObject<HTMLInputElement | null>;
  update: <K extends keyof PartnerFormValues>(
    key: K,
    value: PartnerFormValues[K]
  ) => void;
  values: PartnerFormValues;
  websiteRef: RefObject<HTMLInputElement | null>;
}

/** Name, website, logo, campus and a short description, English folded away. */
function PartnerFields({
  campusLabel,
  editable,
  editableCampusIds,
  errors,
  nameRef,
  update,
  values,
  websiteRef,
}: PartnerFieldsProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tErrors = useTranslations("adminPortal.benefits.errors");
  const tPanel = useTranslations("adminPortal.benefits.panel");
  const id = useId();
  const [englishOpen, setEnglishOpen] = useState(
    () => values.descriptionEn.trim() !== ""
  );
  const nameError = errors.name ? tErrors(errors.name) : undefined;
  const websiteError = errors.website ? tErrors(errors.website) : undefined;
  // A read-only partner keeps showing its campus, which the viewer may not
  // be able to choose.
  const campusOptions = editableCampusIds.includes(values.campusId)
    ? editableCampusIds
    : [values.campusId, ...editableCampusIds];

  return (
    <>
      <div>
        <PanelLabel htmlFor={`${id}-name`}>{t("name")}</PanelLabel>
        <input
          autoComplete="organization"
          className={PANEL_INPUT_CLASS}
          disabled={!editable}
          id={`${id}-name`}
          maxLength={NAME_MAX}
          onChange={(event) => update("name", event.target.value)}
          ref={nameRef}
          style={panelInputStyle}
          type="text"
          value={values.name}
          {...errorProps(`${id}-name-error`, nameError)}
        />
        <FieldError id={`${id}-name-error`} message={nameError} />
      </div>

      <div>
        <PanelLabel help={tPanel("optional")} htmlFor={`${id}-website`}>
          {t("website")}
        </PanelLabel>
        <input
          autoComplete="url"
          className={PANEL_INPUT_CLASS}
          disabled={!editable}
          id={`${id}-website`}
          inputMode="url"
          maxLength={URL_MAX}
          onChange={(event) => update("website", event.target.value)}
          placeholder="https://"
          ref={websiteRef}
          spellCheck={false}
          style={panelInputStyle}
          type="text"
          value={values.website}
          {...errorProps(`${id}-website-error`, websiteError)}
        />
        <FieldError id={`${id}-website-error`} message={websiteError} />
      </div>

      {editable ? (
        <div>
          <PanelLabel help={tPanel("optional")} htmlFor={`${id}-logo`}>
            {t("logo")}
          </PanelLabel>
          <ImageUploadField
            fit="contain"
            inputId={`${id}-logo`}
            label={t("logo")}
            onChange={(url) => update("logoUrl", url)}
            // Logos may live on any https host, as on the cards.
            unoptimized
            value={values.logoUrl}
          />
        </div>
      ) : (
        <div>
          <PanelQuestion id={`${id}-logo`}>{t("logo")}</PanelQuestion>
          <PartnerLogo logoUrl={values.logoUrl} name={values.name} />
        </div>
      )}

      <div>
        <PanelLabel htmlFor={`${id}-campus`}>{t("campus")}</PanelLabel>
        <div className="relative">
          <select
            className={`${PANEL_INPUT_CLASS} cursor-pointer`}
            disabled={!editable}
            id={`${id}-campus`}
            onChange={(event) => update("campusId", event.target.value)}
            style={{ ...panelInputStyle, paddingRight: 36 }}
            value={values.campusId}
          >
            {campusOptions.map((campusId) => (
              <option key={campusId} value={campusId}>
                {campusLabel(campusId)}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
            size={16}
            style={{ color: STUDIO.ink3 }}
          />
        </div>
      </div>

      <div>
        <PanelLabel help={tPanel("optional")} htmlFor={`${id}-description`}>
          {t("description")}
        </PanelLabel>
        <textarea
          className={PANEL_INPUT_CLASS}
          disabled={!editable}
          id={`${id}-description`}
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => update("descriptionNb", event.target.value)}
          rows={3}
          style={textareaStyle}
          value={values.descriptionNb}
        />
      </div>

      <div className="border-t pt-4" style={{ borderColor: STUDIO.rule }}>
        <button
          aria-controls={`${id}-english`}
          aria-expanded={englishOpen}
          className={`flex w-full items-center gap-2 rounded-md py-1 text-left font-semibold text-[13.5px] ${BOARD_FOCUS_RING}`}
          onClick={() => setEnglishOpen((current) => !current)}
          style={{ color: STUDIO.ink }}
          type="button"
        >
          <ChevronRight
            aria-hidden
            className={`shrink-0 transition-transform ${englishOpen ? "rotate-90" : ""}`}
            size={15}
            style={{ color: STUDIO.ink3 }}
          />
          {tPanel("english")}
        </button>
        <fieldset
          className="mt-4 min-w-0 border-0 p-0"
          hidden={!englishOpen}
          id={`${id}-english`}
        >
          <legend className="sr-only">{tPanel("english")}</legend>
          <PanelLabel
            help={tPanel("optional")}
            htmlFor={`${id}-description-en`}
          >
            {t("description")}
          </PanelLabel>
          <textarea
            className={PANEL_INPUT_CLASS}
            disabled={!editable}
            id={`${id}-description-en`}
            lang="en"
            maxLength={DESCRIPTION_MAX}
            onChange={(event) => update("descriptionEn", event.target.value)}
            rows={3}
            style={textareaStyle}
            value={values.descriptionEn}
          />
        </fieldset>
      </div>
    </>
  );
}

interface PartnerSheetFooterProps {
  card: PartnerCard | null;
  confirming: Confirmation | null;
  /** Unsaved edits, which ending, restarting or deleting would drop. */
  dirty: boolean;
  locale: AdminLocale;
  onChangePartnership: (action: Exclude<PendingAction, "save">) => void;
  onConfirmingChange: (confirming: Confirmation | null) => void;
  onSave: () => void;
  pending: PendingAction | null;
}

/**
 * "Lagre" stands out. An active partnership can end, an ended one start
 * again, and either can be deleted for good, set apart in red. Those three
 * wait while there are unsaved edits, which they would otherwise drop.
 */
function PartnerSheetFooter({
  card,
  confirming,
  dirty,
  locale,
  onChangePartnership,
  onConfirmingChange,
  onSave,
  pending,
}: PartnerSheetFooterProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tBoard = useTranslations("adminPortal.benefits.board");
  const hintId = useId();
  const busy = pending !== null;
  const waitsForSave = card !== null && dirty;
  const partnershipLocked = busy || waitsForSave;
  const hint = waitsForSave ? hintId : undefined;
  const spinner = (action: PendingAction) =>
    pending === action ? (
      <Loader2 aria-hidden className="animate-spin" size={14} />
    ) : null;
  const opensWith = (which: Confirmation) => (open: boolean) =>
    onConfirmingChange(open ? which : null);

  return (
    <footer
      className="shrink-0 border-t px-5 py-4 sm:px-7"
      style={{ background: STUDIO.white, borderColor: STUDIO.rule }}
    >
      {/* On a phone the right-hand buttons drop below "Slett for godt"
          rather than squeezing it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {card ? (
          <PartnerDeleteDialog
            deals={card.dealStates.map(({ deal }) => ({
              id: deal.$id,
              title: benefitTitle(deal, locale) || tBoard("untitled"),
            }))}
            name={card.partner.name}
            onConfirm={() => onChangePartnership("delete")}
            onOpenChange={opensWith("delete")}
            open={confirming === "delete"}
            pending={pending === "delete"}
          >
            <StudioButton
              aria-describedby={hint}
              className={FOOTER_BUTTON}
              disabled={partnershipLocked}
              onClick={() => onConfirmingChange("delete")}
              style={DELETE_OUTLINE}
            >
              {spinner("delete")}
              {t("deleteAction")}
            </StudioButton>
          </PartnerDeleteDialog>
        ) : null}
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {card && !card.ended ? (
            <PartnerEndDialog
              name={card.partner.name}
              onConfirm={() => onChangePartnership("end")}
              onDelete={() => onConfirmingChange("delete")}
              onOpenChange={opensWith("end")}
              open={confirming === "end"}
              pending={pending === "end"}
              visibleDeals={visibleDealCount(card)}
            >
              <StudioButton
                aria-describedby={hint}
                className={FOOTER_BUTTON}
                disabled={partnershipLocked}
                onClick={() => onConfirmingChange("end")}
              >
                {spinner("end")}
                {t("endAction")}
              </StudioButton>
            </PartnerEndDialog>
          ) : null}
          {card?.ended ? (
            <StudioButton
              aria-describedby={hint}
              className={FOOTER_BUTTON}
              disabled={partnershipLocked}
              onClick={() => onChangePartnership("restart")}
            >
              {spinner("restart")}
              {t("restartAction")}
            </StudioButton>
          ) : null}
          <StudioButton
            className={FOOTER_BUTTON}
            disabled={busy}
            onClick={onSave}
            variant="accent"
          >
            {spinner("save")}
            {t("save")}
          </StudioButton>
        </div>
      </div>
      {waitsForSave ? (
        <p
          className="mt-2 text-[12.5px] leading-5"
          id={hintId}
          style={{ color: STUDIO.ink3 }}
        >
          {t("saveFirst")}
        </p>
      ) : null}
    </footer>
  );
}
