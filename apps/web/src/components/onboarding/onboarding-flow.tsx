"use client";

import type { MembershipTextItem } from "@repo/shared/utils/membership-texts";
import { cn } from "@repo/ui/lib/utils";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  GraduationCap,
  Loader2,
  Receipt,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import { updateProfile } from "@/lib/actions/user";
import { clearBrowserAppwriteSession } from "@/lib/bi-sign-in-client";
import { switchToBiSignIn } from "@/lib/server";

// ---------- Types ----------

type StepId = "persona" | "student" | "personal" | "banking" | "done";

interface PersonaState {
  isFinancial: boolean;
  isStudent: boolean;
  isVolunteer: boolean;
}

interface PersonalInfo {
  address: string;
  city: string;
  name: string;
  phone: string;
  zip: string;
}

interface BankingInfo {
  bank_account: string;
  mode: "norwegian" | "international";
  swift: string;
}

interface OnboardingState {
  bankingInfo: BankingInfo;
  biLinked: boolean;
  persona: PersonaState;
  personalInfo: PersonalInfo;
}

const STORAGE_KEY = "biso_onboarding_state";

const DEFAULT_STATE: OnboardingState = {
  persona: { isStudent: false, isVolunteer: false, isFinancial: false },
  personalInfo: { name: "", phone: "", address: "", city: "", zip: "" },
  bankingInfo: { mode: "norwegian", bank_account: "", swift: "" },
  biLinked: false,
};

function buildSteps(persona: PersonaState, biLinked: boolean): StepId[] {
  const steps: StepId[] = ["persona"];
  if (persona.isStudent && !biLinked) {
    steps.push("student");
  }
  steps.push("personal");
  if (persona.isFinancial) {
    steps.push("banking");
  }
  steps.push("done");
  return steps;
}

// ---------- Styles ----------

const inputBase =
  "type-body w-full rounded-biso-md border bg-surface px-4 py-3 text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2";

const quietButton =
  "type-body-sm inline-flex items-center justify-center gap-1.5 rounded-biso-pill px-4 py-2.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2";

const headingClass = "type-display-sm break-words text-ink";

// ---------- Sub-components ----------

const slideVariants = {
  center: { opacity: 1, x: 0 },
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  exit: (dir: number) => ({ opacity: 0, x: dir < 0 ? 48 : -48 }),
};

/** Progress, drawn as dots and said in words for screen readers. */
function StepDots({
  currentIdx,
  label,
  steps,
}: {
  currentIdx: number;
  label: string;
  steps: StepId[];
}) {
  return (
    <div className="mb-8">
      <p className="sr-only">{label}</p>
      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-1.5"
      >
        {steps.map((step, idx) => {
          let dotClass = "w-2 bg-edge";
          if (idx === currentIdx) {
            dotClass = "w-6 bg-action";
          } else if (idx < currentIdx) {
            dotClass = "w-2 bg-action/40";
          }
          return (
            <div
              className={`h-2 rounded-biso-pill transition-all duration-300 ${dotClass}`}
              key={step}
            />
          );
        })}
      </div>
    </div>
  );
}

function PersonaCard({
  description,
  icon: Icon,
  label,
  onToggle,
  selected,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-biso-md border-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2",
        selected
          ? "border-action bg-action/5"
          : "border-edge bg-surface hover:border-ink-muted"
      )}
      onClick={onToggle}
      type="button"
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-ink-accent"
      />
      <span className="min-w-0 flex-1">
        <span className="type-body-sm block font-semibold text-ink">
          {label}
        </span>
        <span className="type-body-sm mt-0.5 block text-ink-muted">
          {description}
        </span>
      </span>
      {selected ? (
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-biso-pill bg-action text-action-ink"
        >
          <Check className="size-3" />
        </span>
      ) : null}
    </button>
  );
}

function FormField({
  error,
  hint,
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div>
      <label
        className="type-body-sm mb-1.5 block font-semibold text-ink"
        htmlFor={id}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        ) : null}
      </label>
      <input
        aria-describedby={message ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        className={cn(inputBase, error ? "border-danger" : "border-edge")}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {message ? (
        <p
          className={cn(
            "type-body-sm mt-1.5",
            error ? "text-danger" : "text-ink-muted"
          )}
          id={messageId}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

// ---------- Main component ----------

export function OnboardingFlow({
  initialName,
  items,
  linkedBi,
}: {
  initialName: string;
  /** Saved text from admin; null or missing keeps the built-in i18n text. */
  items?: MembershipTextItem[] | null;
  required: boolean;
  linkedBi: boolean;
}) {
  const [state, setState] = useState<OnboardingState>({
    ...DEFAULT_STATE,
    biLinked: linkedBi,
    personalInfo: { ...DEFAULT_STATE.personalInfo, name: initialName },
  });

  const t = useTranslations("onboarding");

  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load persisted state after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return;
      }
      const parsed = JSON.parse(saved) as Partial<OnboardingState>;

      setState({
        ...DEFAULT_STATE,
        ...parsed,
        biLinked: linkedBi || (parsed.biLinked ?? false),
        personalInfo: {
          ...DEFAULT_STATE.personalInfo,
          ...parsed.personalInfo,
          name: initialName || parsed.personalInfo?.name || "",
        },
      });
    } catch {
      // ignore parse errors
    }
  }, [linkedBi, initialName]);

  // Persist state on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private window, blocked site data); the
      // draft then lasts for this page only.
    }
  }, [state]);

  const steps = buildSteps(state.persona, state.biLinked);
  const currentStep = steps[stepIdx];
  const isLastFormStep = stepIdx === steps.length - 2;

  const validatePersonal = (errs: Record<string, string>) => {
    if (!state.personalInfo.name.trim()) {
      errs.name = t("errors.nameRequired");
    }
    if (!state.personalInfo.phone.trim()) {
      errs.phone = t("errors.phoneRequired");
    }
    if (state.persona.isFinancial) {
      if (!state.personalInfo.address.trim()) {
        errs.address = t("errors.addressRequired");
      }
      if (!state.personalInfo.city.trim()) {
        errs.city = t("errors.cityRequired");
      }
      if (!state.personalInfo.zip.trim()) {
        errs.zip = t("errors.zipRequired");
      }
    }
  };

  const validateBanking = (errs: Record<string, string>) => {
    if (!state.bankingInfo.bank_account.trim()) {
      errs.bank_account = t("errors.bankAccountRequired");
    }
    if (
      state.bankingInfo.mode === "international" &&
      !state.bankingInfo.swift.trim()
    ) {
      errs.swift = t("errors.swiftRequired");
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (currentStep === "personal") {
      validatePersonal(errs);
    }
    if (currentStep === "banking") {
      validateBanking(errs);
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = async () => {
    if (!validate()) {
      return;
    }

    if (isLastFormStep) {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await updateProfile({
          name: state.personalInfo.name.trim(),
          phone: state.personalInfo.phone.trim() || undefined,
          address: state.personalInfo.address.trim() || undefined,
          city: state.personalInfo.city.trim() || undefined,
          zip: state.personalInfo.zip.trim() || undefined,
          bank_account: state.bankingInfo.bank_account.trim() || undefined,
          swift: state.bankingInfo.swift.trim() || undefined,
        });
        if (!result) {
          setSubmitError(t("errors.saveFailed"));
          return;
        }
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing stored to clear.
        }
        setDirection(1);
        setStepIdx(steps.length - 1);
      } catch {
        setSubmitError(t("errors.unknown"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setDirection(1);
    setErrors({});
    setStepIdx((i) => i + 1);
  };

  const goBack = () => {
    if (stepIdx === 0) {
      return;
    }
    setDirection(-1);
    setErrors({});
    setStepIdx((i) => i - 1);
  };

  // This account was created with a private email. There is no linking any
  // more: the student signs out of it and in with BI, and comes back here as
  // that account. The saved draft in localStorage survives the switch.
  const [switching, startSwitch] = useTransition();
  const switchToBi = () => {
    startSwitch(async () => {
      try {
        await clearBrowserAppwriteSession();
        await switchToBiSignIn("/onboarding");
      } catch {
        setSubmitError(t("errors.unknown"));
      }
    });
  };

  const skipStudent = () => {
    setDirection(1);
    setErrors({});
    setStepIdx((i) => i + 1);
  };

  // ---------- Step renderers ----------

  const renderPersona = () => (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={headingClass}>{t("persona.title")}</h1>
        <p className="type-body-sm mt-2 text-ink-muted">
          {t("persona.description")}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <PersonaCard
          description={t("persona.student.description")}
          icon={GraduationCap}
          label={t("persona.student.label")}
          onToggle={() =>
            setState((prev) => ({
              ...prev,
              persona: { ...prev.persona, isStudent: !prev.persona.isStudent },
            }))
          }
          selected={state.persona.isStudent}
        />
        <PersonaCard
          description={t("persona.volunteer.description")}
          icon={Users}
          label={t("persona.volunteer.label")}
          onToggle={() =>
            setState((prev) => ({
              ...prev,
              persona: {
                ...prev.persona,
                isVolunteer: !prev.persona.isVolunteer,
              },
            }))
          }
          selected={state.persona.isVolunteer}
        />
        <PersonaCard
          description={t("persona.financial.description")}
          icon={Receipt}
          label={t("persona.financial.label")}
          onToggle={() =>
            setState((prev) => ({
              ...prev,
              persona: {
                ...prev.persona,
                isFinancial: !prev.persona.isFinancial,
              },
            }))
          }
          selected={state.persona.isFinancial}
        />
      </div>

      <p className="type-body-sm text-ink-muted">{t("persona.hint")}</p>
    </div>
  );

  const renderStudent = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className={headingClass}>{t("student.title")}</h1>
        <p className="type-body-sm mt-2 text-ink-muted">
          {t("student.description")}
        </p>
      </div>

      <div className="rounded-biso-md border border-edge bg-surface-sunken p-5">
        <p className="type-body-sm mb-3 flex items-center gap-2 font-semibold text-ink">
          <BadgeCheck
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-accent"
          />
          {t("student.benefits.title")}
        </p>
        <ul className="type-body-sm flex flex-col gap-2 text-ink-muted">
          {(items?.length
            ? items.map((item) => item.title)
            : [
                t("student.benefits.membership"),
                t("student.benefits.events"),
                t("student.benefits.sso"),
              ]
          ).map((benefit, index) => (
            <li className="flex items-start gap-2" key={`${index}-${benefit}`}>
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-ink-accent"
              />
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <button
          aria-busy={switching}
          className={cn(
            statusPanelPrimaryAction,
            "w-full justify-center disabled:opacity-60"
          )}
          disabled={switching}
          onClick={switchToBi}
          type="button"
        >
          {t("student.linkButton")}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </button>
        <button
          className={cn(quietButton, "w-full")}
          onClick={skipStudent}
          type="button"
        >
          {t("student.skip")}
        </button>
      </div>
    </div>
  );

  const renderPersonal = () => (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={headingClass}>{t("personal.title")}</h1>
        <p className="type-body-sm mt-2 text-ink-muted">
          {state.persona.isFinancial
            ? t("personal.descriptionFinancial")
            : t("personal.description")}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <FormField
          error={errors.name}
          label={t("personal.fields.name")}
          onChange={(v) =>
            setState((prev) => ({
              ...prev,
              personalInfo: { ...prev.personalInfo, name: v },
            }))
          }
          placeholder={t("personal.fields.namePlaceholder")}
          required
          value={state.personalInfo.name}
        />
        <FormField
          error={errors.phone}
          label={t("personal.fields.phone")}
          onChange={(v) =>
            setState((prev) => ({
              ...prev,
              personalInfo: { ...prev.personalInfo, phone: v },
            }))
          }
          placeholder={t("personal.fields.phonePlaceholder")}
          required
          type="tel"
          value={state.personalInfo.phone}
        />

        <fieldset className="flex flex-col gap-3 pt-1">
          <legend className="type-body-sm mb-3 font-semibold text-ink">
            {t("personal.address.title")}{" "}
            {state.persona.isFinancial ? null : (
              <span className="font-normal text-ink-muted">
                {t("personal.address.optional")}
              </span>
            )}
          </legend>
          <FormField
            error={errors.address}
            label={t("personal.fields.street")}
            onChange={(v) =>
              setState((prev) => ({
                ...prev,
                personalInfo: { ...prev.personalInfo, address: v },
              }))
            }
            placeholder={t("personal.fields.streetPlaceholder")}
            required={state.persona.isFinancial}
            value={state.personalInfo.address}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              error={errors.city}
              label={t("personal.fields.city")}
              onChange={(v) =>
                setState((prev) => ({
                  ...prev,
                  personalInfo: { ...prev.personalInfo, city: v },
                }))
              }
              placeholder={t("personal.fields.cityPlaceholder")}
              required={state.persona.isFinancial}
              value={state.personalInfo.city}
            />
            <FormField
              error={errors.zip}
              label={t("personal.fields.zip")}
              onChange={(v) =>
                setState((prev) => ({
                  ...prev,
                  personalInfo: { ...prev.personalInfo, zip: v },
                }))
              }
              placeholder={t("personal.fields.zipPlaceholder")}
              required={state.persona.isFinancial}
              value={state.personalInfo.zip}
            />
          </div>
        </fieldset>
      </div>
    </div>
  );

  const renderBanking = () => (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={headingClass}>{t("banking.title")}</h1>
        <p className="type-body-sm mt-2 text-ink-muted">
          {t("banking.description")}
        </p>
      </div>

      <div className="flex gap-1 rounded-biso-md border border-edge bg-surface-sunken p-1">
        {(["norwegian", "international"] as const).map((mode) => (
          <button
            aria-pressed={state.bankingInfo.mode === mode}
            className={cn(
              "type-body-sm flex-1 rounded-biso-sm py-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2",
              state.bankingInfo.mode === mode
                ? "bg-surface text-ink"
                : "text-ink-muted hover:text-ink"
            )}
            key={mode}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                bankingInfo: { ...prev.bankingInfo, mode },
              }))
            }
            type="button"
          >
            {mode === "norwegian"
              ? t("banking.norwegian")
              : t("banking.international")}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {state.bankingInfo.mode === "norwegian" ? (
          <FormField
            error={errors.bank_account}
            hint={t("banking.fields.bankAccountHint")}
            label={t("banking.fields.bankAccount")}
            onChange={(v) =>
              setState((prev) => ({
                ...prev,
                bankingInfo: { ...prev.bankingInfo, bank_account: v },
              }))
            }
            placeholder={t("banking.fields.bankAccountPlaceholder")}
            required
            value={state.bankingInfo.bank_account}
          />
        ) : (
          <>
            <FormField
              error={errors.bank_account}
              hint={t("banking.fields.ibanHint")}
              label={t("banking.fields.iban")}
              onChange={(v) =>
                setState((prev) => ({
                  ...prev,
                  bankingInfo: { ...prev.bankingInfo, bank_account: v },
                }))
              }
              placeholder={t("banking.fields.ibanPlaceholder")}
              required
              value={state.bankingInfo.bank_account}
            />
            <FormField
              error={errors.swift}
              hint={t("banking.fields.swiftHint")}
              label={t("banking.fields.swift")}
              onChange={(v) =>
                setState((prev) => ({
                  ...prev,
                  bankingInfo: { ...prev.bankingInfo, swift: v },
                }))
              }
              placeholder={t("banking.fields.swiftPlaceholder")}
              required
              value={state.bankingInfo.swift}
            />
          </>
        )}
      </div>
    </div>
  );

  const renderDone = () => (
    <div className="flex flex-col items-start gap-6 py-2">
      <BadgeCheck aria-hidden="true" className="size-10 text-success" />
      <div>
        <h1 className={headingClass}>{t("done.title")}</h1>
        <p className="type-body-sm mt-2 text-ink-muted">
          {t("done.description")}
          {state.biLinked && ` ${t("done.biLinked")}`}
          {state.persona.isFinancial && ` ${t("done.financialSaved")}`}{" "}
          {t("done.updateNote")}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link
          className={cn(statusPanelPrimaryAction, "w-full justify-center")}
          href="/profile"
        >
          {t("done.goToProfile")}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
        <Link className={cn(quietButton, "w-full")} href="/">
          {t("done.backToHome")}
        </Link>
      </div>
    </div>
  );

  const stepContent: Record<StepId, () => React.ReactNode> = {
    banking: renderBanking,
    done: renderDone,
    persona: renderPersona,
    personal: renderPersonal,
    student: renderStudent,
  };

  const showNavButtons = currentStep !== "done" && currentStep !== "student";

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-start justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Over the navy page, so the band's aliases apply to this line. */}
        <div className="mb-6 text-center" data-surface="deep">
          <p className="type-label text-ink-accent">BISO</p>
          <p className="type-body-sm mt-1 text-ink-muted">
            {currentStep === "done"
              ? t("header.subtitleDone")
              : t("header.subtitle")}
          </p>
        </div>

        <div className="rounded-biso-lg border border-edge bg-surface p-7 shadow-elev-2">
          {currentStep === "done" ? null : (
            <StepDots
              currentIdx={stepIdx}
              label={t("nav.stepOf", {
                current: stepIdx + 1,
                total: steps.length - 1,
              })}
              steps={steps}
            />
          )}

          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              animate="center"
              custom={direction}
              exit="exit"
              initial="enter"
              key={currentStep}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              variants={slideVariants}
            >
              {stepContent[currentStep]?.()}
            </motion.div>
          </AnimatePresence>

          {submitError ? (
            <p
              className="type-body-sm mt-4 rounded-biso-md border border-danger/40 bg-danger/5 p-4 text-danger"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          {showNavButtons ? (
            <div className="mt-6 flex items-center justify-between">
              <button
                className={cn(
                  quietButton,
                  "disabled:pointer-events-none disabled:opacity-0"
                )}
                disabled={stepIdx === 0}
                onClick={goBack}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
                {t("nav.back")}
              </button>

              <button
                aria-busy={submitting}
                className={cn(statusPanelPrimaryAction, "disabled:opacity-60")}
                disabled={submitting}
                onClick={goNext}
                type="button"
              >
                {submitting ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 shrink-0 animate-spin"
                    />
                    {t("nav.saving")}
                  </>
                ) : null}
                {!submitting && isLastFormStep ? t("nav.complete") : null}
                {submitting || isLastFormStep ? null : (
                  <>
                    {t("nav.continue")}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
