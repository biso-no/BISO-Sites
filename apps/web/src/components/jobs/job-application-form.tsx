"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { Textarea } from '@repo/ui/components/ui/textarea'
import { Checkbox } from '@repo/ui/components/ui/checkbox'
import { toast } from '@/lib/hooks/use-toast'
import { createJobApplication } from '@/app/actions/jobs'
import { Job } from '@/lib/types/job'
import { GDPRPrivacyNotice } from './gdpr-privacy-notice'

const applicationSchema = z.object({
  applicant_name: z.string().min(2, 'Name must be at least 2 characters'),
  applicant_email: z.string().email('Please enter a valid email address'),
  applicant_phone: z.string().optional(),
  cover_letter: z.string().optional(),
  gdpr_consent: z.boolean().refine(val => val === true, {
    message: 'You must consent to data processing to submit an application'
  }),
  resume: z.instanceof(File).optional()
})

type ApplicationFormData = z.infer<typeof applicationSchema>

interface JobApplicationFormProps {
  job: Job
  locale: 'en' | 'no'
}

export function JobApplicationForm({ job, locale }: JobApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      applicant_name: '',
      applicant_email: '',
      applicant_phone: '',
      cover_letter: '',
      gdpr_consent: false
    }
  })

  const onSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true)
    
    try {
      const result = await createJobApplication({
        job_id: job.$id,
        ...data
      })
      
      if (result) {
        setIsSubmitted(true)
        toast({
          title: locale === 'no' ? 'Søknad sendt!' : 'Application submitted!',
          description: locale === 'no' 
            ? 'Vi har mottatt din søknad og vil kontakte deg snart.'
            : 'We have received your application and will contact you soon.'
        })
      } else {
        throw new Error('Failed to submit application')
      }
    } catch (error) {
      console.error('Error submitting application:', error)
      toast({
        title: locale === 'no' ? 'Feil ved innsending' : 'Submission error',
        description: locale === 'no' 
          ? 'Det oppstod en feil ved innsending av søknaden. Prøv igjen.'
          : 'There was an error submitting your application. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <div className="text-green-600 text-4xl">✓</div>
            <h3 className="text-lg font-semibold">
              {locale === 'no' ? 'Søknad sendt!' : 'Application Submitted!'}
            </h3>
            <p className="text-muted-foreground">
              {locale === 'no' 
                ? 'Takk for din interesse. Vi vil gjennomgå søknaden din og kontakte deg snart.'
                : 'Thank you for your interest. We will review your application and contact you soon.'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <GDPRPrivacyNotice locale={locale} />
      
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === 'no' ? 'Søk på stillingen' : 'Apply for this Position'}
          </CardTitle>
        </CardHeader>
        <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="applicant_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{locale === 'no' ? 'Fullt navn' : 'Full Name'} *</FormLabel>
                    <FormControl>
                      <Input placeholder={locale === 'no' ? 'Ola Nordmann' : 'John Doe'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="applicant_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{locale === 'no' ? 'E-postadresse' : 'Email Address'} *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="applicant_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{locale === 'no' ? 'Telefonnummer (valgfritt)' : 'Phone Number (optional)'}</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+47 123 45 678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="resume"
              render={({ field: { onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>{locale === 'no' ? 'CV (valgfritt)' : 'Resume (optional)'}</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => onChange(e.target.files?.[0])}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cover_letter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{locale === 'no' ? 'Søknadsbrev (valgfritt)' : 'Cover Letter (optional)'}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={locale === 'no' 
                        ? 'Fortell oss hvorfor du er interessert i denne stillingen...'
                        : 'Tell us why you are interested in this position...'
                      }
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* GDPR Consent Section */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-3">
                {locale === 'no' ? 'Personvern og samtykke' : 'Privacy and Consent'}
              </h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {locale === 'no' 
                    ? 'Vi behandler dine personopplysninger i samsvar med GDPR og norsk personvernlovgivning:'
                    : 'We process your personal data in accordance with GDPR and Norwegian privacy legislation:'
                  }
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    {locale === 'no' 
                      ? 'Formål: Behandling av jobbsøknad og rekrutteringsevaluering'
                      : 'Purpose: Job application processing and recruitment evaluation'
                    }
                  </li>
                  <li>
                    {locale === 'no' 
                      ? 'Oppbevaringstid: 2 år fra søknadsdato'
                      : 'Retention period: 2 years from application date'
                    }
                  </li>
                  <li>
                    {locale === 'no' 
                      ? 'Dine rettigheter: Du kan be om innsyn, retting eller sletting av dine data'
                      : 'Your rights: You can request access, correction, or deletion of your data'
                    }
                  </li>
                </ul>
              </div>
              
              <FormField
                control={form.control}
                name="gdpr_consent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        {locale === 'no' 
                          ? 'Jeg samtykker til at mine personopplysninger behandles for formålene beskrevet ovenfor. *'
                          : 'I consent to my personal data being processed for the purposes described above. *'
                        }
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? (locale === 'no' ? 'Sender...' : 'Submitting...')
                  : (locale === 'no' ? 'Send søknad' : 'Submit Application')
                }
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
    </div>
  )
}
