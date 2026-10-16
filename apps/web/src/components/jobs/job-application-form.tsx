"use client";

import { APPLICATION_DOCUMENT_MAX_BYTES } from "@repo/shared/recruitment/application-documents";
import type { RecruitmentCustomQuestion } from "@repo/shared/types/recruitment";
import { trackEvent } from "@repo/shared/utils/analytics";
import { cn } from "@repo/ui/lib/utils";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitJobApplication } from "@/app/actions/jobs";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+47", label: "🇳🇴 +47" },
  { code: "+46", label: "🇸🇪 +46" },
  { code: "+45", label: "🇩🇰 +45" },
  { code: "+358", label: "🇫🇮 +358" },
  { code: "+354", label: "🇮🇸 +354" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+34", label: "🇪🇸 +34" },
  { code: "+39", label: "🇮🇹 +39" },
  { code: "+31", label: "🇳🇱 +31" },
  { code: "+32", label: "🇧🇪 +32" },
  { code: "+41", label: "🇨🇭 +41" },
  { code: "+43", label: "🇦🇹 +43" },
  { code: "+48", label: "🇵🇱 +48" },
  { code: "+420", label: "🇨🇿 +420" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+81", label: "🇯🇵 +81" },
  { code: "+82", label: "🇰🇷 +82" },
  { code: "+55", label: "🇧🇷 +55" },
  { code: "+52", label: "🇲🇽 +52" },
  { code: "+7", label: "🇷🇺 +7" },
  { code: "+90", label: "🇹🇷 +90" },
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+27", label: "🇿🇦 +27" },
  { code: "+20", label: "🇪🇬 +20" },
];

/*
 * The form is drawn from the redesign's tokens rather than the shadcn
 * primitives, whose classes read the shadcn semantic palette and drift from
 * the v2 surface in dark mode. Buttons are the canonical StatusPanel CTA
 * styles.
 */
const PANEL = "rounded-biso-md border border-edge p-6";
const FIELD =
  "type-body-sm w-full rounded-biso-sm border border-edge bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";
const FILE_FIELD = cn(
  FIELD,
  "file:me-3 file:rounded-biso-sm file:border-0 file:bg-surface-sunken file:px-3 file:py-1 file:font-semibold file:text-ink"
);
const LABEL = "type-body-sm block font-semibold text-ink";
const HINT = "type-body-sm text-ink-muted";
const FIELD_ERROR = "type-body-sm text-danger";
const CHECKBOX =
  "mt-0.5 size-4 shrink-0 accent-action focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2";
// Centred both ways: two buttons share the narrow sidebar, so a long label
// ("Submit application") may wrap.
const PRIMARY_BUTTON = cn(
  statusPanelPrimaryAction,
  "justify-center text-center disabled:cursor-not-allowed disabled:opacity-60"
);
const SECONDARY_BUTTON = cn(
  statusPanelSecondaryAction,
  "justify-center text-center"
);

interface JobApplicationFormProps {
  applicantEmail?: string;
  applicantName?: string;
  customQuestions?: RecruitmentCustomQuestion[];
  cvRequired: boolean;
  isAuthenticated: boolean;
  /** Current user's live membership status; only consulted when membersOnly. */
  isMember?: boolean;
  jobId: string;
  /** Vacancy is members-only: everyone can read it, only members may apply. */
  membersOnly?: boolean;
}

/** A message key in `jobs.application`. */
type DocumentError = "pdfOnly" | "tooLarge";

/** Client-side mirror of the server's document rules, for instant feedback. */
function validateDocument(file: File): DocumentError | null {
  if (file.type !== "application/pdf") {
    return "pdfOnly";
  }
  if (file.size > APPLICATION_DOCUMENT_MAX_BYTES) {
    return "tooLarge";
  }
  return null;
}

type Step = "contact" | "questions" | "documents" | "review";

const STEPS: Step[] = ["contact", "questions", "documents", "review"];

function stepMarkerClass(i: number, currentIndex: number): string {
  if (i < currentIndex) {
    return "bg-action text-action-ink";
  }
  if (i === currentIndex) {
    return "border-2 border-action text-ink-accent";
  }
  return "border border-edge text-ink-muted";
}

function StepIndicator({
  current,
  hasQuestions,
}: {
  current: Step;
  hasQuestions: boolean;
}) {
  const t = useTranslations("jobs.application");
  const visibleSteps = hasQuestions
    ? STEPS
    : STEPS.filter((s) => s !== "questions");
  const currentIndex = visibleSteps.indexOf(current);

  return (
    <ol
      aria-label={t("stepsLabel")}
      className="type-body-sm flex flex-wrap items-center gap-2"
    >
      {visibleSteps.map((step, i) => (
        <li
          aria-current={i === currentIndex ? "step" : undefined}
          className="flex items-center gap-2"
          key={step}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 items-center justify-center rounded-biso-pill font-semibold text-[0.625rem] tabular-nums",
              stepMarkerClass(i, currentIndex)
            )}
          >
            {i < currentIndex ? <Check className="size-3" /> : i + 1}
          </span>
          <span
            className={
              i === currentIndex ? "font-semibold text-ink" : "text-ink-muted"
            }
          >
            {t(`steps.${step}`)}
          </span>
          {i < visibleSteps.length - 1 ? (
            <span aria-hidden="true" className="text-ink-muted">
              —
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function QuestionInput({
  answer,
  onChange,
  question,
}: {
  answer: string;
  onChange: (value: string) => void;
  question: RecruitmentCustomQuestion;
}) {
  const t = useTranslations("jobs.application");
  const id = `q-${question.id}`;

  if (question.type === "long_text") {
    return (
      <textarea
        className={FIELD}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.help_text ?? ""}
        required={question.required}
        rows={4}
        value={answer}
      />
    );
  }

  if (question.type === "multi_select") {
    const selectedOptions = answer
      ? answer.split(",").map((s) => s.trim())
      : [];
    return (
      // The question's own label names the group; each option labels its box.
      <fieldset aria-labelledby={`${id}-label`} className="space-y-2">
        {(question.options ?? []).map((opt, index) => {
          const optionId = `${id}-${index}`;
          return (
            <label
              className="type-body-sm flex items-start gap-2 text-ink"
              htmlFor={optionId}
              key={opt}
            >
              <input
                checked={selectedOptions.includes(opt)}
                className={CHECKBOX}
                id={optionId}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selectedOptions, opt].join(", "));
                  } else {
                    onChange(
                      selectedOptions.filter((o) => o !== opt).join(", ")
                    );
                  }
                }}
                type="checkbox"
              />
              {opt}
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (question.type === "select") {
    return (
      <select
        className={FIELD}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        required={question.required}
        value={answer}
      >
        <option value="">{t("choose")}</option>
        {(question.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (question.type === "boolean") {
    return (
      <label
        className="type-body-sm flex items-start gap-2 text-ink"
        htmlFor={id}
      >
        <input
          checked={answer === "true"}
          className={CHECKBOX}
          id={id}
          onChange={(e) => onChange(e.target.checked ? "true" : "")}
          type="checkbox"
        />
        {t("yes")}
      </label>
    );
  }

  return (
    <input
      className={FIELD}
      id={id}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.help_text ?? ""}
      required={question.required}
      type={question.type === "number" ? "number" : "text"}
      value={answer}
    />
  );
}

function QuestionField({
  answer,
  onChange,
  question,
}: {
  answer: string;
  onChange: (value: string) => void;
  question: RecruitmentCustomQuestion;
}) {
  const id = `q-${question.id}`;
  return (
    <div className="space-y-1.5">
      {/* A multi-select is a group of boxes, not one control: its label names
          the group (`aria-labelledby`) rather than pointing at an id. */}
      <label
        className={LABEL}
        htmlFor={question.type === "multi_select" ? undefined : id}
        id={`${id}-label`}
      >
        {question.label}
        {question.required ? " *" : null}
      </label>
      <QuestionInput answer={answer} onChange={onChange} question={question} />
      {question.help_text ? <p className={HINT}>{question.help_text}</p> : null}
    </div>
  );
}

/**
 * One PDF upload — the cover letter or the CV. Validated on selection against
 * the server's rules, so a wrong file is caught before anything is uploaded.
 */
function DocumentField({
  error,
  file,
  hint,
  id,
  label,
  onSelect,
  required,
}: {
  error: DocumentError | null;
  file: File | null;
  hint: string;
  id: string;
  label: string;
  onSelect: (file: File | null, error: DocumentError | null) => void;
  required: boolean;
}) {
  const t = useTranslations("jobs.application");
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-2">
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <input
        accept="application/pdf"
        aria-describedby={hintId}
        aria-invalid={error !== null}
        className={FILE_FIELD}
        id={id}
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null;
          onSelect(selected, selected ? validateDocument(selected) : null);
        }}
        required={required}
        type="file"
      />
      {file && !error ? (
        <p className={HINT}>
          {t("selectedFile", {
            name: file.name,
            size: (file.size / 1024).toFixed(0),
          })}
        </p>
      ) : null}
      {error ? (
        <p className={FIELD_ERROR} id={hintId} role="alert">
          {t(error)}
        </p>
      ) : (
        <p className={HINT} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

type ApplyGate = "signIn" | "membersOnly";

/**
 * Which wall, if any, stands between this visitor and the form. Sign-in comes
 * first: an anonymous visitor has no membership we could check yet.
 */
function resolveApplyGate({
  isAuthenticated,
  isMember,
  membersOnly,
}: {
  isAuthenticated: boolean;
  isMember: boolean;
  membersOnly: boolean;
}): ApplyGate | null {
  if (!isAuthenticated) {
    return "signIn";
  }
  if (membersOnly && !isMember) {
    return "membersOnly";
  }
  return null;
}

function ApplyGateCard({
  cta,
  href,
  message,
  title,
}: {
  cta: string;
  href: string;
  message: string;
  title: string;
}) {
  return (
    <div className={PANEL}>
      <h2 className="type-heading-card text-ink">{title}</h2>
      <p className={cn(HINT, "mt-2")}>{message}</p>
      <Link className={cn(PRIMARY_BUTTON, "mt-4 w-full")} href={href}>
        {cta}
      </Link>
    </div>
  );
}

/**
 * Replaces the form once it is sent. The submit button the visitor pressed
 * is gone, so focus moves to this heading rather than falling to the page.
 */
function SubmittedPanel({ email }: { email: string }) {
  const t = useTranslations("jobs.application");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className={PANEL}>
      <h2
        className="type-heading-card text-ink focus:outline-none"
        ref={heading}
        tabIndex={-1}
      >
        {t("submitted")}
      </h2>
      <p className={cn(HINT, "mt-2")}>
        {t.rich("submittedBody", {
          email,
          strong: (chunks) => (
            <strong className="font-semibold text-ink">{chunks}</strong>
          ),
        })}
      </p>
      <Link
        className={cn(SECONDARY_BUTTON, "mt-4 w-full")}
        href="/applications"
      >
        {t("viewApplications")}
      </Link>
    </div>
  );
}

function SummaryRow({
  label,
  tone = "ink",
  value,
}: {
  label: string;
  tone?: "ink" | "success";
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-words text-end font-semibold",
          tone === "success" ? "text-success" : "text-ink"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const STEP_MOTION = {
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  initial: { opacity: 0, x: 20 },
  transition: { duration: 0.15 },
} as const;

export function JobApplicationForm({
  applicantEmail = "",
  applicantName = "",
  cvRequired,
  customQuestions = [],
  isAuthenticated,
  isMember = false,
  jobId,
  membersOnly = false,
}: JobApplicationFormProps) {
  const t = useTranslations("jobs.application");
  const hasQuestions = customQuestions.length > 0;
  const steps = hasQuestions ? STEPS : STEPS.filter((s) => s !== "questions");

  const [step, setStep] = useState<Step>("contact");
  const [name, setName] = useState(applicantName);
  const [countryCode, setCountryCode] = useState("+47");
  const [localPhone, setLocalPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [coverLetter, setCoverLetter] = useState<File | null>(null);
  const [coverLetterError, setCoverLetterError] =
    useState<DocumentError | null>(null);
  const [availability, setAvailability] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [fileError, setFileError] = useState<DocumentError | null>(null);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function nextStep() {
    const i = steps.indexOf(step);
    const next = steps[i + 1];
    if (next) {
      setStep(next);
      trackEvent("job_application_step", { jobId, step: next });
    }
  }

  function prevStep() {
    const i = steps.indexOf(step);
    const prev = steps[i - 1];
    if (prev) {
      setStep(prev);
    }
  }

  function buildFormData(): FormData {
    const formData = new FormData();
    formData.set("applicant_name", name);
    const phone = localPhone.trim() ? `${countryCode}${localPhone.trim()}` : "";
    formData.set("applicant_phone", phone);
    if (coverLetter) {
      formData.set("cover_letter", coverLetter);
    }
    formData.set("availability", availability);
    formData.set("gdpr_consent", "true");
    if (linkedinUrl.trim()) {
      formData.set("linkedin_url", linkedinUrl.trim());
    }
    if (currentRole.trim()) {
      formData.set("current_role", currentRole.trim());
    }
    if (currentEmployer.trim()) {
      formData.set("current_employer", currentEmployer.trim());
    }
    for (const q of customQuestions) {
      formData.set(`answer.${q.id}`, answers[q.id] ?? "");
      formData.set(`answer_label.${q.id}`, q.label);
      formData.set(`answer_type.${q.id}`, q.type);
    }
    if (resume) {
      formData.set("resume", resume);
    }
    return formData;
  }

  function handleSubmit() {
    if (!consent) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await submitJobApplication(jobId, buildFormData());
      setIsSuccess(result.success);
      if (result.success) {
        trackEvent("job_application_submit", { jobId });
      }
      // On success the form is replaced by the confirmation; only a refusal
      // has anything to say here.
      setMessage(result.success ? null : result.error);
    });
  }

  // The vacancy itself stays readable to everyone — only the form is gated, so
  // a non-member sees the role and what joining would get them, rather than
  // filling in four steps and a CV upload to be refused on submit.
  const gate = resolveApplyGate({ isAuthenticated, isMember, membersOnly });
  if (gate === "signIn") {
    return (
      <ApplyGateCard
        cta={t("signInTitle")}
        href="/auth/login"
        message={t("signInBody")}
        title={t("apply")}
      />
    );
  }
  if (gate === "membersOnly") {
    return (
      <ApplyGateCard
        cta={t("becomeMember")}
        href="/membership/join"
        message={t("membersOnlyBody")}
        title={t("apply")}
      />
    );
  }

  if (isSuccess) {
    return <SubmittedPanel email={applicantEmail} />;
  }

  return (
    <div className={PANEL}>
      <div className="mb-5 space-y-3">
        <h2 className="type-heading-card text-ink">{t("apply")}</h2>
        <StepIndicator current={step} hasQuestions={hasQuestions} />
      </div>

      <AnimatePresence mode="wait">
        {/* Step: Contact */}
        {step === "contact" && (
          <motion.div className="space-y-4" key="contact" {...STEP_MOTION}>
            <div className="space-y-2">
              <label className={LABEL} htmlFor="applicant_name">
                {t("fullName")}
              </label>
              <input
                autoComplete="name"
                className={FIELD}
                id="applicant_name"
                onChange={(e) => setName(e.target.value)}
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <label className={LABEL} htmlFor="applicant_email">
                {t("email")}
              </label>
              <input
                aria-describedby="applicant_email-hint"
                className={FIELD}
                disabled
                id="applicant_email"
                type="email"
                value={applicantEmail}
              />
              <p className={HINT} id="applicant_email-hint">
                {t("verified")}
              </p>
            </div>
            <div className="space-y-2">
              <label className={LABEL} htmlFor="applicant_phone">
                {t("phoneOptional")}
              </label>
              <div className="flex gap-2">
                <select
                  aria-label={t("countryCode")}
                  className={cn(FIELD, "w-auto")}
                  onChange={(e) => setCountryCode(e.target.value)}
                  value={countryCode}
                >
                  {COUNTRY_CODES.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  autoComplete="tel-national"
                  className={cn(FIELD, "min-w-0 flex-1")}
                  id="applicant_phone"
                  inputMode="tel"
                  onChange={(e) => setLocalPhone(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  type="tel"
                  value={localPhone}
                />
              </div>
            </div>
            <hr className="border-edge" />
            <div className="space-y-2">
              <label className={LABEL} htmlFor="linkedin_url">
                {t("linkedin")}
              </label>
              <input
                className={FIELD}
                id="linkedin_url"
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                type="url"
                value={linkedinUrl}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={LABEL} htmlFor="current_role">
                  {t("currentRole")}
                </label>
                <input
                  className={FIELD}
                  id="current_role"
                  onChange={(e) => setCurrentRole(e.target.value)}
                  placeholder={t("currentRolePlaceholder")}
                  value={currentRole}
                />
              </div>
              <div className="space-y-2">
                <label className={LABEL} htmlFor="current_employer">
                  {t("employer")}
                </label>
                <input
                  className={FIELD}
                  id="current_employer"
                  onChange={(e) => setCurrentEmployer(e.target.value)}
                  placeholder={t("employerPlaceholder")}
                  value={currentEmployer}
                />
              </div>
            </div>
            <button
              className={cn(PRIMARY_BUTTON, "w-full")}
              disabled={!name.trim()}
              onClick={nextStep}
              type="button"
            >
              {t("continue")}
            </button>
          </motion.div>
        )}

        {/* Step: Custom questions */}
        {step === "questions" && (
          <motion.div className="space-y-4" key="questions" {...STEP_MOTION}>
            <p className={HINT}>{t("intro")}</p>
            {customQuestions.map((q) => (
              <QuestionField
                answer={answers[q.id] ?? ""}
                key={q.id}
                onChange={(v) => setAnswer(q.id, v)}
                question={q}
              />
            ))}
            <div className="flex gap-3">
              <button
                className={cn(SECONDARY_BUTTON, "flex-1")}
                onClick={prevStep}
                type="button"
              >
                {t("back")}
              </button>
              <button
                className={cn(PRIMARY_BUTTON, "flex-1")}
                disabled={customQuestions
                  .filter((q) => q.required)
                  .some((q) => !(answers[q.id] ?? "").trim())}
                onClick={nextStep}
                type="button"
              >
                {t("continue")}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step: Documents */}
        {step === "documents" && (
          <motion.div className="space-y-4" key="documents" {...STEP_MOTION}>
            <DocumentField
              error={coverLetterError}
              file={coverLetter}
              hint={t("coverLetterHint")}
              id="cover_letter"
              label={t("coverLetterLabel")}
              onSelect={(file, error) => {
                setCoverLetterError(error);
                setCoverLetter(file);
              }}
              required
            />
            <DocumentField
              error={fileError}
              file={resume}
              hint={t("attachmentHint")}
              id="resume"
              label={cvRequired ? t("cvLabelRequired") : t("cvLabelOptional")}
              onSelect={(file, error) => {
                setFileError(error);
                setResume(file);
              }}
              required={cvRequired}
            />
            <div className="space-y-2">
              <label className={LABEL} htmlFor="availability">
                {t("availability")}
              </label>
              <textarea
                aria-describedby="availability-hint"
                className={FIELD}
                id="availability"
                onChange={(e) => setAvailability(e.target.value)}
                placeholder={t("availabilityPlaceholder")}
                rows={3}
                value={availability}
              />
              <p className={HINT} id="availability-hint">
                {t("availabilityHint")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className={cn(SECONDARY_BUTTON, "flex-1")}
                onClick={prevStep}
                type="button"
              >
                {t("back")}
              </button>
              <button
                className={cn(PRIMARY_BUTTON, "flex-1")}
                // Both documents are checked here, before the review step, so
                // nothing is uploaded that the server would then refuse.
                disabled={
                  (cvRequired && !resume) ||
                  fileError !== null ||
                  !coverLetter ||
                  coverLetterError !== null
                }
                onClick={nextStep}
                type="button"
              >
                {t("review")}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step: Review + submit */}
        {step === "review" && (
          <motion.div className="space-y-4" key="review" {...STEP_MOTION}>
            <dl className="type-body-sm space-y-2 rounded-biso-md bg-surface-sunken p-4">
              <SummaryRow label={t("name")} value={name} />
              <SummaryRow label={t("email")} value={applicantEmail} />
              {localPhone ? (
                <SummaryRow
                  label={t("phone")}
                  value={`${countryCode}${localPhone}`}
                />
              ) : null}
              {resume ? (
                <SummaryRow
                  label={t("cv")}
                  tone="success"
                  value={resume.name}
                />
              ) : null}
              {coverLetter ? (
                <SummaryRow
                  label={t("coverLetter")}
                  tone="success"
                  value={coverLetter.name}
                />
              ) : null}
            </dl>

            <label
              className="flex cursor-pointer items-start gap-3"
              htmlFor="gdpr_consent"
            >
              <input
                checked={consent}
                className={CHECKBOX}
                id="gdpr_consent"
                onChange={(e) => setConsent(e.target.checked)}
                type="checkbox"
              />
              <span className={HINT}>{t("consent")}</span>
            </label>

            {message ? (
              <p className={FIELD_ERROR} role="alert">
                {message}
              </p>
            ) : null}

            <div className="flex gap-3">
              <button
                className={cn(SECONDARY_BUTTON, "flex-1")}
                onClick={prevStep}
                type="button"
              >
                {t("back")}
              </button>
              <button
                className={cn(PRIMARY_BUTTON, "flex-1")}
                disabled={isPending || !consent}
                onClick={handleSubmit}
                type="button"
              >
                {isPending ? t("submitting") : t("submit")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
