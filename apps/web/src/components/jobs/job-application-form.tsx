"use client";

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
}

export function JobApplicationForm({
  applicantEmail = "",
  applicantName = "",
  cvRequired,
  isAuthenticated,
  jobId,
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
          <p
            className={
              isSuccess ? "text-green-700 text-sm" : "text-red-600 text-sm"
            }
          >
            {message}
          </p>
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
