"use client";

import { clientAccount, OAuthProvider } from "@repo/api/client";
import { AnimatePresence, motion } from "framer-motion";
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
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { updateProfile } from "@/lib/actions/user";

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
  pendingOAuth: boolean;
  persona: PersonaState;
  personalInfo: PersonalInfo;
}

const STORAGE_KEY = "biso_onboarding_state";

const DEFAULT_STATE: OnboardingState = {
  persona: { isStudent: false, isVolunteer: false, isFinancial: false },
  personalInfo: { name: "", phone: "", address: "", city: "", zip: "" },
  bankingInfo: { mode: "norwegian", bank_account: "", swift: "" },
  pendingOAuth: false,
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

// ---------- Sub-components ----------

const slideVariants = {
  center: { opacity: 1, x: 0 },
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  exit: (dir: number) => ({ opacity: 0, x: dir < 0 ? 48 : -48 }),
};

function StepDots({
  currentIdx,
  steps,
}: {
  steps: StepId[];
  currentIdx: number;
}) {
  return (
    <div className="mb-8 flex items-center justify-center gap-1.5">
      {steps.map((step, idx) => {
        let dotClass = "h-2 w-2 bg-border";
        if (idx === currentIdx) {
          dotClass = "h-2 w-6 bg-brand";
        } else if (idx < currentIdx) {
          dotClass = "h-2 w-2 bg-brand/40";
        }
        return (
          <div
            className={`rounded-full transition-all duration-300 ${dotClass}`}
            key={step}
          />
        );
      })}
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
      className={`group relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-brand bg-brand-muted shadow-sm"
          : "border-border bg-background hover:border-brand/40 hover:bg-brand-muted/50"
      }`}
      onClick={onToggle}
      type="button"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
          selected
            ? "bg-brand-muted-strong text-brand"
            : "bg-muted text-muted-foreground group-hover:bg-brand-muted group-hover:text-brand"
        }`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p
          className={`font-semibold text-sm ${selected ? "text-brand" : "text-foreground"}`}
        >
          {label}
        </p>
        <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>
      </div>
      {selected && (
        <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand">
          <Check className="h-3 w-3 text-brand-foreground" />
        </div>
      )}
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
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label
        className="mb-1.5 block font-medium text-foreground text-sm"
        htmlFor={id}
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-brand/20 ${
          error
            ? "border-red-400 bg-red-50/50 focus:border-red-400"
            : "border-border bg-background focus:border-brand"
        }`}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {hint && !error && (
        <p className="mt-1.5 text-muted-foreground text-xs">{hint}</p>
      )}
      {error && <p className="mt-1.5 text-red-500 text-xs">{error}</p>}
    </div>
  );
}

// ---------- Main component ----------

export function OnboardingFlow({
  initialName,
  linkedBi,
}: {
  initialName: string;
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

  // Load persisted state after mount + handle OAuth return
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
        pendingOAuth: false,
        personalInfo: {
          ...DEFAULT_STATE.personalInfo,
          ...parsed.personalInfo,
          name: initialName || parsed.personalInfo?.name || "",
        },
      });

      if (linkedBi && parsed.pendingOAuth) {
        const persona = parsed.persona ?? DEFAULT_STATE.persona;
        const newSteps = buildSteps(persona, true);
        const personalIdx = newSteps.indexOf("personal");
        setStepIdx(personalIdx === -1 ? 1 : personalIdx);
      }
    } catch {
      // ignore parse errors
    }
  }, [linkedBi, initialName]);

  // Persist state on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
        localStorage.removeItem(STORAGE_KEY);
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

  const triggerOidc = () => {
    setState((prev) => ({ ...prev, pendingOAuth: true }));
    const base = window.location.origin;
    clientAccount.createOAuth2Session(
      OAuthProvider.Oidc,
      `${base}/onboarding?linked=1`,
      `${base}/onboarding?oidc_failed=1`,
      ["openid", "email", "profile"]
    );
  };

  const skipStudent = () => {
    setDirection(1);
    setErrors({});
    setStepIdx((i) => i + 1);
  };

  // ---------- Step renderers ----------

  const renderPersona = () => (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          {t("persona.title")}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("persona.description")}
        </p>
      </div>

      <div className="space-y-2.5">
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

      <p className="text-muted-foreground text-xs">{t("persona.hint")}</p>
    </div>
  );

  const renderStudent = () => (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          {t("student.title")}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("student.description")}
        </p>
      </div>

      <div className="rounded-2xl border border-brand-border bg-brand-muted p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-muted-strong">
            <BadgeCheck className="h-4.5 w-4.5 text-brand" />
          </div>
          <p className="font-semibold text-foreground text-sm">
            {t("student.benefits.title")}
          </p>
        </div>
        <ul className="space-y-2 text-muted-foreground text-sm">
          {(
            [
              t("student.benefits.membership"),
              t("student.benefits.events"),
              t("student.benefits.sso"),
            ] as string[]
          ).map((benefit) => (
            <li className="flex items-start gap-2" key={benefit}>
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground text-sm transition-colors hover:bg-brand/90"
          onClick={triggerOidc}
          type="button"
        >
          {t("student.linkButton")}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          className="w-full rounded-xl px-4 py-2.5 text-center text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
          onClick={skipStudent}
          type="button"
        >
          {t("student.skip")}
        </button>
      </div>
    </div>
  );

  const renderPersonal = () => (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          {t("personal.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {state.persona.isFinancial
            ? t("personal.descriptionFinancial")
            : t("personal.description")}
        </p>
      </div>

      <div className="space-y-4">
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

        <div className="space-y-3 pt-1">
          <p className="font-medium text-foreground text-sm">
            {t("personal.address.title")}{" "}
            {!state.persona.isFinancial && (
              <span className="font-normal text-muted-foreground">
                {t("personal.address.optional")}
              </span>
            )}
          </p>
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
        </div>
      </div>
    </div>
  );

  const renderBanking = () => (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          {t("banking.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("banking.description")}
        </p>
      </div>

      <div className="flex rounded-xl border border-border bg-muted/30 p-1">
        {(["norwegian", "international"] as const).map((mode) => (
          <button
            className={`flex-1 rounded-lg py-2 font-medium text-sm transition-all ${
              state.bankingInfo.mode === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
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

      <div className="space-y-4">
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
    <div className="flex flex-col items-center space-y-6 py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted">
        <BadgeCheck className="h-8 w-8 text-brand" />
      </div>
      <div className="space-y-2">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          {t("done.title")}
        </h1>
        <p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
          {t("done.description")}
          {state.biLinked && ` ${t("done.biLinked")}`}
          {state.persona.isFinancial && ` ${t("done.financialSaved")}`}{" "}
          {t("done.updateNote")}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground text-sm transition-colors hover:bg-brand/90"
          href="/profile"
        >
          {t("done.goToProfile")}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          className="w-full rounded-xl px-4 py-2.5 text-center text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
          href="/"
        >
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
        {/* Brand header above card */}
        <div className="mb-6 text-center">
          <p className="font-semibold text-brand text-xs uppercase tracking-widest">
            BISO
          </p>
          <p className="mt-1 text-white/50 text-xs">
            {currentStep === "done"
              ? t("header.subtitleDone")
              : t("header.subtitle")}
          </p>
        </div>

        <div className="glass-panel p-7">
          {/* Step dots — inside card so they sit on the light glass surface */}
          {currentStep !== "done" && (
            <StepDots currentIdx={stepIdx} steps={steps} />
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

          {submitError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3 text-red-700 text-sm">
              {submitError}
            </div>
          )}

          {showNavButtons && (
            <div className="mt-6 flex items-center justify-between">
              <button
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-0"
                disabled={stepIdx === 0}
                onClick={goBack}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("nav.back")}
              </button>

              <button
                className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-brand-foreground text-sm transition-colors hover:bg-brand/90 disabled:opacity-60"
                disabled={submitting}
                onClick={goNext}
                type="button"
              >
                {submitting && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("nav.saving")}
                  </>
                )}
                {!submitting && isLastFormStep && t("nav.complete")}
                {!(submitting || isLastFormStep) && (
                  <>
                    {t("nav.continue")}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
