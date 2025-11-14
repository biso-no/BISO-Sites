"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import dynamic from 'next/dynamic'
import { ChevronLeft, Languages, Building2, Save } from 'lucide-react'

import { Badge } from '@repo/ui/components/ui/badge'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { Switch } from '@repo/ui/components/ui/switch'
import { toast } from 'sonner'
import { Textarea } from '@repo/ui/components/ui/textarea'

import { createDepartment, updateDepartmentWithTranslations } from '@/lib/actions/departments'
import type { Departments, ContentTranslations } from '@repo/api/types/appwrite'

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false })

const departmentSchema = z.object({
  Id: z.string().min(1, 'Department ID is required').max(10, 'Max 10 characters'),
  Name: z.string().min(1, 'Department name is required').max(50, 'Max 50 characters'),
  campus_id: z.string().min(1, 'Campus is required'),
  type: z.string().min(1, 'Type is required'),
  logo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  active: z.boolean(),
  translations: z.object({
    en: z.object({
      title: z.string().min(1, 'English title is required'),
      description: z.string().min(1, 'English description is required'),
      short_description: z.string().optional(),
    }),
    no: z.object({
      title: z.string().min(1, 'Norwegian title is required'),
      description: z.string().min(1, 'Norwegian description is required'),
      short_description: z.string().optional(),
    }),
  }),
})

type DepartmentFormData = z.infer<typeof departmentSchema>

interface DepartmentEditorProps {
  department?: Departments
  campuses: Array<{ $id: string; name: string }>
  types: string[]
}

export default function DepartmentEditor({ 
  department, 
  campuses, 
  types 
}: DepartmentEditorProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [activeLocale, setActiveLocale] = React.useState<'en' | 'no'>('en')
  const editorRefEn = React.useRef<any>(null)
  const editorRefNo = React.useRef<any>(null)

  // Build translations map from department data
  const translationsMap = React.useMemo(() => {
    if (!department?.translations) {
      return {
        en: { title: '', description: '', short_description: '' },
        no: { title: '', description: '', short_description: '' }
      }
    }

    const en = department.translations.find(t => t.locale === 'en')
    const no = department.translations.find(t => t.locale === 'no')

    return {
      en: {
        title: en?.title || '',
        description: en?.description || '',
        short_description: en?.short_description || ''
      },
      no: {
        title: no?.title || '',
        description: no?.description || '',
        short_description: no?.short_description || ''
      }
    }
  }, [department])

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      Id: department?.Id || '',
      Name: department?.Name || '',
      campus_id: department?.campus_id || '',
      type: department?.type || '',
      logo: department?.logo || '',
      active: department?.active ?? true,
      translations: translationsMap
    },
  })

  const onSubmit = async (data: DepartmentFormData) => {
    setIsSubmitting(true)
    try {
      if (department) {
        // Update existing department
        const translations = [
          {
            id: department.translations?.find(t => t.locale === 'en')?.$id,
            locale: 'en' as const,
            ...data.translations.en
          },
          {
            id: department.translations?.find(t => t.locale === 'no')?.$id,
            locale: 'no' as const,
            ...data.translations.no
          }
        ]

        await updateDepartmentWithTranslations(
          department.$id,
          {
            Name: data.Name,
            campus_id: data.campus_id,
            type: data.type,
            logo: data.logo || null,
            active: data.active
          },
          translations
        )

        toast.success('Department updated successfully!')
      } else {
        // Create new department
        await createDepartment({
          Id: data.Id,
          Name: data.Name,
          campus_id: data.campus_id,
          type: data.type,
          logo: data.logo || undefined,
          active: data.active,
          translations: [
            { locale: 'en', ...data.translations.en },
            { locale: 'no', ...data.translations.no }
          ]
        })

        toast.success('Department created successfully!')
      }

      router.push('/admin/units')
      router.refresh()
    } catch (error) {
      console.error('Error saving department:', error)
      toast.error('Failed to save department')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/units')}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Units
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {department ? 'Edit Department' : 'Create Department'}
            </h1>
            <p className="text-muted-foreground">
              {department ? 'Update department information and translations' : 'Add a new department with multi-language support'}
            </p>
          </div>
        </div>
        <Badge variant={department ? 'secondary' : 'default'}>
          <Building2 className="w-3 h-3 mr-1" />
          {department ? 'Editing' : 'New'}
        </Badge>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Core department details and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="Id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department ID</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., BI" 
                          maxLength={10}
                          disabled={!!department}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Unique identifier (max 10 chars, cannot be changed after creation)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Business Intelligence" 
                          maxLength={50}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Internal name (max 50 chars)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="campus_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campus</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select campus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {campuses.map((campus) => (
                            <SelectItem key={campus.$id} value={campus.$id}>
                              {campus.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {types.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                          <SelectItem value="committee">Committee</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="logo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input 
                        type="url"
                        placeholder="https://example.com/logo.png" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Direct URL to department logo image
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Inactive departments won't be visible to users
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Translations Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Translations
              </CardTitle>
              <CardDescription>
                Provide content in both English and Norwegian
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeLocale} onValueChange={(v) => setActiveLocale(v as 'en' | 'no')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="en">English</TabsTrigger>
                  <TabsTrigger value="no">Norwegian</TabsTrigger>
                </TabsList>

                {/* English Translation */}
                <TabsContent value="en" className="space-y-4 mt-6">
                  <FormField
                    control={form.control}
                    name="translations.en.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title (English)</FormLabel>
                        <FormControl>
                          <Input placeholder="Department title in English" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="translations.en.short_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Description (English)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description for hero sections and cards"
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Used in hero sections and card previews
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="translations.en.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Description (English)</FormLabel>
                        <FormControl>
                          <JoditEditor
                            ref={editorRefEn}
                            value={field.value}
                            onBlur={(newContent) => field.onChange(newContent)}
                            config={{
                              readonly: false,
                              height: 400,
                              placeholder: 'Detailed department description in English'
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Norwegian Translation */}
                <TabsContent value="no" className="space-y-4 mt-6">
                  <FormField
                    control={form.control}
                    name="translations.no.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tittel (Norsk)</FormLabel>
                        <FormControl>
                          <Input placeholder="Avdelingstittel på norsk" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="translations.no.short_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kort beskrivelse (Norsk)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Kort beskrivelse for hero-seksjoner og kort"
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Brukes i hero-seksjoner og kortforhåndsvisninger
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="translations.no.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full beskrivelse (Norsk)</FormLabel>
                        <FormControl>
                          <JoditEditor
                            ref={editorRefNo}
                            value={field.value}
                            onBlur={(newContent) => field.onChange(newContent)}
                            config={{
                              readonly: false,
                              height: 400,
                              placeholder: 'Detaljert avdelingsbeskrivelse på norsk'
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/units')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : department ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

