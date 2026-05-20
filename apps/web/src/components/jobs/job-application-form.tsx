"use client";

import type { RecruitmentCustomQuestion } from "@repo/shared/types/recruitment";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitJobApplication } from "@/app/actions/jobs";

interface JobApplicationFormProps {
  applicantEmail?: string;
  applicantName?: string;
  cvRequired: boolean;
  isAuthenticated: boolean;
  jobId: string;
  customQuestions?: RecruitmentCustomQuestion[];
}

export function JobApplicationForm({
  applicantEmail = "",
  applicantName = "",
  cvRequired,
  isAuthenticated,
  jobId,
  customQuestions = [],
}: JobApplicationFormProps) {
  const [name, setName] = useState(applicantName);
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [availability, setAvailability] = useState("");
  const [consent, setConsent] = useState(false);
  const [resume, setResume] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");

  function setAnswer(questionId: string, value: string) {
    setAnswers((existing) => ({ ...existing, [questionId]: value }));
  }

  if (!isAuthenticated) {
    return (
      <Card className="border-border/60 p-6 shadow-sm">
        <h3 className="font-semibold text-foreground text-xl">
          Apply for this vacancy
        </h3>
        <p className="mt-2 text-muted-foreground text-sm">
          You need a signed-in BISO account to submit an application.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link href="/auth/login">Sign in to apply</Link>
        </Button>
      </Card>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSuccess(false);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("applicant_name", name);
      formData.set("applicant_phone", phone);
      formData.set("availability", availability);
      formData.set("cover_letter", coverLetter);
      formData.set("gdpr_consent", String(consent));
      if (linkedinUrl.trim()) {
        formData.set("linkedin_url", linkedinUrl.trim());
      }
      if (currentRole.trim()) {
        formData.set("current_role", currentRole.trim());
      }
      if (currentEmployer.trim()) {
        formData.set("current_employer", currentEmployer.trim());
      }

      for (const question of customQuestions) {
        const value = answers[question.id] ?? "";
        formData.set(`answer.${question.id}`, value);
        formData.set(`answer_label.${question.id}`, question.label);
        formData.set(`answer_type.${question.id}`, question.type);
      }

      if (resume) {
        formData.set("resume", resume);
      }

      const result = await submitJobApplication(jobId, formData);
      setIsSuccess(result.success);
      setMessage(
        result.success
          ? "Application submitted. We will review it as soon as possible."
          : result.error
      );

      if (result.success) {
        setPhone("");
        setAvailability("");
        setCoverLetter("");
        setResume(null);
        setConsent(false);
        setAnswers({});
        setLinkedinUrl("");
        setCurrentRole("");
        setCurrentEmployer("");
      }
    });
  }

  return (
    <Card className="border-border/60 p-6 shadow-sm">
      <h3 className="font-semibold text-foreground text-xl">
        Apply for this vacancy
      </h3>
      <p className="mt-2 text-muted-foreground text-sm">
        Submit your application with your contact details and a short cover
        letter.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="applicant_name">Full name</Label>
          <Input
            id="applicant_name"
            onChange={(event) => setName(event.target.value)}
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="applicant_phone">Phone number</Label>
          <Input
            id="applicant_phone"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+47 ..."
            value={phone}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover_letter">Cover letter</Label>
          <Textarea
            id="cover_letter"
            onChange={(event) => setCoverLetter(event.target.value)}
            placeholder="Tell BISO why you are applying."
            rows={6}
            value={coverLetter}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="availability">Interview availability</Label>
          <Textarea
            id="availability"
            onChange={(event) => setAvailability(event.target.value)}
            placeholder="Add times that usually work for interviews, one per line."
            rows={4}
            value={availability}
          />
          <p className="text-muted-foreground text-xs">
            This helps HR suggest interview times without long email threads.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resume">
            Resume {cvRequired ? "(required, PDF)" : "(optional, PDF)"}
          </Label>
          <Input
            accept="application/pdf"
            id="resume"
            onChange={(event) => setResume(event.target.files?.[0] ?? null)}
            required={cvRequired}
            type="file"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="linkedin_url">LinkedIn profile (optional)</Label>
          <Input
            id="linkedin_url"
            onChange={(event) => setLinkedinUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/your-handle"
            value={linkedinUrl}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="current_role">Current role (optional)</Label>
            <Input
              id="current_role"
              onChange={(event) => setCurrentRole(event.target.value)}
              placeholder="Student, Marketing intern, ..."
              value={currentRole}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current_employer">Current employer / school</Label>
            <Input
              id="current_employer"
              onChange={(event) => setCurrentEmployer(event.target.value)}
              placeholder="BI, BISO, ..."
              value={currentEmployer}
            />
          </div>
        </div>

        {customQuestions.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <p className="font-medium text-foreground text-sm">
              A few questions from the hiring team
            </p>
            {customQuestions.map((question) => (
              <div className="space-y-2" key={question.id}>
                <Label htmlFor={`question-${question.id}`}>
                  {question.label}
                  {question.required ? " *" : null}
                </Label>
                {question.type === "long_text" ? (
                  <Textarea
                    id={`question-${question.id}`}
                    onChange={(event) =>
                      setAnswer(question.id, event.target.value)
                    }
                    placeholder={question.help_text ?? ""}
                    required={question.required}
                    rows={4}
                    value={answers[question.id] ?? ""}
                  />
                ) : question.type === "select" ||
                  question.type === "multi_select" ? (
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    id={`question-${question.id}`}
                    multiple={question.type === "multi_select"}
                    onChange={(event) => {
                      if (question.type === "multi_select") {
                        const selected = Array.from(
                          event.target.selectedOptions
                        )
                          .map((option) => option.value)
                          .join(", ");
                        setAnswer(question.id, selected);
                      } else {
                        setAnswer(question.id, event.target.value);
                      }
                    }}
                    required={question.required}
                    value={answers[question.id] ?? ""}
                  >
                    {question.type === "select" ? (
                      <option value="">Choose...</option>
                    ) : null}
                    {(question.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : question.type === "boolean" ? (
                  <label
                    className="flex items-center gap-2 text-muted-foreground text-sm"
                    htmlFor={`question-${question.id}`}
                  >
                    <Checkbox
                      checked={answers[question.id] === "true"}
                      id={`question-${question.id}`}
                      onCheckedChange={(checked) =>
                        setAnswer(question.id, checked === true ? "true" : "")
                      }
                    />
                    Yes
                  </label>
                ) : question.type === "number" ? (
                  <Input
                    id={`question-${question.id}`}
                    onChange={(event) =>
                      setAnswer(question.id, event.target.value)
                    }
                    placeholder={question.help_text ?? ""}
                    required={question.required}
                    type="number"
                    value={answers[question.id] ?? ""}
                  />
                ) : (
                  <Input
                    id={`question-${question.id}`}
                    onChange={(event) =>
                      setAnswer(question.id, event.target.value)
                    }
                    placeholder={question.help_text ?? ""}
                    required={question.required}
                    value={answers[question.id] ?? ""}
                  />
                )}
                {question.help_text ? (
                  <p className="text-muted-foreground text-xs">
                    {question.help_text}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <label className="flex items-start gap-3" htmlFor="gdpr_consent">
          <Checkbox
            checked={consent}
            id="gdpr_consent"
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <span className="text-muted-foreground text-sm">
            I consent to BISO processing my application data for recruitment.
          </span>
        </label>

        {message ? (
          <div
            className={
              isSuccess ? "text-green-700 text-sm" : "text-red-600 text-sm"
            }
          >
            <p>{message}</p>
            {isSuccess ? (
              <Link className="mt-1 inline-block underline" href="/applications">
                View it in My applications
              </Link>
            ) : null}
          </div>
        ) : null}

        <Button
          className="w-full"
          disabled={isPending || !consent}
          type="submit"
        >
          {isPending ? "Submitting..." : "Submit application"}
        </Button>
      </form>
    </Card>
  );
}
