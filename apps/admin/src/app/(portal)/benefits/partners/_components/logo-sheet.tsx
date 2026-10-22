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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { ChevronDown, Loader2, Lock, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { SiteLogo } from "../../../_actions/site-logos";
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
import { describeBenefitSaveError } from "../../_lib/benefit-save-error";
import { BOARD_FOCUS_RING } from "../../_lib/board-styles";
import { isHttpsUrl, normalizeWebsite } from "../_lib/partner-form";
import { deleteLogo, type LogoInput, saveLogo } from "./logo-actions";

/** The server's limit on a logo's name (`partners.name`). */
const NAME_MAX = 128;
const URL_MAX = 500;

const DELETE_OUTLINE = {
  background: "transparent",
  border: "1px solid #f1c9c9",
  color: PANEL_ERROR_COLOR,
} as const;

const FOOTER_BUTTON = `${BOARD_FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-70`;

type PendingAction = "remove" | "save";
type Result = { data: unknown } | { error: string };

/** What the sheet edits, as the fields hold it. */
interface LogoFormValues {
  campusId: string;
  imageUrl: string | null;
  link: string;
  name: string;
}

/** Keys under `adminPortal.benefits.errors`, shown under the field. */
type LogoFormErrors = Partial<{
  image: "logoRequired";
  link: "linkInvalid";
  name: "companyNameRequired";
}>;

/** The error a field's change clears. */
const ERROR_FIELD: Partial<Record<keyof LogoFormValues, keyof LogoFormErrors>> =
  {
    imageUrl: "image",
    link: "link",
    name: "name",
  };

function logoFormValues(
  logo: SiteLogo | null,
  campusId: string
): LogoFormValues {
  return {
    campusId: logo?.campus_id ?? campusId,
    imageUrl: logo?.image_url || null,
    link: logo?.url ?? "",
    name: logo?.name ?? "",
  };
}

function isLogoFormDirty(
  values: LogoFormValues,
  initial: LogoFormValues
): boolean {
  return (Object.keys(initial) as (keyof LogoFormValues)[]).some(
    (key) => values[key] !== initial[key]
  );
}

/**
 * The checks the server makes, so most mistakes never leave the sheet. A
 * logo without an image would leave a broken picture on the website.
 */
function validateLogoForm(values: LogoFormValues): LogoFormErrors {
  const errors: LogoFormErrors = {};
  if (!values.name.trim()) {
    errors.name = "companyNameRequired";
  }
  const link = normalizeWebsite(values.link);
  if (link && !isHttpsUrl(link)) {
    errors.link = "linkInvalid";
  }
  if (!values.imageUrl) {
    errors.image = "logoRequired";
  }
  return errors;
}

/** Every field is sent: a blank link clears what was stored. */
function toLogoInput(
  values: LogoFormValues,
  imageUrl: string,
  id: string | undefined
): LogoInput {
  return {
    campus_id: values.campusId,
    ...(id ? { id } : {}),
    image_url: imageUrl,
    name: values.name.trim(),
    url: normalizeWebsite(values.link) || null,
  };
}

export interface LogoSheetProps {
  campusLabel: (campusId: string) => string;
  /** Where a new logo starts. */
  defaultCampusId: string;
  /** Whether the viewer may change this logo, or add one. */
  editable: boolean;
  /** Campuses the viewer may put a logo on, in the page's order. */
  editableCampusIds: readonly string[];
  /** The logo being edited, or null for a new one. */
  logo: SiteLogo | null;
  onClose: () => void;
  /** Where focus goes once the sheet has closed. */
  onCloseAutoFocus: (event: Event) => void;
  open: boolean;
}

/**
 * Adds or changes a logo on the website in a panel over the wall: its
 * name, link, image and campus. From here a logo is also removed, behind a
 * plain confirmation.
 */
export function LogoSheet({
  campusLabel,
  defaultCampusId,
  editable,
  editableCampusIds,
  logo,
  onClose,
  onCloseAutoFocus,
  open,
}: LogoSheetProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tBenefits = useTranslations("adminPortal.benefits");
  const tPanel = useTranslations("adminPortal.benefits.panel");
  const router = useRouter();
  const [initial] = useState(() => logoFormValues(logo, defaultCampusId));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<LogoFormErrors>({});
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
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

  const dirty = editable && isLogoFormDirty(values, initial);
  // A logo the viewer cannot change is named, not offered for editing.
  let sheetTitle = t("logoPanelNew");
  if (logo) {
    sheetTitle = editable ? t("logoPanelEdit") : logo.name;
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

  const update = <K extends keyof LogoFormValues>(
    key: K,
    value: LogoFormValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    const field = ERROR_FIELD[key];
    if (field) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  /**
   * Runs one request; success toasts, closes and shows the fresh page. The
   * buttons stay disabled while the sheet slides away, and a closing sheet
   * sends nothing more, so a second click can't save or remove twice.
   */
  const run = async (
    action: PendingAction,
    request: () => Promise<Result>,
    messages: { failed: string; succeeded: string }
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
    setConfirmingRemove(false);
    if ("error" in result) {
      setPending(null);
      // The server's reason is English and for developers; it stays here.
      console.warn("[logos] request failed:", result.error);
      const details = describeBenefitSaveError(result.error, (key) =>
        tBenefits(key)
      );
      toast.error(
        messages.failed,
        details ? { description: details } : undefined
      );
      return;
    }
    toast.success(messages.succeeded);
    if (live.current) {
      close();
    }
    router.refresh();
  };

  const save = () => {
    const found = validateLogoForm(values);
    setErrors(found);
    if (found.name) {
      nameRef.current?.focus();
      return;
    }
    if (found.link) {
      linkRef.current?.focus();
      return;
    }
    const { imageUrl } = values;
    if (found.image || !imageUrl) {
      // The upload button, so "Last opp en logo" is one key press away.
      imageRef.current?.querySelector?.("button")?.focus();
      return;
    }
    const input = toLogoInput(values, imageUrl, logo?.id);
    run("save", () => saveLogo(input), {
      failed: t("failed"),
      succeeded: t("saved"),
    });
  };

  const remove = () => {
    if (!logo) {
      return;
    }
    run("remove", () => deleteLogo(logo.id), {
      failed: tPanel("deleteFailed"),
      succeeded: t("deletedToast"),
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
          // A new logo starts with its name.
          if (!logo) {
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
              className="mt-1 break-words font-normal text-[30px] leading-[1.1]"
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
          <LogoFields
            campusLabel={campusLabel}
            editable={editable}
            editableCampusIds={editableCampusIds}
            errors={errors}
            imageRef={imageRef}
            linkRef={linkRef}
            nameRef={nameRef}
            update={update}
            values={values}
          />
        </div>

        {editable ? (
          <footer
            className="shrink-0 border-t px-5 py-4 sm:px-7"
            style={{ background: STUDIO.white, borderColor: STUDIO.rule }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {logo ? (
                <LogoRemoveDialog
                  name={logo.name}
                  onConfirm={remove}
                  onOpenChange={(next) => {
                    // A confirmation opens and closes only while nothing runs.
                    if (!pending) {
                      setConfirmingRemove(next);
                    }
                  }}
                  open={confirmingRemove}
                  pending={pending === "remove"}
                >
                  <StudioButton
                    className={FOOTER_BUTTON}
                    disabled={pending !== null}
                    onClick={() => setConfirmingRemove(true)}
                    style={DELETE_OUTLINE}
                  >
                    {pending === "remove" ? (
                      <Loader2 aria-hidden className="animate-spin" size={14} />
                    ) : null}
                    {t("logoRemove")}
                  </StudioButton>
                </LogoRemoveDialog>
              ) : null}
              <StudioButton
                className={`ml-auto ${FOOTER_BUTTON}`}
                disabled={pending !== null}
                onClick={save}
                variant="accent"
              >
                {pending === "save" ? (
                  <Loader2 aria-hidden className="animate-spin" size={14} />
                ) : null}
                {t("save")}
              </StudioButton>
            </div>
          </footer>
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

interface LogoFieldsProps {
  campusLabel: (campusId: string) => string;
  editable: boolean;
  editableCampusIds: readonly string[];
  errors: LogoFormErrors;
  imageRef: RefObject<HTMLDivElement | null>;
  linkRef: RefObject<HTMLInputElement | null>;
  nameRef: RefObject<HTMLInputElement | null>;
  update: <K extends keyof LogoFormValues>(
    key: K,
    value: LogoFormValues[K]
  ) => void;
  values: LogoFormValues;
}

/** Name, link, the image and the campus whose wall it is on. */
function LogoFields({
  campusLabel,
  editable,
  editableCampusIds,
  errors,
  imageRef,
  linkRef,
  nameRef,
  update,
  values,
}: LogoFieldsProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tErrors = useTranslations("adminPortal.benefits.errors");
  const tPanel = useTranslations("adminPortal.benefits.panel");
  const id = useId();
  const nameError = errors.name ? tErrors(errors.name) : undefined;
  const linkError = errors.link ? tErrors(errors.link) : undefined;
  const imageError = errors.image ? tErrors(errors.image) : undefined;
  // A read-only logo keeps showing its campus, which the viewer may not be
  // able to choose.
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
        <PanelLabel help={tPanel("optional")} htmlFor={`${id}-link`}>
          {t("logoLink")}
        </PanelLabel>
        <input
          autoComplete="url"
          className={PANEL_INPUT_CLASS}
          disabled={!editable}
          id={`${id}-link`}
          inputMode="url"
          maxLength={URL_MAX}
          onChange={(event) => update("link", event.target.value)}
          placeholder="https://"
          ref={linkRef}
          spellCheck={false}
          style={panelInputStyle}
          type="text"
          value={values.link}
          {...errorProps(`${id}-link-error`, linkError)}
        />
        <FieldError id={`${id}-link-error`} message={linkError} />
      </div>

      {editable ? (
        <div ref={imageRef}>
          <PanelLabel htmlFor={`${id}-logo`}>{t("logo")}</PanelLabel>
          <ImageUploadField
            fit="contain"
            inputId={`${id}-logo`}
            label={t("logo")}
            onChange={(url) => update("imageUrl", url)}
            // Logos may live on any https host, as on the wall.
            unoptimized
            value={values.imageUrl}
          />
          {/* The upload field takes no description, so the error is read
              out as it appears. */}
          <div aria-live="polite">
            <FieldError id={`${id}-logo-error`} message={imageError} />
          </div>
        </div>
      ) : (
        <div>
          <PanelQuestion id={`${id}-logo`}>{t("logo")}</PanelQuestion>
          {values.imageUrl ? (
            <span className="relative block h-24 w-full rounded-xl border border-[#e5dcca] bg-white">
              <Image
                alt={values.name}
                className="object-contain p-3"
                fill
                src={values.imageUrl}
                unoptimized
              />
            </span>
          ) : null}
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
    </>
  );
}

interface LogoRemoveDialogProps {
  /** The button that opens it; focus returns there when it closes. */
  children: ReactElement;
  name: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}

/** A plain "are you sure" before a logo leaves the website. */
function LogoRemoveDialog({
  children,
  name,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: LogoRemoveDialogProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("logoRemoveTitle", { name })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("deleteBodyNoDeals")}
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
              // Stay open until the logo is gone.
              event.preventDefault();
              onConfirm();
            }}
            style={{ background: PANEL_ERROR_COLOR, color: "#fff" }}
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" size={14} />
            ) : null}
            {t("logoRemove")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
