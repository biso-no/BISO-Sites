"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Loader2, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactElement, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  BenefitMutationResult,
  BoardPartner,
} from "../../_actions/benefits";
import { SERIF_STACK, STUDIO, StudioButton } from "../../_components/studio";
import {
  type BenefitSaveError,
  describeBenefitSaveError,
} from "../_lib/benefit-save-error";
import {
  type AdminLocale,
  benefitTitle,
  sectionLabel,
} from "../_lib/board-display";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import {
  type PanelAction,
  type PanelValues,
  panelFooterActions,
  toBenefitFormValues,
  validatePanel,
} from "../_lib/panel-state";
import { BenefitDeleteDialog } from "./benefit-delete-dialog";
import {
  LineQuestions,
  MemberQuestions,
  type PanelErrorField,
  type PanelErrorMessages,
  type PanelFormProps,
} from "./benefit-panel-form";
import { createBenefit, deleteBenefit, updateBenefit } from "./panel-actions";
import { PANEL_ERROR_COLOR } from "./panel-fields";

type SaveAction = Exclude<PanelAction, "delete">;

const ERROR_ORDER: PanelErrorField[] = [
  "titleNb",
  "redemptionValue",
  "endDate",
];

/** Editing a field clears the error it could have caused. */
const CLEARS_ERROR: Partial<Record<keyof PanelValues, PanelErrorField>> = {
  endDate: "endDate",
  redemptionType: "redemptionValue",
  redemptionValue: "redemptionValue",
  startDate: "endDate",
  timing: "endDate",
  titleEn: "titleNb",
  titleNb: "titleNb",
};

/** Typing English by hand means the editor owns it; stop translating. */
const HAND_WRITTEN_ENGLISH: ReadonlySet<keyof PanelValues> = new Set([
  "descriptionEn",
  "titleEn",
]);

const SAVED_MESSAGE: Record<SaveAction, "hidden" | "published" | "saved"> = {
  hide: "hidden",
  publish: "published",
  saveChanges: "saved",
  saveDraft: "saved",
};

const DELETE_OUTLINE = {
  background: "transparent",
  border: "1px solid #f1c9c9",
  color: PANEL_ERROR_COLOR,
} as const;

export interface BenefitPanelProps {
  /** The benefit being edited, or null for a new one. */
  benefitId: string | null;
  /** Where closing, saving and deleting return to. */
  boardHref: string;
  /** The campus the benefit belongs to, as the eyebrow names it. */
  campusLabel: string;
  editable: boolean;
  initial: PanelValues;
  locale: AdminLocale;
  /** Partners the picker offers: the benefit's campus plus Hele BISO. */
  partners: BoardPartner[];
}

/**
 * The benefit editor: a panel that slides in over the board. It asks only
 * what the section needs, shows the website card as it is filled in, and
 * its buttons say exactly what happens to the live state.
 */
export function BenefitPanel({
  benefitId,
  boardHref,
  campusLabel,
  editable,
  initial,
  locale,
  partners: initialPartners,
}: BenefitPanelProps) {
  const t = useTranslations("adminPortal.benefits.panel");
  const tErrors = useTranslations("adminPortal.benefits.errors");
  const tBoard = useTranslations("adminPortal.benefits.board");
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<
    Partial<Record<PanelErrorField, string>>
  >({});
  const [pending, setPending] = useState<PanelAction | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [partners, setPartners] = useState(initialPartners);
  // Translate on save while there is no English yet.
  const [autoTranslate, setAutoTranslate] = useState(
    () => !(initial.titleEn.trim() || initial.descriptionEn.trim())
  );
  const fields = useRef<Partial<Record<PanelErrorField, HTMLElement | null>>>(
    {}
  );

  const isNew = benefitId === null;
  const readOnly = !editable;
  const title = benefitTitle(
    { title_en: values.titleEn, title_nb: values.titleNb },
    locale
  );

  const backToBoard = (refresh: boolean) => {
    setOpen(false);
    router.push(boardHref, { scroll: false });
    if (refresh) {
      router.refresh();
    }
  };

  const update: PanelFormProps["update"] = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    const cleared = CLEARS_ERROR[key];
    if (cleared) {
      setErrors((current) => ({ ...current, [cleared]: undefined }));
    }
    if (HAND_WRITTEN_ENGLISH.has(key)) {
      setAutoTranslate(false);
    }
  };

  const errorDetails = (error: BenefitSaveError) =>
    describeBenefitSaveError(error, {
      category: t("category"),
      description_en: `${t("english")}: ${t("more")}`,
      description_nb: t("more"),
      image_url: t("image"),
      partner_id: t("partner"),
      publish_end: t("to"),
      publish_start: t("from"),
      redemption_value:
        values.redemptionType === "link" ? t("linkLabel") : t("codeLabel"),
      terms_en: `${t("english")}: ${t("terms")}`,
      terms_nb: t("terms"),
      title_en: `${t("english")}: ${t("offer")}`,
      title_nb: t("offer"),
    });

  const save = async (action: SaveAction) => {
    if (pending) {
      return;
    }
    const found = validatePanel(values, action);
    const messages: PanelErrorMessages = {};
    for (const field of ERROR_ORDER) {
      const key = found[field];
      if (key) {
        messages[field] = tErrors(key);
      }
    }
    setErrors(messages);
    const firstInvalid = ERROR_ORDER.find((field) => messages[field]);
    if (firstInvalid) {
      fields.current[firstInvalid]?.focus();
      return;
    }

    setPending(action);
    const form = toBenefitFormValues(values, action);
    const translation = {
      enabled: autoTranslate && action !== "hide",
      sourceLocale: "no" as const,
    };
    let result: BenefitMutationResult;
    try {
      result =
        benefitId === null
          ? await createBenefit(form, translation)
          : await updateBenefit(benefitId, form, translation);
    } catch {
      result = { error: "" };
    }
    if ("error" in result) {
      setPending(null);
      const details = errorDetails(result.error);
      toast.error(
        t("saveFailed"),
        details ? { description: details } : undefined
      );
      return;
    }
    toast.success(t(SAVED_MESSAGE[action]));
    backToBoard(true);
  };

  const remove = async () => {
    if (benefitId === null || pending) {
      return;
    }
    setPending("delete");
    let result: { data: string } | { error: string };
    try {
      result = await deleteBenefit(benefitId);
    } catch {
      result = { error: "" };
    }
    setConfirmingDelete(false);
    if ("error" in result) {
      setPending(null);
      toast.error(
        t("deleteFailed"),
        result.error ? { description: result.error } : undefined
      );
      return;
    }
    toast.success(t("deleted"));
    backToBoard(true);
  };

  const formProps: PanelFormProps = {
    autoTranslate,
    disabled: readOnly,
    errors,
    fieldRef: (field) => (element) => {
      fields.current[field] = element;
    },
    locale,
    onAutoTranslateChange: setAutoTranslate,
    onPartnerCreated: (partner) => {
      setPartners((current) => [...current, partner]);
      update("partnerId", partner.id);
    },
    partners,
    update,
    values,
  };

  return (
    <Sheet
      onOpenChange={(next) => {
        if (!next) {
          backToBoard(false);
        }
      }}
      open={open}
    >
      <SheetContent
        className="flex w-full flex-col gap-0 border-[#e5dcca] bg-[#fffdf8] p-0 shadow-[-8px_0_24px_rgba(26,24,20,0.08)] sm:max-w-[560px]"
        onOpenAutoFocus={(event) => {
          // A new benefit starts with its first question.
          if (isNew && editable) {
            event.preventDefault();
            fields.current.titleNb?.focus();
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
              {campusLabel} · {sectionLabel(values.section, locale)}
            </SheetDescription>
            <SheetTitle
              className="mt-1 font-normal text-[30px] leading-[1.1]"
              style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
            >
              {isNew ? t("newTitle") : t("editTitle")}
            </SheetTitle>
          </div>
          <button
            aria-label={t("close")}
            className={`-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-[#f3eee5] ${BOARD_FOCUS_RING}`}
            onClick={() => backToBoard(false)}
            style={{ color: STUDIO.ink3 }}
            type="button"
          >
            <X aria-hidden size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {readOnly ? (
            <p
              className="mb-7 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6"
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
          ) : null}
          {values.section === "member" ? (
            <MemberQuestions {...formProps} />
          ) : (
            <LineQuestions {...formProps} />
          )}
        </div>

        {readOnly ? null : (
          <PanelFooter
            actions={panelFooterActions(initial.status, isNew)}
            isDraft={initial.status === "draft"}
            onAction={(action) => {
              if (action === "delete") {
                setConfirmingDelete(true);
              } else {
                save(action);
              }
            }}
            pending={pending}
            renderDelete={(trigger) => (
              <BenefitDeleteDialog
                onConfirm={remove}
                onOpenChange={(next) => {
                  if (!pending) {
                    setConfirmingDelete(next);
                  }
                }}
                open={confirmingDelete}
                pending={pending === "delete"}
                title={title || tBoard("untitled")}
              >
                {trigger}
              </BenefitDeleteDialog>
            )}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** The one action that changes what students see, styled to stand out. */
function primaryOf(actions: PanelAction[]): PanelAction | undefined {
  return actions.find(
    (action) => action === "publish" || action === "saveChanges"
  );
}

function PanelFooter({
  actions,
  isDraft,
  onAction,
  pending,
  renderDelete,
}: {
  actions: PanelAction[];
  isDraft: boolean;
  onAction: (action: PanelAction) => void;
  pending: PanelAction | null;
  /** Wraps the delete button in its confirmation, which it opens. */
  renderDelete: (trigger: ReactElement) => ReactNode;
}) {
  const t = useTranslations("adminPortal.benefits.panel");
  const primary = primaryOf(actions);
  const secondary = actions.filter(
    (action) => action !== primary && action !== "delete"
  );
  const canDelete = actions.includes("delete");
  const note = isDraft ? (
    <p className="text-[12.5px] leading-5" style={{ color: STUDIO.ink3 }}>
      {t("draftNote")}
    </p>
  ) : null;

  const button = (action: PanelAction) => (
    <StudioButton
      className={`${BOARD_FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-70`}
      disabled={pending !== null}
      key={action}
      onClick={() => onAction(action)}
      variant={action === primary ? "accent" : "secondary"}
      // Replaces the variant's look only for the red outline.
      {...(action === "delete" ? { style: DELETE_OUTLINE } : {})}
    >
      {pending === action ? (
        <Loader2 aria-hidden className="animate-spin" size={14} />
      ) : null}
      {t(action)}
    </StudioButton>
  );

  return (
    <footer
      className="shrink-0 border-t px-5 py-4 sm:px-7"
      style={{ background: STUDIO.white, borderColor: STUDIO.rule }}
    >
      {canDelete && note ? <div className="mb-3">{note}</div> : null}
      {/* On a phone the right-hand buttons drop below "Slett" rather than
          squeezing it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canDelete ? (
          <div className="shrink-0">{renderDelete(button("delete"))}</div>
        ) : (
          <div className="min-w-[12rem] flex-1">{note}</div>
        )}
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {secondary.map(button)}
          {primary ? button(primary) : null}
        </div>
      </div>
    </footer>
  );
}
