"use client";

import type { Campus, VarslingSettings } from "@repo/api/types/appwrite";
import { trackEvent } from "@repo/shared/utils/analytics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle, CheckCircle, Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { getCampuses } from "@/app/actions/campus";
import {
  getVarslingSettings,
  submitVarslingCase,
} from "@/app/actions/varsling";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

interface EscalationContact {
  email: string;
  role: string;
}

const labelClass = "type-body-sm block font-semibold text-ink";
const helpClass = "type-body-sm text-ink-muted";
const fieldClass =
  "type-body w-full rounded-biso-sm border border-edge bg-surface px-3 py-2 text-ink transition-colors placeholder:text-ink-muted hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50";
/** The shared trigger, on the design system's surface and edge in both themes. */
const triggerClass =
  "w-full rounded-biso-sm border-edge bg-surface px-3 text-base text-ink shadow-none hover:border-ink-accent data-placeholder:text-ink-muted data-[size=default]:h-11 dark:bg-surface dark:hover:bg-surface [&_svg:not([class*='text-'])]:text-ink-muted";
const linkClass =
  "rounded-biso-sm text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * Read-only escalation contacts (board chair / HR / general manager) shown when
 * a campus has no configured varsling recipients, so the page never leaves a
 * reporter with an empty dropdown and a dead submit button.
 */
function EscalationContacts({ contacts }: { contacts: EscalationContact[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {contacts.map((contact) => (
        <li
          className="type-body-sm flex flex-wrap items-center gap-2"
          key={contact.email}
        >
          <Mail aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <span className="font-semibold text-ink">{contact.role}</span>
          <a
            className={`${linkClass} break-all`}
            href={`mailto:${contact.email}`}
          >
            {contact.email}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The whistleblowing form — the one interactive island on /safety.
 *
 * Submits through `submitVarslingCase`, which resolves the recipient from the
 * chosen `varsling_settings` row server-side, delivers over SMTP and
 * rate-limits per source. The amber notice and the green confirmation are
 * status colours, drawn with the design system's `warning` / `success` tokens.
 */
export function VarslingForm() {
  const t = useTranslations("varsling");
  const submissionTypeId = useId();
  const campusId = useId();
  const receiverId = useId();
  const emailId = useId();
  const emailHelpId = useId();
  const descriptionId = useId();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [varslingSettings, setVarslingSettings] = useState<VarslingSettings[]>(
    []
  );
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<string>("");
  const [selectedSettingId, setSelectedSettingId] = useState<string>("");
  const [submissionType, setSubmissionType] = useState<
    "harassment" | "witness" | "other"
  >("other");
  const [email, setEmail] = useState<string>("");
  const [caseDescription, setCaseDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const escalationContacts = t.raw("contact.contacts") as EscalationContact[];

  // Load campuses on mount
  useEffect(() => {
    const fetchCampuses = async () => {
      const campusData = await getCampuses();
      setCampuses(campusData);
    };
    fetchCampuses();
  }, []);

  // Load varsling settings when campus is selected
  useEffect(() => {
    if (!selectedCampus) {
      setVarslingSettings([]);
      setSelectedSettingId("");
      return;
    }
    let cancelled = false;
    setIsLoadingSettings(true);
    setSelectedSettingId("");
    const fetchSettings = async () => {
      const settings = await getVarslingSettings(selectedCampus);
      if (cancelled) {
        return;
      }
      setVarslingSettings(settings);
      setIsLoadingSettings(false);
    };
    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, [selectedCampus]);

  const hasContacts = varslingSettings.length > 0;
  const showEmptyState =
    Boolean(selectedCampus) && !isLoadingSettings && !hasContacts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(selectedCampus && selectedSettingId && caseDescription.trim())) {
      setSubmitStatus({
        type: "error",
        message: t("form.submit.validation.required"),
      });
      return;
    }

    const selectedSetting = varslingSettings.find(
      (s) => s.$id === selectedSettingId
    );
    if (!selectedSetting) {
      setSubmitStatus({
        type: "error",
        message: t("form.submit.validation.noContact"),
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const result = await submitVarslingCase({
        setting_id: selectedSetting.$id,
        submitter_email: email.trim() || undefined,
        case_description: caseDescription.trim(),
        submission_type: submissionType,
      });

      if (result.success) {
        // Non-PII: only the submission category, never campus/role/identity, so
        // a sensitive whistleblowing report can't be correlated to a reporter.
        trackEvent("varsling_submit", { submissionType });
        setSubmitStatus({
          type: "success",
          message: t("form.submit.success"),
        });

        // Reset form
        setSelectedCampus("");
        setSelectedSettingId("");
        setSubmissionType("other");
        setEmail("");
        setCaseDescription("");
        setVarslingSettings([]);
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || t("form.submit.error"),
        });
      }
    } catch (_error) {
      setSubmitStatus({
        type: "error",
        message: t("form.submit.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Submission Type */}
      <div className="space-y-2">
        {/* RD-031: these three labels had no `htmlFor` and the triggers no
            `id`, so axe reported `button-name` (critical) — a screen reader
            announced three unlabelled buttons on the reporting form. */}
        <label className={labelClass} htmlFor={submissionTypeId}>
          {t("form.fields.submissionType.label")} *
        </label>
        <Select
          onValueChange={(value: "harassment" | "witness" | "other") =>
            setSubmissionType(value)
          }
          value={submissionType}
        >
          <SelectTrigger className={triggerClass} id={submissionTypeId}>
            <SelectValue
              placeholder={t("form.fields.submissionType.placeholder")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="harassment">
              {t("form.submissionTypes.harassment")}
            </SelectItem>
            <SelectItem value="witness">
              {t("form.submissionTypes.witness")}
            </SelectItem>
            <SelectItem value="other">
              {t("form.submissionTypes.other")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campus Selection */}
      <div className="space-y-2">
        <label className={labelClass} htmlFor={campusId}>
          {t("form.fields.campus.label")} *
        </label>
        <Select onValueChange={setSelectedCampus} value={selectedCampus}>
          <SelectTrigger className={triggerClass} id={campusId}>
            <SelectValue placeholder={t("form.fields.campus.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {campuses.map((campus) => (
              <SelectItem key={campus.$id} value={campus.$id}>
                {campus.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Receiver Selection */}
      {selectedCampus && (
        <div className="space-y-2">
          <label className={labelClass} htmlFor={receiverId}>
            {t("form.fields.receiver.label")} *
          </label>
          {isLoadingSettings && (
            <p className={`${helpClass} flex items-center gap-2`}>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {t("form.fields.receiver.empty.loading")}
            </p>
          )}
          {!isLoadingSettings && hasContacts && (
            <Select
              onValueChange={setSelectedSettingId}
              value={selectedSettingId}
            >
              <SelectTrigger className={triggerClass} id={receiverId}>
                <SelectValue
                  placeholder={t("form.fields.receiver.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {varslingSettings.map((setting) => (
                  <SelectItem key={setting.$id} value={setting.$id}>
                    {setting.role_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showEmptyState && (
            <div
              className="flex items-start gap-3 rounded-biso-md border border-warning/30 bg-warning/10 p-4"
              role="status"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-warning"
              />
              <div className="type-body-sm min-w-0 text-ink">
                <p className="font-semibold">
                  {t("form.fields.receiver.empty.title")}
                </p>
                <p className="mt-1">
                  {t("form.fields.receiver.empty.description")}
                </p>
                <EscalationContacts contacts={escalationContacts} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email (Optional) */}
      <div className="space-y-2">
        <label className={labelClass} htmlFor={emailId}>
          {t("form.fields.email.label")}
        </label>
        <input
          aria-describedby={emailHelpId}
          autoComplete="email"
          className={cn(fieldClass, "h-11")}
          id={emailId}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("form.fields.email.placeholder")}
          type="email"
          value={email}
        />
        <p className={helpClass} id={emailHelpId}>
          {t("form.fields.email.description")}
        </p>
      </div>

      {/* Case Description */}
      <div className="space-y-2">
        <label className={labelClass} htmlFor={descriptionId}>
          {t("form.fields.caseDescription.label")} *
        </label>
        <textarea
          aria-required="true"
          className={cn(fieldClass, "resize-y")}
          id={descriptionId}
          onChange={(e) => setCaseDescription(e.target.value)}
          placeholder={t("form.fields.caseDescription.placeholder")}
          rows={6}
          value={caseDescription}
        />
      </div>

      {/* Submit Status */}
      {submitStatus && (
        <div
          className={cn(
            "type-body-sm flex items-start gap-3 rounded-biso-md border p-4",
            submitStatus.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          )}
          role={submitStatus.type === "success" ? "status" : "alert"}
        >
          {submitStatus.type === "success" ? (
            <CheckCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
          ) : (
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
          )}
          <p className="min-w-0">{submitStatus.message}</p>
        </div>
      )}

      {/* Submit Button */}
      {!showEmptyState && (
        <button
          className={cn(
            statusPanelPrimaryAction,
            "w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
          )}
          disabled={
            isSubmitting ||
            !selectedCampus ||
            !selectedSettingId ||
            !caseDescription.trim()
          }
          type="submit"
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {isSubmitting ? t("form.submit.submitting") : t("form.submit.button")}
        </button>
      )}
    </form>
  );
}
