"use client"

import * as React from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/lib/hooks/use-toast'
import { createJob, updateJob, translateJobContent } from '@/app/actions/jobs'
import { Languages, Wand2 } from 'lucide-react'

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false })

const formSchema = z.object({
  slug: z.string().min(1),
  status: z.enum(['draft', 'published', 'closed']).default('draft'),
  campus_id: z.string().min(1),
  department_id: z.string().optional(),
  type: z.string().optional(),
  application_deadline: z.string().optional(),
  start_date: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  apply_url: z.string().url().optional(),
  image: z.string().optional(),
  // Translations
  en_title: z.string().optional(),
  en_description: z.string().optional(),
  no_title: z.string().optional(),
  no_description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function JobEditor({ 
  job, 
  campuses, 
  departments 
}: { 
  job?: any, 
  campuses?: { $id: string; name: string }[], 
  departments?: { $id: string; Name: string; campus_id?: string }[] 
}) {
  const router = useRouter()
  const [selectedCampus, setSelectedCampus] = React.useState<string>(job?.campus_id || '')
  const [isTranslating, setIsTranslating] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'en' | 'no'>('en')
  
  const filteredDepartments = React.useMemo(() => {
    if (!departments) return []
    if (!selectedCampus) return departments
    return departments.filter(d => d.campus_id === selectedCampus)
  }, [departments, selectedCampus])

  // Extract translations from job data using Appwrite's nested relationships
  const getTranslation = (locale: 'en' | 'no') => {
    return job?.translation_refs?.find((t: any) => t.locale === locale)
  }

  const metadata = job?.metadata ? JSON.parse(job.metadata) : {}

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: job?.slug || '',
      status: job?.status || 'draft',
      campus_id: job?.campus_id || '',
      department_id: job?.department_id || '',
      type: metadata.type || '',
      application_deadline: metadata.application_deadline || '',
      start_date: metadata.start_date || '',
      contact_name: metadata.contact_name || '',
      contact_email: metadata.contact_email || '',
      apply_url: metadata.apply_url || '',
      image: metadata.image || '',
      en_title: getTranslation('en')?.title || '',
      en_description: getTranslation('en')?.description || '',
      no_title: getTranslation('no')?.title || '',
      no_description: getTranslation('no')?.description || '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const jobData = {
        slug: values.slug,
        status: values.status,
        campus_id: values.campus_id,
        department_id: values.department_id,
        metadata: {
          type: values.type,
          application_deadline: values.application_deadline,
          start_date: values.start_date,
          contact_name: values.contact_name,
          contact_email: values.contact_email,
          apply_url: values.apply_url,
          image: values.image,
        },
        translations: {
          ...(values.en_title && values.en_description && {
            en: {
              title: values.en_title,
              description: values.en_description
            }
          }),
          ...(values.no_title && values.no_description && {
            no: {
              title: values.no_title,
              description: values.no_description
            }
          })
        }
      }

      if (job?.$id) {
        await updateJob(job.$id, jobData)
        toast({ title: 'Job updated' })
      } else {
        await createJob(jobData)
        toast({ title: 'Job created' })
        router.push('/admin/jobs')
      }
    } catch (e) {
      console.error(e)
      toast({ title: 'Failed to save job', variant: 'destructive' })
    }
  }

  const handleTranslate = async (fromLocale: 'en' | 'no', toLocale: 'en' | 'no') => {
    if (!job?.$id) {
      toast({ 
        title: 'Save first', 
        description: 'Please save the job before translating',
        variant: 'destructive' 
      })
      return
    }

    setIsTranslating(true)
    
    try {
      const translation = await translateJobContent(job.$id, fromLocale, toLocale)
      
      if (translation) {
        // Update form with translated content
        form.setValue(`${toLocale}_title`, translation.title)
        form.setValue(`${toLocale}_description`, translation.description)
        
        toast({ 
          title: 'Translation completed',
          description: `Content translated to ${toLocale === 'en' ? 'English' : 'Norwegian'}`
        })
        
        // Switch to the translated tab
        setActiveTab(toLocale)
      } else {
        throw new Error('Translation failed')
      }
    } catch (error) {
      console.error('Translation error:', error)
      toast({ 
        title: 'Translation failed', 
        description: 'Could not translate content. Please try again.',
        variant: 'destructive' 
      })
    } finally {
      setIsTranslating(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Basic Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="slug" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="unique-job-slug" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="campus_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campus</FormLabel>
                        <Select value={field.value} onValueChange={(v) => { field.onChange(v); setSelectedCampus(v) }}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select campus" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {campuses?.map(c => (
                              <SelectItem key={c.$id} value={c.$id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="department_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredDepartments.map((d) => (
                              <SelectItem key={d.$id} value={d.$id}>{d.Name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Metadata Fields */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Job Details</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Board Position, Committee" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="application_deadline" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Deadline</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="contact_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact person" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contact_email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@biso.no" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Translation Tabs */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Content & Translations</h3>
                    {job?.$id && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleTranslate('en', 'no')}
                          disabled={isTranslating || !form.watch('en_title')}
                        >
                          <Wand2 className="h-4 w-4 mr-2" />
                          EN → NO
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleTranslate('no', 'en')}
                          disabled={isTranslating || !form.watch('no_title')}
                        >
                          <Wand2 className="h-4 w-4 mr-2" />
                          NO → EN
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'en' | 'no')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="en" className="flex items-center gap-2">
                        🇬🇧 English
                        {form.watch('en_title') && <Badge variant="secondary" className="text-xs">✓</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="no" className="flex items-center gap-2">
                        🇳🇴 Norwegian
                        {form.watch('no_title') && <Badge variant="secondary" className="text-xs">✓</Badge>}
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="en" className="space-y-4">
                      <FormField control={form.control} name="en_title" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title (English)</FormLabel>
                          <FormControl>
                            <Input placeholder="Job title in English" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="en_description" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (English)</FormLabel>
                          <FormControl>
                            <JoditEditor 
                              value={field.value || ''} 
                              config={{ height: 400 }} 
                              onBlur={field.onBlur} 
                              onChange={(val: string) => field.onChange(val)} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </TabsContent>
                    
                    <TabsContent value="no" className="space-y-4">
                      <FormField control={form.control} name="no_title" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tittel (Norsk)</FormLabel>
                          <FormControl>
                            <Input placeholder="Stillingstittel på norsk" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="no_description" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Beskrivelse (Norsk)</FormLabel>
                          <FormControl>
                            <JoditEditor 
                              value={field.value || ''} 
                              config={{ height: 400 }} 
                              onBlur={field.onBlur} 
                              onChange={(val: string) => field.onChange(val)} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isTranslating}>
                    {job?.$id ? 'Update Job' : 'Create Job'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      
      {/* Preview Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              Translation Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">English</span>
              {form.watch('en_title') ? (
                <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>
              ) : (
                <Badge variant="secondary">Missing</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Norwegian</span>
              {form.watch('no_title') ? (
                <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>
              ) : (
                <Badge variant="secondary">Missing</Badge>
              )}
            </div>
            
            {job?.$id && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Save changes before using AI translation
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Quick Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="font-medium">
                {activeTab === 'en' ? form.watch('en_title') : form.watch('no_title') || 'No title'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {form.watch('campus_id') && campuses?.find(c => c.$id === form.watch('campus_id'))?.name}
                {form.watch('type') && ` • ${form.watch('type')}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}