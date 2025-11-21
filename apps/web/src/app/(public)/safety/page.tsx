"use client";

import type { Campus, VarslingSettings } from "@repo/api/types/appwrite";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
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
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  HelpCircle,
  Mail,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getCampuses } from "@/app/actions/campus";
import {
  getVarslingSettings,
  submitVarslingCase,
} from "@/app/actions/varsling";

export default function SafetyPage() {
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
    <div className="mx-auto max-w-6xl space-y-12">
      {/* Header */}
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <Shield className="h-8 w-8 text-primary-60" />
          <h1 className="font-bold text-4xl text-primary-90">{t("title")}</h1>
        </div>
        <h2 className="font-semibold text-primary-80 text-xl">
          {t("subtitle")}
        </h2>
        <p className="mx-auto max-w-3xl text-lg text-primary-70">
          {t("description")}
        </p>
      </div>

      {/* Information Cards */}
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-900">
                {t("infoCards.harassment.title")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-orange-700">
              {t("infoCards.harassment.description")}
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900">
                {t("infoCards.witness.title")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-blue-700">
              {t("infoCards.witness.description")}
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-purple-900">
                {t("infoCards.other.title")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-purple-700">
              {t("infoCards.other.description")}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Varsling Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("form.title")}</CardTitle>
          <CardDescription>{t("form.description")}</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <SelectValue
                    placeholder={t("form.fields.campus.placeholder")}
                  />
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
              <p className="text-primary-60 text-sm">
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
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }
              >
                <div className="flex items-center gap-2">
                  {submitStatus.type === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription
                    className={
                      submitStatus.type === "success"
                        ? "text-green-800"
                        : "text-red-800"
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
              type="submit"
            >
              {isSubmitting
                ? t("form.submit.submitting")
                : t("form.submit.button")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* What is Whistleblowing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary-60" />
            {t("whatIsWhistleblowing.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-primary max-w-none">
            <p className="whitespace-pre-line text-primary-70 leading-relaxed">
              {t("whatIsWhistleblowing.content")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Code of Conduct Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-60" />
            {t("codeOfConduct.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-primary-70 leading-relaxed">
              {t("codeOfConduct.purpose")}
            </p>
            <ul className="space-y-2">
              {["rules.0", "rules.1", "rules.2", "rules.3", "rules.4"].map(
                (key, index) => (
                  <li className="flex items-start gap-3" key={index}>
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-primary-70">
                      {t(`codeOfConduct.${key}`)}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Anonymous Report Section */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-900">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            {t("anonymousReport.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-yellow-800 leading-relaxed">
            {t("anonymousReport.content")}
          </p>
        </CardContent>
      </Card>

      {/* Sending Report Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary-60" />
            {t("sendingReport.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-primary-70 leading-relaxed">
            {t("sendingReport.content")}
          </p>
        </CardContent>
      </Card>

      {/* Contact Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-60" />
            {t("contact.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-primary-70">{t("contact.description")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {["contacts.0", "contacts.1", "contacts.2"].map((key, index) => (
                <div
                  className="rounded-lg border border-primary-20 bg-primary-5 p-4"
                  key={index}
                >
                  <div className="font-semibold text-primary-90">
                    {t(`contact.${key}.role`)}
                  </div>
                  <a
                    className="text-primary-60 hover:text-primary-80 hover:underline"
                    href={`mailto:${t(`contact.${key}.email`)}`}
                  >
                    {t(`contact.${key}.email`)}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <Card className="border-primary-20 bg-primary-5">
        <CardContent className="pt-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-primary-90">
            <Shield className="h-5 w-5" />
            {t("privacy.title")}
          </h3>
          <div className="space-y-3 text-primary-70 text-sm">
            {["points.0", "points.1", "points.2", "points.3"].map(
              (key, index) => (
                <div className="flex items-start gap-3" key={index}>
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <p>
                    {index === 3 ? (
                      <>
                        {t(`privacy.${key}`).split("personvernerklæring")[0]}
                        <Link
                          className="text-primary-60 hover:underline"
                          href={t("privacy.privacyLink")}
                        >
                          {t(`privacy.${key}`).includes("personvernerklæring")
                            ? "personvernerklæring"
                            : "privacy policy"}
                        </Link>
                        {t(`privacy.${key}`).split("personvernerklæring")[1] ||
                          t(`privacy.${key}`).split("privacy policy")[1]}
                      </>
                    ) : (
                      t(`privacy.${key}`)
                    )}
                  </p>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
