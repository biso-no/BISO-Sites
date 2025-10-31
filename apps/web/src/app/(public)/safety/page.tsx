"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Shield, AlertTriangle, Eye, HelpCircle, CheckCircle, Mail, User } from "lucide-react";
import { getCampuses } from "@/app/actions/campus";
import { getVarslingSettings, submitVarslingCase, type VarslingSettings } from "@/app/actions/varsling";
import { Campus } from "@/lib/types/campus";
import Link from "next/link";

export default function SafetyPage() {
  const t = useTranslations('varsling');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [varslingSettings, setVarslingSettings] = useState<VarslingSettings[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [submissionType, setSubmissionType] = useState<'harassment' | 'witness' | 'other'>('other');
  const [email, setEmail] = useState<string>("");
  const [caseDescription, setCaseDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    
    if (!selectedCampus || !selectedRole || !caseDescription.trim()) {
      setSubmitStatus({
        type: 'error',
        message: t('form.submit.validation.required')
      });
      return;
    }

    const selectedSetting = varslingSettings.find(s => s.role_name === selectedRole);
    if (!selectedSetting) {
      setSubmitStatus({
        type: 'error',
        message: t('form.submit.validation.noContact')
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
        submission_type: submissionType
      });

      if (result.success) {
        setSubmitStatus({
          type: 'success',
          message: t('form.submit.success')
        });
        
        // Reset form
        setSelectedCampus("");
        setSelectedRole("");
        setSubmissionType('other');
        setEmail("");
        setCaseDescription("");
        setVarslingSettings([]);
      } else {
        setSubmitStatus({
          type: 'error',
          message: result.error || t('form.submit.error')
        });
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: t('form.submit.error')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Shield className="h-8 w-8 text-primary-60" />
          <h1 className="text-4xl font-bold text-primary-90">{t('title')}</h1>
        </div>
        <h2 className="text-xl font-semibold text-primary-80">{t('subtitle')}</h2>
        <p className="text-lg text-primary-70 max-w-3xl mx-auto">
          {t('description')}
        </p>
      </div>

      {/* Information Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-900">{t('infoCards.harassment.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-orange-700">
              {t('infoCards.harassment.description')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900">{t('infoCards.witness.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-blue-700">
              {t('infoCards.witness.description')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-purple-900">{t('infoCards.other.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-purple-700">
              {t('infoCards.other.description')}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Varsling Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.title')}</CardTitle>
          <CardDescription>
            {t('form.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Submission Type */}
            <div className="space-y-2">
              <Label>{t('form.fields.submissionType.label')} *</Label>
              <Select value={submissionType} onValueChange={(value: 'harassment' | 'witness' | 'other') => setSubmissionType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('form.fields.submissionType.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harassment">{t('form.submissionTypes.harassment')}</SelectItem>
                  <SelectItem value="witness">{t('form.submissionTypes.witness')}</SelectItem>
                  <SelectItem value="other">{t('form.submissionTypes.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campus Selection */}
            <div className="space-y-2">
              <Label>{t('form.fields.campus.label')} *</Label>
              <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger>
                  <SelectValue placeholder={t('form.fields.campus.placeholder')} />
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
                <Label>{t('form.fields.receiver.label')} *</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.fields.receiver.placeholder')} />
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
              <Label>{t('form.fields.email.label')}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('form.fields.email.placeholder')}
              />
              <p className="text-sm text-primary-60">
                {t('form.fields.email.description')}
              </p>
            </div>

            {/* Case Description */}
            <div className="space-y-2">
              <Label>{t('form.fields.caseDescription.label')} *</Label>
              <Textarea
                value={caseDescription}
                onChange={(e) => setCaseDescription(e.target.value)}
                placeholder={t('form.fields.caseDescription.placeholder')}
                rows={6}
                className="resize-none"
              />
            </div>

            {/* Submit Status */}
            {submitStatus && (
              <Alert className={submitStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {submitStatus.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={submitStatus.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                    {submitStatus.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !selectedCampus || !selectedRole || !caseDescription.trim()}
            >
              {isSubmitting ? t('form.submit.submitting') : t('form.submit.button')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* What is Whistleblowing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary-60" />
            {t('whatIsWhistleblowing.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-primary max-w-none">
            <p className="text-primary-70 leading-relaxed whitespace-pre-line">
              {t('whatIsWhistleblowing.content')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Code of Conduct Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-60" />
            {t('codeOfConduct.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-primary-70 leading-relaxed">
              {t('codeOfConduct.purpose')}
            </p>
            <ul className="space-y-2">
              {['rules.0', 'rules.1', 'rules.2', 'rules.3', 'rules.4'].map((key, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-primary-70">{t(`codeOfConduct.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Anonymous Report Section */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-900">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            {t('anonymousReport.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-800 leading-relaxed whitespace-pre-line">
            {t('anonymousReport.content')}
          </p>
        </CardContent>
      </Card>

      {/* Sending Report Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary-60" />
            {t('sendingReport.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-primary-70 leading-relaxed whitespace-pre-line">
            {t('sendingReport.content')}
          </p>
        </CardContent>
      </Card>

      {/* Contact Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-60" />
            {t('contact.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-primary-70">
              {t('contact.description')}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {['contacts.0', 'contacts.1', 'contacts.2'].map((key, index) => (
                <div key={index} className="p-4 border border-primary-20 rounded-lg bg-primary-5">
                  <div className="font-semibold text-primary-90">{t(`contact.${key}.role`)}</div>
                  <a 
                    href={`mailto:${t(`contact.${key}.email`)}`}
                    className="text-primary-60 hover:text-primary-80 hover:underline"
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
          <h3 className="font-semibold text-primary-90 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('privacy.title')}
          </h3>
          <div className="text-sm text-primary-70 space-y-3">
            {['points.0', 'points.1', 'points.2', 'points.3'].map((key, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p>
                  {index === 3 ? (
                    <>
                      {t(`privacy.${key}`).split('personvernerklæring')[0]}
                      <Link href={t('privacy.privacyLink')} className="text-primary-60 hover:underline">
                        {t(`privacy.${key}`).includes('personvernerklæring') ? 'personvernerklæring' : 'privacy policy'}
                      </Link>
                      {t(`privacy.${key}`).split('personvernerklæring')[1] || t(`privacy.${key}`).split('privacy policy')[1]}
                    </>
                  ) : (
                    t(`privacy.${key}`)
                  )}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
