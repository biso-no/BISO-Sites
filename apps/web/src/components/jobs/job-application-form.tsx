"use client";

import type { RecruitmentCustomQuestion } from "@repo/shared/types/recruitment";
import { trackEvent } from "@repo/shared/utils/analytics";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitJobApplication } from "@/app/actions/jobs";

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

interface JobApplicationFormProps {
  applicantEmail?: string;
  applicantName?: string;
  customQuestions?: RecruitmentCustomQuestion[];
  cvRequired: boolean;
  isAuthenticated: boolean;
  jobId: string;
}

type Step = "contact" | "questions" | "documents" | "review";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "contact", label: "Contact" },
  { id: "questions", label: "Questions" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
];

function stepCircleClass(i: number, currentIndex: number): string {
  if (i < currentIndex) {
    return "bg-brand text-white";
  }
  if (i === currentIndex) {
    return "border-2 border-brand text-brand";
  }
  return "border border-border text-muted-foreground";
}

function StepIndicator({
  current,
  hasQuestions,
}: {
  current: Step;
  hasQuestions: boolean;
}) {
  const visibleSteps = hasQuestions
    ? STEPS
    : STEPS.filter((s) => s.id !== "questions");
  const currentIndex = visibleSteps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-2 text-xs">
      {visibleSteps.map((step, i) => (
        <div className="flex items-center gap-2" key={step.id}>
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full font-medium text-[10px] ${stepCircleClass(i, currentIndex)}`}
          >
            {i < currentIndex ? "✓" : i + 1}
          </span>
          <span
            className={
              i === currentIndex
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }
          >
            {step.label}
          </span>
          {i < visibleSteps.length - 1 && (
            <span className="text-border">—</span>
          )}
        </div>
      ))}
    </div>
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
  const id = `q-${question.id}`;

  if (question.type === "long_text") {
    return (
      <Textarea
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
      <div className="flex flex-col gap-2">
        {(question.options ?? []).map((opt) => {
          const isSelected = selectedOptions.includes(opt);
          return (
            <label
              className="flex items-center gap-2 text-muted-foreground text-sm"
              key={opt}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selectedOptions, opt].join(", "));
                  } else {
                    onChange(
                      selectedOptions.filter((o) => o !== opt).join(", ")
                    );
                  }
                }}
              />
              {opt}
            </label>
          );
        })}
      </div>
    );
  }

  if (question.type === "select") {
    return (
      <select
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        id={id}
        onChange={(e) => onChange(e.target.value)}
        required={question.required}
        value={answer}
      >
        <option value="">Choose…</option>
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
        className="flex items-center gap-2 text-muted-foreground text-sm"
        htmlFor={id}
      >
        <Checkbox
          checked={answer === "true"}
          id={id}
          onCheckedChange={(checked) =>
            onChange(checked === true ? "true" : "")
          }
        />
        Yes
      </label>
    );
  }

  if (question.type === "number") {
    return (
      <Input
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.help_text ?? ""}
        required={question.required}
        type="number"
        value={answer}
      />
    );
  }

  return (
    <Input
      id={id}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.help_text ?? ""}
      required={question.required}
      value={answer}
    />
  );
}

export function JobApplicationForm({
  applicantEmail = "",
  applicantName = "",
  cvRequired,
  customQuestions = [],
  isAuthenticated,
  jobId,
}: JobApplicationFormProps) {
  const hasQuestions = customQuestions.length > 0;
  const steps = hasQuestions
    ? STEPS
    : STEPS.filter((s) => s.id !== "questions");

  const [step, setStep] = useState<Step>("contact");
  const [name, setName] = useState(applicantName);
  const [countryCode, setCountryCode] = useState("+47");
  const [localPhone, setLocalPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [coverLetter, setCoverLetter] = useState("");
  const [availability, setAvailability] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function nextStep() {
    const i = steps.findIndex((s) => s.id === step);
    const next = steps[i + 1];
    if (next) {
      setStep(next.id);
      trackEvent("job_application_step", { jobId, step: next.id });
    }
  }

  function prevStep() {
    const i = steps.findIndex((s) => s.id === step);
    const prev = steps[i - 1];
    if (prev) {
      setStep(prev.id);
    }
  }

  function buildFormData(): FormData {
    const formData = new FormData();
    formData.set("applicant_name", name);
    const phone = localPhone.trim() ? `${countryCode}${localPhone.trim()}` : "";
    formData.set("applicant_phone", phone);
    formData.set("cover_letter", coverLetter);
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
      setMessage(
        result.success ? "Application submitted successfully." : result.error
      );
    });
  }

  if (!isAuthenticated) {
    return (
      <Card className="border-border/60 p-6 shadow-sm">
        <h3 className="font-semibold text-foreground text-xl">Apply</h3>
        <p className="mt-2 text-muted-foreground text-sm">
          You need a signed-in BISO account to apply.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link href="/auth/login">Sign in to apply</Link>
        </Button>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card className="border-border/60 p-6 shadow-sm">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700 dark:bg-green-900/30">
            ✓
          </div>
          <h3 className="font-semibold text-foreground text-lg">
            Application submitted!
          </h3>
          <p className="text-muted-foreground text-sm">
            We'll review your application and be in touch at{" "}
            <strong>{applicantEmail}</strong>.
          </p>
          <Button asChild className="w-full" variant="outline">
            <Link href="/applications">View my applications</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 p-6 shadow-sm">
      <div className="mb-5 space-y-2">
        <h3 className="font-semibold text-foreground text-xl">Apply</h3>
        <StepIndicator current={step} hasQuestions={hasQuestions} />
      </div>

      <AnimatePresence mode="wait">
        {/* Step: Contact */}
        {step === "contact" && (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
            exit={{ opacity: 0, x: -20 }}
            initial={{ opacity: 0, x: 20 }}
            key="contact"
            transition={{ duration: 0.15 }}
          >
            <div className="space-y-2">
              <Label htmlFor="applicant_name">Full name *</Label>
              <Input
                id="applicant_name"
                onChange={(e) => setName(e.target.value)}
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="applicant_email">Email</Label>
              <Input
                disabled
                id="applicant_email"
                type="email"
                value={applicantEmail}
              />
              <p className="text-muted-foreground text-xs">
                Verified via your BISO account
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="applicant_phone">Phone (optional)</Label>
              <div className="flex gap-2">
                <select
                  aria-label="Country code"
                  className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  onChange={(e) => setCountryCode(e.target.value)}
                  value={countryCode}
                >
                  {COUNTRY_CODES.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <Input
                  className="flex-1"
                  id="applicant_phone"
                  inputMode="tel"
                  onChange={(e) => setLocalPhone(e.target.value)}
                  placeholder="123 45 678"
                  type="tel"
                  value={localPhone}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn (optional)</Label>
              <Input
                id="linkedin_url"
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                value={linkedinUrl}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="current_role">Current role (optional)</Label>
                <Input
                  id="current_role"
                  onChange={(e) => setCurrentRole(e.target.value)}
                  placeholder="Student, intern…"
                  value={currentRole}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_employer">
                  Employer / school (optional)
                </Label>
                <Input
                  id="current_employer"
                  onChange={(e) => setCurrentEmployer(e.target.value)}
                  placeholder="BI, BISO…"
                  value={currentEmployer}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!name.trim()}
              onClick={nextStep}
              type="button"
            >
              Continue
            </Button>
          </motion.div>
        )}

        {/* Step: Custom questions */}
        {step === "questions" && (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
            exit={{ opacity: 0, x: -20 }}
            initial={{ opacity: 0, x: 20 }}
            key="questions"
            transition={{ duration: 0.15 }}
          >
            <p className="text-muted-foreground text-sm">
              A few questions from the hiring team.
            </p>
            {customQuestions.map((q) => (
              <div className="space-y-1.5" key={q.id}>
                <Label htmlFor={`q-${q.id}`}>
                  {q.label}
                  {q.required && " *"}
                </Label>
                <QuestionInput
                  answer={answers[q.id] ?? ""}
                  onChange={(v) => setAnswer(q.id, v)}
                  question={q}
                />
                {q.help_text && (
                  <p className="text-muted-foreground text-xs">{q.help_text}</p>
                )}
              </div>
            ))}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={prevStep}
                type="button"
                variant="outline"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={customQuestions
                  .filter((q) => q.required)
                  .some((q) => !(answers[q.id] ?? "").trim())}
                onClick={nextStep}
                type="button"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Documents */}
        {step === "documents" && (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
            exit={{ opacity: 0, x: -20 }}
            initial={{ opacity: 0, x: 20 }}
            key="documents"
            transition={{ duration: 0.15 }}
          >
            <div className="space-y-2">
              <Label htmlFor="cover_letter">
                Cover letter {!cvRequired && "(optional)"}
              </Label>
              <Textarea
                id="cover_letter"
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell BISO why you're applying and what you'd bring."
                rows={6}
                value={coverLetter}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume">
                CV / Résumé {cvRequired ? "(required, PDF)" : "(optional, PDF)"}
              </Label>
              <Input
                accept="application/pdf"
                id="resume"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    if (file.type !== "application/pdf") {
                      setFileError("Only PDF files are allowed.");
                    } else if (file.size > 5 * 1024 * 1024) {
                      setFileError("File exceeds 5MB limit.");
                    } else {
                      setFileError(null);
                    }
                  } else {
                    setFileError(null);
                  }
                  setResume(file);
                }}
                required={cvRequired}
                type="file"
              />
              {resume && !fileError && (
                <p className="text-muted-foreground text-xs">
                  Selected: {resume.name} ({(resume.size / 1024).toFixed(0)} KB)
                </p>
              )}
              {fileError ? (
                <p className="text-destructive text-xs">{fileError}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Max 5 MB, PDF only.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability">
                Interview availability (optional)
              </Label>
              <Textarea
                id="availability"
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="Dates and times that generally work — one per line."
                rows={3}
                value={availability}
              />
              <p className="text-muted-foreground text-xs">
                Helps HR suggest slots without back-and-forth emails.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={prevStep}
                type="button"
                variant="outline"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={(cvRequired && !resume) || fileError !== null}
                onClick={nextStep}
                type="button"
              >
                Review application
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Review + submit */}
        {step === "review" && (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
            exit={{ opacity: 0, x: -20 }}
            initial={{ opacity: 0, x: 20 }}
            key="review"
            transition={{ duration: 0.15 }}
          >
            <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{applicantEmail}</span>
              </div>
              {localPhone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">
                    {countryCode}
                    {localPhone}
                  </span>
                </div>
              )}
              {resume && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CV</span>
                  <span className="font-medium text-green-700">
                    {resume.name}
                  </span>
                </div>
              )}
              {coverLetter && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cover letter</span>
                  <span className="font-medium text-green-700">Included</span>
                </div>
              )}
            </div>

            <label
              className="flex cursor-pointer items-start gap-3"
              htmlFor="gdpr_consent"
            >
              <Checkbox
                checked={consent}
                id="gdpr_consent"
                onCheckedChange={(c) => setConsent(c === true)}
              />
              <span className="text-muted-foreground text-sm">
                I consent to BISO processing my application data for this
                recruitment process. Data is retained for 180 days.
              </span>
            </label>

            {message && <p className="text-destructive text-sm">{message}</p>}

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={prevStep}
                type="button"
                variant="outline"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={isPending || !consent}
                onClick={handleSubmit}
                type="button"
              >
                {isPending ? "Submitting…" : "Submit application"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
