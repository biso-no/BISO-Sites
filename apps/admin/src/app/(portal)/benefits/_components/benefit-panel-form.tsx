import {
  BENEFIT_CATEGORIES,
  BENEFIT_CATEGORY_LABELS,
  type BenefitCategoryKey,
} from "@repo/shared/utils/benefit-catalog";
import { Switch } from "@repo/ui/components/ui/switch";
import { ChevronDown, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { AutoTranslateControl } from "@/app/_components/content-translation-controls";
import type { BoardPartner } from "../../_actions/benefits";
import { ImageUploadField } from "../../_components/image-upload-field";
import { STUDIO } from "../../_components/studio";
import { type AdminLocale, labelLocale } from "../_lib/board-display";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import type { PanelValues } from "../_lib/panel-state";
import { BenefitPreview } from "./benefit-preview";
import {
  ChoiceGroup,
  errorProps,
  FieldError,
  PANEL_INPUT_CLASS,
  PanelLabel,
  PanelQuestion,
  panelInputStyle,
} from "./panel-fields";
import { PartnerPicker } from "./partner-picker";

/** The fields `validatePanel` can flag, in the order they appear. */
export type PanelErrorField = "titleNb" | "redemptionValue" | "endDate";
export type PanelErrorMessages = Partial<Record<PanelErrorField, string>>;

const TITLE_MAX = 200;
const TEXT_MAX = 2000;

export interface PanelFormProps {
  autoTranslate: boolean;
  disabled: boolean;
  errors: PanelErrorMessages;
  /** Ref for each field that can carry an error, so it can take focus. */
  fieldRef: (field: PanelErrorField) => (element: HTMLElement | null) => void;
  locale: AdminLocale;
  onAutoTranslateChange: (enabled: boolean) => void;
  onPartnerCreated: (partner: BoardPartner) => void;
  partners: BoardPartner[];
  update: <K extends keyof PanelValues>(key: K, value: PanelValues[K]) => void;
  values: PanelValues;
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="mt-7 first:mt-0">{children}</div>;
}

const textareaStyle = {
  ...panelInputStyle,
  lineHeight: 1.5,
  resize: "vertical",
} as const;

/** Medlemsfordeler: the full set of questions, rare ones under "Flere valg". */
export function MemberQuestions(props: PanelFormProps) {
  const { disabled, errors, fieldRef, partners, update, values } = props;
  const t = useTranslations("adminPortal.benefits.panel");
  const id = useId();
  const partner =
    partners.find((candidate) => candidate.id === values.partnerId) ?? null;
  const usesValue =
    values.redemptionType === "code" || values.redemptionType === "link";

  return (
    <>
      <Field>
        <BenefitPreview partner={partner} values={values} />
      </Field>

      <Field>
        <PanelLabel htmlFor={`${id}-title`}>{t("offer")}</PanelLabel>
        <input
          className={PANEL_INPUT_CLASS}
          disabled={disabled}
          id={`${id}-title`}
          maxLength={TITLE_MAX}
          onChange={(event) => update("titleNb", event.target.value)}
          ref={fieldRef("titleNb")}
          style={panelInputStyle}
          type="text"
          value={values.titleNb}
          {...errorProps(`${id}-title-error`, errors.titleNb)}
        />
        <FieldError id={`${id}-title-error`} message={errors.titleNb} />
      </Field>

      <Field>
        <PanelLabel help={t("optional")} htmlFor={`${id}-more`}>
          {t("more")}
        </PanelLabel>
        <textarea
          className={PANEL_INPUT_CLASS}
          disabled={disabled}
          id={`${id}-more`}
          maxLength={TEXT_MAX}
          onChange={(event) => update("descriptionNb", event.target.value)}
          rows={3}
          style={textareaStyle}
          value={values.descriptionNb}
        />
      </Field>

      <Field>
        <PanelQuestion id={`${id}-partner`}>{t("partner")}</PanelQuestion>
        <PartnerPicker
          campusId={values.campusId}
          disabled={disabled}
          labelledBy={`${id}-partner`}
          onChange={(partnerId) => update("partnerId", partnerId)}
          onCreated={props.onPartnerCreated}
          partners={partners}
          value={values.partnerId}
        />
      </Field>

      <Field>
        <ChoiceGroup
          choices={[
            { label: t("redeemOnsite"), value: "onsite" },
            { label: t("redeemCode"), value: "code" },
            { label: t("redeemLink"), value: "link" },
            { label: t("redeemNone"), value: "none" },
          ]}
          disabled={disabled}
          legend={t("redeem")}
          onChange={(type) => update("redemptionType", type)}
          value={values.redemptionType}
        />
        {/* A read-only viewer never gets the code, so there is nothing to show. */}
        {usesValue && !disabled ? (
          <div className="mt-4">
            <PanelLabel help={t("membersOnly")} htmlFor={`${id}-value`}>
              {values.redemptionType === "code"
                ? t("codeLabel")
                : t("linkLabel")}
            </PanelLabel>
            <input
              autoComplete="off"
              className={PANEL_INPUT_CLASS}
              id={`${id}-value`}
              inputMode={values.redemptionType === "link" ? "url" : "text"}
              onChange={(event) =>
                update("redemptionValue", event.target.value)
              }
              placeholder={
                values.redemptionType === "link" ? "https://" : undefined
              }
              ref={fieldRef("redemptionValue")}
              spellCheck={false}
              style={
                values.redemptionType === "code"
                  ? {
                      ...panelInputStyle,
                      fontFamily: "ui-monospace, Menlo, monospace",
                    }
                  : panelInputStyle
              }
              type={values.redemptionType === "link" ? "url" : "text"}
              value={values.redemptionValue}
              {...errorProps(`${id}-value-error`, errors.redemptionValue)}
            />
            <FieldError
              id={`${id}-value-error`}
              message={errors.redemptionValue}
            />
          </div>
        ) : null}
      </Field>

      <Field>
        <TimingQuestion {...props} />
      </Field>

      <MoreOptions {...props} />
    </>
  );
}

/** Karriere, Sosialt, Trygghet, For bedrifter: one line on the website. */
export function LineQuestions(props: PanelFormProps) {
  const { disabled, errors, fieldRef, update, values } = props;
  const t = useTranslations("adminPortal.benefits.panel");
  const id = useId();

  return (
    <>
      <Field>
        <PanelLabel htmlFor={`${id}-title`}>
          {values.section === "business"
            ? t("lineQuestionBusiness")
            : t("lineQuestion")}
        </PanelLabel>
        <input
          className={PANEL_INPUT_CLASS}
          disabled={disabled}
          id={`${id}-title`}
          maxLength={TITLE_MAX}
          onChange={(event) => update("titleNb", event.target.value)}
          ref={fieldRef("titleNb")}
          style={panelInputStyle}
          type="text"
          value={values.titleNb}
          {...errorProps(`${id}-title-error`, errors.titleNb)}
        />
        <FieldError id={`${id}-title-error`} message={errors.titleNb} />
      </Field>

      <Field>
        <PanelLabel htmlFor={`${id}-title-en`}>{t("english")}</PanelLabel>
        <input
          className={PANEL_INPUT_CLASS}
          disabled={disabled}
          id={`${id}-title-en`}
          lang="en"
          maxLength={TITLE_MAX}
          onChange={(event) => update("titleEn", event.target.value)}
          style={panelInputStyle}
          type="text"
          value={values.titleEn}
        />
        <AutoTranslate {...props} />
      </Field>

      <Field>
        <TimingQuestion {...props} />
      </Field>
    </>
  );
}

function AutoTranslate({
  autoTranslate,
  disabled,
  onAutoTranslateChange,
}: PanelFormProps) {
  const t = useTranslations("adminPortal.benefits.panel");
  if (disabled) {
    return null;
  }
  return (
    <AutoTranslateControl
      checked={autoTranslate}
      className="mt-3 justify-between bg-white"
      description={t("autoTranslateHelp")}
      label={t("autoTranslate")}
      onCheckedChange={onAutoTranslateChange}
      operation="save"
      sourceLocale="no"
    />
  );
}

function TimingQuestion({
  disabled,
  errors,
  fieldRef,
  update,
  values,
}: PanelFormProps) {
  const t = useTranslations("adminPortal.benefits.panel");
  const id = useId();
  return (
    <>
      <ChoiceGroup
        choices={[
          { label: t("timingAlways"), value: "always" },
          { label: t("timingRange"), value: "range" },
        ]}
        disabled={disabled}
        legend={t("timing")}
        onChange={(timing) => update("timing", timing)}
        value={values.timing}
      />
      {values.timing === "range" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <PanelLabel htmlFor={`${id}-from`}>{t("from")}</PanelLabel>
            <input
              className={PANEL_INPUT_CLASS}
              disabled={disabled}
              id={`${id}-from`}
              onChange={(event) => update("startDate", event.target.value)}
              style={panelInputStyle}
              type="date"
              value={values.startDate}
            />
          </div>
          <div>
            <PanelLabel htmlFor={`${id}-to`}>{t("to")}</PanelLabel>
            <input
              className={PANEL_INPUT_CLASS}
              disabled={disabled}
              id={`${id}-to`}
              min={values.startDate || undefined}
              onChange={(event) => update("endDate", event.target.value)}
              ref={fieldRef("endDate")}
              style={panelInputStyle}
              type="date"
              value={values.endDate}
              {...errorProps(`${id}-to-error`, errors.endDate)}
            />
            <FieldError id={`${id}-to-error`} message={errors.endDate} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function categoryLabelFor(key: BenefitCategoryKey, locale: AdminLocale) {
  return BENEFIT_CATEGORY_LABELS[key][labelLocale(locale)];
}

/** The rarely used settings, folded away until someone asks for them. */
function MoreOptions(props: PanelFormProps) {
  const { disabled, locale, update, values } = props;
  const t = useTranslations("adminPortal.benefits.panel");
  const id = useId();
  const [open, setOpen] = useState(false);
  const contents = [
    t("terms"),
    t("image"),
    t("category"),
    t("featured"),
    t("english"),
  ].join(", ");

  return (
    <div className="mt-8 border-t pt-4" style={{ borderColor: STUDIO.rule }}>
      <button
        aria-controls={`${id}-region`}
        aria-expanded={open}
        className={`flex w-full items-baseline gap-2 rounded-md py-1 text-left ${BOARD_FOCUS_RING}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <ChevronRight
          aria-hidden
          className={`shrink-0 self-center transition-transform ${open ? "rotate-90" : ""}`}
          size={15}
          style={{ color: STUDIO.ink3 }}
        />
        <span
          className="shrink-0 font-semibold text-[13.5px]"
          style={{ color: STUDIO.ink }}
        >
          {t("moreOptions")}
        </span>
        <span
          className="min-w-0 truncate text-[12.5px]"
          style={{ color: STUDIO.ink3 }}
        >
          {locale === "no" ? contents.toLocaleLowerCase("nb") : contents}
        </span>
      </button>

      <div className="mt-5" hidden={!open} id={`${id}-region`}>
        <Field>
          <PanelLabel htmlFor={`${id}-category`}>{t("category")}</PanelLabel>
          <div className="relative">
            <select
              className={`${PANEL_INPUT_CLASS} cursor-pointer`}
              disabled={disabled}
              id={`${id}-category`}
              onChange={(event) =>
                update("category", event.target.value || null)
              }
              style={{ ...panelInputStyle, paddingRight: 36 }}
              value={values.category ?? ""}
            >
              <option value="">—</option>
              {BENEFIT_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {categoryLabelFor(key, locale)}
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
        </Field>

        <Field>
          <PanelLabel help={t("optional")} htmlFor={`${id}-terms`}>
            {t("terms")}
          </PanelLabel>
          <textarea
            className={PANEL_INPUT_CLASS}
            disabled={disabled}
            id={`${id}-terms`}
            maxLength={TEXT_MAX}
            onChange={(event) => update("termsNb", event.target.value)}
            rows={2}
            style={textareaStyle}
            value={values.termsNb}
          />
        </Field>

        <Field>
          <PanelLabel help={t("optional")} htmlFor={`${id}-image`}>
            {t("image")}
          </PanelLabel>
          {disabled ? (
            <ReadOnlyImage url={values.imageUrl} />
          ) : (
            <ImageUploadField
              inputId={`${id}-image`}
              label={t("image")}
              onChange={(url) => update("imageUrl", url ?? "")}
              value={values.imageUrl || null}
            />
          )}
        </Field>

        <Field>
          <div className="flex items-start justify-between gap-4">
            <div>
              <PanelLabel htmlFor={`${id}-featured`}>
                {t("featured")}
              </PanelLabel>
              <p
                className="-mt-1 text-[12.5px] leading-5"
                id={`${id}-featured-help`}
                style={{ color: STUDIO.ink3 }}
              >
                {t("featuredHelp")}
              </p>
            </div>
            <Switch
              aria-describedby={`${id}-featured-help`}
              checked={values.isFeatured}
              className="mt-0.5 shrink-0"
              disabled={disabled}
              id={`${id}-featured`}
              onCheckedChange={(checked) => update("isFeatured", checked)}
            />
          </div>
        </Field>

        <Field>
          <EnglishText {...props} />
        </Field>
      </div>
    </div>
  );
}

function ReadOnlyImage({ url }: { url: string }) {
  if (!url) {
    return (
      <p className="text-sm" style={{ color: STUDIO.ink3 }}>
        —
      </p>
    );
  }
  return (
    <Image
      alt=""
      className="h-32 w-auto rounded-lg border object-cover"
      height={128}
      src={url}
      style={{ borderColor: STUDIO.rule }}
      unoptimized
      width={192}
    />
  );
}

function EnglishText(props: PanelFormProps) {
  const { disabled, update, values } = props;
  const t = useTranslations("adminPortal.benefits.panel");
  const id = useId();
  return (
    <fieldset
      className="min-w-0 rounded-xl border px-4 pt-2 pb-4"
      style={{ borderColor: STUDIO.rule }}
    >
      <legend
        className="px-1 font-semibold text-[13.5px]"
        style={{ color: STUDIO.ink }}
      >
        {t("english")}
      </legend>
      <AutoTranslate {...props} />
      <div className="mt-4">
        <PanelLabel htmlFor={`${id}-title`}>{t("offer")}</PanelLabel>
        <input
          className={PANEL_INPUT_CLASS}
          disabled={disabled}
          id={`${id}-title`}
          lang="en"
          maxLength={TITLE_MAX}
          onChange={(event) => update("titleEn", event.target.value)}
          style={panelInputStyle}
          type="text"
          value={values.titleEn}
        />
      </div>
      <div className="mt-4">
        <PanelLabel help={t("optional")} htmlFor={`${id}-more`}>
          {t("more")}
        </PanelLabel>
        <textarea
          className={PANEL_INPUT_CLASS}
          disabled={disabled}
          id={`${id}-more`}
          lang="en"
          maxLength={TEXT_MAX}
          onChange={(event) => update("descriptionEn", event.target.value)}
          rows={3}
          style={textareaStyle}
          value={values.descriptionEn}
        />
      </div>
      <div className="mt-4">
        <PanelLabel help={t("optional")} htmlFor={`${id}-terms`}>
          {t("terms")}
        </PanelLabel>
        <textarea
          className={PANEL_INPUT_CLASS}
          disabled={disabled}
          id={`${id}-terms`}
          lang="en"
          maxLength={TEXT_MAX}
          onChange={(event) => update("termsEn", event.target.value)}
          rows={2}
          style={textareaStyle}
          value={values.termsEn}
        />
      </div>
    </fieldset>
  );
}
