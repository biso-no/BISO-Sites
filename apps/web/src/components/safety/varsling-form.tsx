"use client";

import type { Campus, VarslingSettings } from "@repo/api/types/appwrite";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getCampuses } from "@/app/actions/campus";
import {
  getVarslingSettings,
  submitVarslingCase,
} from "@/app/actions/varsling";

export function VarslingForm() {
  const t = useTranslations("varsling");
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [varslingSettings, setVarslingSettings] = useState<VarslingSettings[]>(
    []
  );
  const [selectedCampus, setSelectedCampus] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
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
    if (selectedCampus) {
      const fetchSettings = async () => {
        const settings = await getVarslingSettings(selectedCampus);
        setVarslingSettings(settings);
        setSelectedRole(""); // Reset role selection
      };
      fetchSettings();
    }
  }, [selectedCampus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(selectedCampus && selectedRole && caseDescription.trim())) {
      setSubmitStatus({
        type: "error",
        message: t("form.submit.validation.required"),
      });
      return;
    }

    const selectedSetting = varslingSettings.find(
      (s) => s.role_name === selectedRole
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
        campus_id: selectedCampus,
        role_name: selectedRole,
        recipient_email: selectedSetting.email,
        submitter_email: email.trim() || undefined,
        case_description: caseDescription.trim(),
        submission_type: submissionType,
      });

      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: t("form.submit.success"),
        });

        // Reset form
        setSelectedCampus("");
        setSelectedRole("");
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
        <Label>{t("form.fields.submissionType.label")} *</Label>
        <Select
          onValueChange={(value: "harassment" | "witness" | "other") =>
            setSubmissionType(value)
          }
          value={submissionType}
        >
          <SelectTrigger>
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
        <Label>{t("form.fields.campus.label")} *</Label>
        <Select onValueChange={setSelectedCampus} value={selectedCampus}>
          <SelectTrigger>
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

      {/* Role Selection */}
      {selectedCampus && (
        <div className="space-y-2">
          <Label>{t("form.fields.receiver.label")} *</Label>
          <Select onValueChange={setSelectedRole} value={selectedRole}>
            <SelectTrigger>
              <SelectValue
                placeholder={t("form.fields.receiver.placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {varslingSettings.map((setting) => (
                <SelectItem key={setting.$id} value={setting.role_name}>
                  {setting.role_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Email (Optional) */}
      <div className="space-y-2">
        <Label>{t("form.fields.email.label")}</Label>
        <Input
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("form.fields.email.placeholder")}
          type="email"
          value={email}
        />
        <p className="text-muted-foreground text-sm">
          {t("form.fields.email.description")}
        </p>
      </div>

      {/* Case Description */}
      <div className="space-y-2">
        <Label>{t("form.fields.caseDescription.label")} *</Label>
        <Textarea
          className="resize-none"
          onChange={(e) => setCaseDescription(e.target.value)}
          placeholder={t("form.fields.caseDescription.placeholder")}
          rows={6}
          value={caseDescription}
        />
      </div>

      {/* Submit Status */}
      {submitStatus && (
        <Alert
          className={
            submitStatus.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-destructive/30 bg-destructive/10"
          }
        >
          <div className="flex items-center gap-2">
            {submitStatus.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            <AlertDescription
              className={
                submitStatus.type === "success"
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-destructive"
              }
            >
              {submitStatus.message}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        className="w-full"
        disabled={
          isSubmitting ||
          !selectedCampus ||
          !selectedRole ||
          !caseDescription.trim()
        }
        size="lg"
        type="submit"
        variant="gradient"
      >
        {isSubmitting ? t("form.submit.submitting") : t("form.submit.button")}
      </Button>
    </form>
  );
}
