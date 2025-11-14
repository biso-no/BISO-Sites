"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import dynamic from 'next/dynamic'
import { ChevronLeft, Languages, Building2, Save, X, Sparkles } from 'lucide-react'

import { Badge } from '@repo/ui/components/ui/badge'
import { Button } from '@repo/ui/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { Switch } from '@repo/ui/components/ui/switch'
import { toast } from 'sonner'
import { Textarea } from '@repo/ui/components/ui/textarea'

import { createDepartment, updateDepartmentWithTranslations } from '@/lib/actions/departments'
import type { Departments, ContentTranslations } from '@repo/api/types/appwrite'
import { GlassCard } from '@/components/shared/glass-card'
import { DepartmentEditorSidebar } from '@/components/units/department-editor-sidebar'
import { HeroUploadPreview } from '@/components/units/hero-upload-preview'
import { cn } from '@repo/ui/lib/utils'

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false })

const departmentSchema = z.object({
  Id: z.string().min(1, 'Department ID is required').max(10, 'Max 10 characters'),
  Name: z.string().min(1, 'Department name is required').max(50, 'Max 50 characters'),
  campus_id: z.string().min(1, 'Campus is required'),
  type: z.string().min(1, 'Type is required'),
  logo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  hero: z.string().url('Must be a valid URL').optional().or(z.literal('')),
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
      hero: (department as any)?.hero || '',
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
            hero: data.hero || null,
            active: data.active
          } as any,
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
          hero: data.hero || undefined,
          active: data.active,
          translations: [
            { locale: 'en', ...data.translations.en },
            { locale: 'no', ...data.translations.no }
          ]
        } as any)

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

  const isEditing = !!department
  const departmentName = form.watch('translations.en.title') || form.watch('Name') || 'New Department'

  return (
    <div className="min-h-screen w-full">
      {/* Premium Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/units')}
                className="gap-2 hover:bg-primary/10"
          >
            <ChevronLeft className="w-4 h-4" />
                Back
          </Button>
          <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                  {isEditing ? 'Edit Department' : 'Create Department'}
                  <Badge variant={isEditing ? 'secondary' : 'default'} className="text-xs">
                    <Building2 className="w-3 h-3 mr-1" />
                    {isEditing ? 'Editing' : 'New'}
                  </Badge>
            </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isEditing ? 'Update department information and content' : 'Add a new department to your organization'}
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/units')}
                disabled={isSubmitting}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={isSubmitting}
                className="gap-2 bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Department' : 'Create Department'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-8">
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* LEFT COLUMN - Main Content */}
            <div className="space-y-6">
              {/* Basic Information */}
              <GlassCard
                title="Basic Information"
                description="Core department details and identifiers"
                variant="premium"
              >
                <div className="space-y-4">
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
                              className="bg-card/60 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-300"
                        />
                      </FormControl>
                          <FormDescription className="text-xs">
                            Unique identifier (max 10 chars{department ? ', cannot be changed' : ''})
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
                              className="bg-card/60 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-300"
                        />
                      </FormControl>
                          <FormDescription className="text-xs">
                        Internal name (max 50 chars)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
                </div>
              </GlassCard>

              {/* Translations */}
              <GlassCard
                title="Content & Translations"
                description="Multi-language content for public display"
                variant="premium"
              >
                <Tabs value={activeLocale} onValueChange={(v) => setActiveLocale(v as 'en' | 'no')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50 backdrop-blur-sm">
                    <TabsTrigger value="en" className="flex items-center gap-2 data-[state=active]:bg-card/80">
                      🇬🇧 English
                    </TabsTrigger>
                    <TabsTrigger value="no" className="flex items-center gap-2 data-[state=active]:bg-card/80">
                      🇳🇴 Norwegian
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="en" className="space-y-4 mt-6">
                  <FormField
                    control={form.control}
                    name="translations.en.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title (English)</FormLabel>
                        <FormControl>
                            <Input 
                              placeholder="Department title in English" 
                              {...field}
                              className="bg-card/60 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-300"
                            />
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
                              placeholder="Brief description for cards and previews"
                            rows={3}
                            {...field} 
                              className="bg-card/60 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-300 resize-none"
                          />
                        </FormControl>
                          <FormDescription className="text-xs">
                            Used in cards and hero sections
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
                            <div className="border border-border/50 rounded-lg overflow-hidden bg-card/40 backdrop-blur-sm">
                          <JoditEditor
                            ref={editorRefEn}
                            value={field.value}
                            onBlur={(newContent) => field.onChange(newContent)}
                            config={{
                              readonly: false,
                              height: 400,
                                  placeholder: 'Detailed department description in English',
                                  toolbar: true
                            }}
                          />
                            </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="no" className="space-y-4 mt-6">
                  <FormField
                    control={form.control}
                    name="translations.no.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tittel (Norsk)</FormLabel>
                        <FormControl>
                            <Input 
                              placeholder="Avdelingstittel på norsk" 
                              {...field}
                              className="bg-card/60 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-300"
                            />
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
                              placeholder="Kort beskrivelse for kort og forhåndsvisninger"
                            rows={3}
                            {...field} 
                              className="bg-card/60 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-300 resize-none"
                          />
                        </FormControl>
                          <FormDescription className="text-xs">
                            Brukes i kort og hero-seksjoner
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
                            <div className="border border-border/50 rounded-lg overflow-hidden bg-card/40 backdrop-blur-sm">
                          <JoditEditor
                            ref={editorRefNo}
                            value={field.value}
                            onBlur={(newContent) => field.onChange(newContent)}
                            config={{
                              readonly: false,
                              height: 400,
                                  placeholder: 'Detaljert avdelingsbeskrivelse på norsk',
                                  toolbar: true
                            }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>
              </GlassCard>

              {/* Hero Image Upload */}
              <GlassCard
                title="Hero Background"
                description="Upload a custom hero background for the department page"
                variant="premium"
              >
                <HeroUploadPreview
                  heroUrl={form.watch('hero')}
                  onChange={(url) => form.setValue('hero', url)}
                  departmentName={departmentName}
                />
              </GlassCard>
            </div>

            {/* RIGHT COLUMN - Sticky Sidebar */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <DepartmentEditorSidebar
                departmentName={departmentName}
                logoUrl={form.watch('logo')}
                onLogoChange={(url) => form.setValue('logo', url)}
                isNew={!isEditing}
                stats={department ? {
                  userCount: (department as any).userCount,
                  boardMemberCount: (department as any).boardMemberCount,
                  socialsCount: (department as any).socialsCount
                } : undefined}
                statusControl={
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Active Status</FormLabel>
                          <FormDescription className="text-xs">
                            Visible to users when active
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
                }
                campusControl={
                  <FormField
                    control={form.control}
                    name="campus_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Campus</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card/60 backdrop-blur-sm border-border/50">
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
                }
                typeControl={
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card/60 backdrop-blur-sm border-border/50">
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
                }
              />
            </div>
          </form>
        </Form>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center justify-center gap-2 mt-6 p-4 bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 sticky bottom-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/units')}
              disabled={isSubmitting}
            className="flex-1"
            >
              Cancel
            </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
      </div>
    </div>
  )
}
