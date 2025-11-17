"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ChevronLeft, Languages, Sparkles, Eye, DollarSign, Users, Ticket, Calendar, Edit2, Check, X, Hash } from 'lucide-react'
import { Badge } from '@repo/ui/components/ui/badge'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { toast } from '@/lib/hooks/use-toast'
import type { AdminEvent } from '@/lib/types/event'
import { RichTextEditor } from '@/components/rich-text-editor'
import { createEvent, updateEvent, translateEventContent } from '@/app/actions/events'
import { getCampuses, getCampusWithDepartments } from '@/app/actions/campus'
import type { Campus } from '@/lib/types/post'
import ImageUploadCard from './image-upload-card'
import { ToggleSection } from './toggle-section'
import { EventPreview } from './event-preview'
import { useTranslations } from 'next-intl'

const formSchema = z.object({
  // Database schema fields
  slug: z.string().min(1, 'Slug is required'),
  status: z.enum(['draft', 'published', 'cancelled']),
  campus_id: z.string().min(1, 'Campus is required'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  location: z.string().optional(),
  price: z.number().optional(),
  ticket_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  image: z.string().optional(),
  member_only: z.boolean(),
  collection_id: z.string().optional(),
  is_collection: z.boolean(),
  collection_pricing: z.enum(['bundle', 'individual']).optional(),
  department_id: z.string().optional(),
  // Metadata fields (non-schema fields)
  metadata: z.object({
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    units: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(), // For form UI only
  }).optional(),
  // Translations
  translations: z.object({
    en: z.object({
      title: z.string().min(1, 'English title is required'),
      description: z.string().min(1, 'English description is required'),
    }),
    no: z.object({
      title: z.string().min(1, 'Norwegian title is required'),
      description: z.string().min(1, 'Norwegian description is required'),
    }),
  }),
})

type FormValues = z.infer<typeof formSchema>

interface EventEditorProps {
  event?: AdminEvent | null
}

// Slugify function
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

export default function EventEditor({ event }: EventEditorProps) {
  const router = useRouter()
  const t = useTranslations('adminEvents')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isTranslating, setIsTranslating] = React.useState<'en' | 'no' | null>(null)
  const [previewLocale, setPreviewLocale] = React.useState<'en' | 'no'>('en')
  const [campuses, setCampuses] = React.useState<Campus[]>([])
  const [departments, setDepartments] = React.useState<Array<{ $id: string; Name: string }>>([])
  const [loadingDepartments, setLoadingDepartments] = React.useState(false)
  
  // Slug editing state
  const [isEditingSlug, setIsEditingSlug] = React.useState(false)
  const [slugSource, setSlugSource] = React.useState<'en' | 'no' | null>(null)
  const slugInputRef = React.useRef<HTMLInputElement>(null)
  
  // Toggle states for optional sections
  const [memberOnlyEnabled, setMemberOnlyEnabled] = React.useState(false)
  const [collectionEnabled, setCollectionEnabled] = React.useState(false)
  const [pricingEnabled, setPricingEnabled] = React.useState(false)

  const isEditing = !!event

  // Simplified: event.translations already exists from the server action
  const translations = event?.translations ?? { en: { title: '', description: '' }, no: { title: '', description: '' } }
  const metadata = event?.metadata_parsed ?? {}

  const defaultUnits = React.useMemo(() => {
    if (!metadata?.units) return []
    if (Array.isArray(metadata.units)) {
      return metadata.units.map((value) => String(value))
    }
    return []
  }, [metadata])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Database schema fields
      slug: event?.slug ?? '',
      status: (event?.status as FormValues['status']) ?? 'draft',
      campus_id: event?.campus_id ?? '',
      start_date: event?.start_date ?? '',
      end_date: event?.end_date ?? '',
      location: event?.location ?? '',
      price: event?.price ?? undefined,
      ticket_url: event?.ticket_url ?? '',
      image: event?.image ?? '',
      member_only: event?.member_only ?? false,
      collection_id: event?.collection_id ?? '',
      is_collection: event?.is_collection ?? false,
      collection_pricing: event?.collection_pricing ?? undefined,
      department_id: event?.department_id ?? '',
      // Metadata fields
      metadata: {
        start_time: (metadata.start_time as string) ?? '',
        end_time: (metadata.end_time as string) ?? '',
        units: defaultUnits,
        images: event?.image ? [event.image] : [],
      },
      // Translations
      translations: {
        en: {
          title: translations.en?.title ?? '',
          description: translations.en?.description ?? '',
        },
        no: {
          title: translations.no?.title ?? '',
          description: translations.no?.description ?? '',
        },
      },
    },
  })

  // Load campuses
  React.useEffect(() => {
    async function fetchCampuses() {
      try {
        const campusData = await getCampuses()
        setCampuses(campusData)
      } catch (error) {
        console.error('Error fetching campuses:', error)
        toast({ title: 'Failed to load campuses', variant: 'destructive' })
      }
    }
    fetchCampuses()
  }, [])

  // Initialize toggle states based on existing data
  React.useEffect(() => {
    if (event) {
      setMemberOnlyEnabled(event.member_only ?? false)
      setCollectionEnabled(event.is_collection ?? false)
      setPricingEnabled(!!(event.price !== null && event.price !== undefined) || !!event.ticket_url)
      
      // If editing, load departments for the selected campus
      if (event.campus_id) {
        loadDepartmentsForCampus(event.campus_id)
      }
    }
  }, [event])

  // Load departments when campus changes
  const loadDepartmentsForCampus = async (campusId: string) => {
    if (!campusId) {
      setDepartments([])
      return
    }
    
    setLoadingDepartments(true)
    try {
      const result = await getCampusWithDepartments(campusId)
      if (result.success && result.campus?.departments) {
        setDepartments(result.campus.departments.filter((dept: any) => dept.active))
      } else {
        setDepartments([])
      }
    } catch (error) {
      console.error('Error loading departments:', error)
      toast({ title: 'Failed to load departments', variant: 'destructive' })
      setDepartments([])
    } finally {
      setLoadingDepartments(false)
    }
  }

  // Watch for campus changes
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'campus_id' && value.campus_id) {
        // Clear department when campus changes
        form.setValue('department_id', '')
        loadDepartmentsForCampus(value.campus_id)
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  // Auto-generate slug from title
  React.useEffect(() => {
    if (isEditingSlug) return
    if (event) return // Don't auto-generate for existing events

    const subscription = form.watch((value, { name }) => {
      if (!name?.startsWith('translations.')) return
      if (!name?.endsWith('.title')) return

      const enTitle = value.translations?.en?.title || ''
      const noTitle = value.translations?.no?.title || ''

      if (!slugSource) {
        if (noTitle && !enTitle) {
          setSlugSource('no')
          form.setValue('slug', slugify(noTitle))
        } else if (enTitle && !noTitle) {
          setSlugSource('en')
          form.setValue('slug', slugify(enTitle))
        }
      } else if (slugSource === 'no') {
        if (noTitle) {
          form.setValue('slug', slugify(noTitle))
        } else if (!noTitle && enTitle) {
          setSlugSource('en')
          form.setValue('slug', slugify(enTitle))
        }
      } else if (slugSource === 'en') {
        if (enTitle) {
          form.setValue('slug', slugify(enTitle))
        } else if (!enTitle && noTitle) {
          setSlugSource('no')
          form.setValue('slug', slugify(noTitle))
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [form, isEditingSlug, slugSource, event])

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditingSlug && slugInputRef.current) {
      slugInputRef.current.focus()
      slugInputRef.current.select()
    }
  }, [isEditingSlug])

  const slugSourceLabel = slugSource
    ? slugSource === 'no'
      ? t('editor.norwegian')
      : t('editor.english')
    : t('editor.title')
  const slugDescription = slugSource
    ? t('editor.slugDescriptionAuto', { source: slugSourceLabel })
    : t('editor.slugDescriptionFallback')
  const slugEditingHint = t('editor.slugEditingHint')

  const handleTranslate = async (fromLocale: 'en' | 'no', toLocale: 'en' | 'no') => {
    const fromTranslation = form.getValues(`translations.${fromLocale}`)
    if (!fromTranslation?.title || !fromTranslation?.description) {
      toast({
        title: t("editor.messages.fillContent", {
          language: fromLocale === 'en' ? t("editor.english") : t("editor.norwegian"),
        }),
        variant: 'destructive',
      })
      return
    }

    setIsTranslating(toLocale)

    try {
      const translated = await translateEventContent(fromTranslation, fromLocale, toLocale)
      if (translated) {
        form.setValue(`translations.${toLocale}`, translated)
        toast({
          title: t("messages.translationCompleted"),
          description: t("messages.translationDescription", {
            language: toLocale === 'en' ? t("editor.english") : t("editor.norwegian"),
          }),
        })
      } else {
        toast({ title: t("messages.translationError"), variant: 'destructive' })
      }
    } catch (error) {
      console.error('Translation error:', error)
      toast({ title: t("messages.translationError"), variant: 'destructive' })
    } finally {
      setIsTranslating(null)
    }
  }

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const ticketUrl = values.ticket_url?.trim()
      const primaryImage = values.metadata?.images?.[0] || values.image || undefined
      
      const payload: Parameters<typeof createEvent>[0] = {
        // Database schema fields
        slug: values.slug?.trim(),
        status: values.status,
        campus_id: values.campus_id,
        start_date: values.start_date || undefined,
        end_date: values.end_date || undefined,
        location: values.location || undefined,
        price: typeof values.price === 'number' ? values.price : undefined,
        ticket_url: (ticketUrl && ticketUrl !== '') ? ticketUrl : undefined,
        image: primaryImage,
        member_only: values.member_only ?? false,
        collection_id: values.collection_id?.trim() || undefined,
        is_collection: values.is_collection ?? false,
        collection_pricing: values.collection_pricing || undefined,
        department_id: values.department_id || undefined,
        // Metadata (only non-schema fields)
        metadata: {
          start_time: values.metadata?.start_time || undefined,
          end_time: values.metadata?.end_time || undefined,
          units: values.metadata?.units && values.metadata.units.length > 0 ? values.metadata.units : undefined,
        },
        // Translations
        translations: {
          en: {
            title: values.translations.en.title,
            description: values.translations.en.description,
          },
          no: {
            title: values.translations.no.title,
            description: values.translations.no.description,
          },
        },
      }

      if (event?.$id) {
        await updateEvent(event.$id, payload)
        toast({ title: t("messages.eventUpdated") })
      } else {
        await createEvent(payload)
        toast({ title: t("messages.eventCreated") })
      }

      router.push('/admin/events')
    } catch (error) {
      console.error(error)
      toast({ title: t("messages.eventSaveFailed"), variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCampus = campuses.find(c => c.$id === form.watch('campus_id'))
  const unitPlaceholder = loadingDepartments
    ? t("editor.placeholders.loading")
    : !selectedCampus
      ? t("editor.placeholders.selectCampusFirst")
      : t("editor.placeholders.addUnit")
  const departmentPlaceholder = loadingDepartments
    ? t("editor.placeholders.loading")
    : !selectedCampus
      ? t("editor.placeholders.selectCampusFirst")
      : t("editor.placeholders.selectDepartmentOptional")
  const eventTitle = event?.translation_refs?.[0]?.title || event?.slug || ''
  const headerTitle = isEditing
    ? t("editor.headerEdit", { title: eventTitle || t("editor.title") })
    : t("editor.headerNew")

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex flex-col sm:gap-4">
        <main className="grid flex-1 items-start gap-4">
          {/* Header */}
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t("editor.back")}</span>
            </Button>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              {headerTitle}
            </h1>
            <Badge variant="outline" className="ml-auto sm:ml-0">
              {form.watch('status')}
            </Badge>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                {t("form.cancel")}
              </Button>
              <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
                {isSubmitting ? t("editor.saving") : t("editor.saveEvent")}
              </Button>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_400px]">
              {/* LEFT COLUMN - Form Content */}
              <div className="space-y-6">
                {/* Event Content with Translations */}
                <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="h-5 w-5" />
                    {t("editor.eventContentTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("editor.eventContentDescription")}
                  </CardDescription>
                </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="en" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="en" className="flex items-center gap-2">
                          🇬🇧 {t("editor.english")}
                        </TabsTrigger>
                        <TabsTrigger value="no" className="flex items-center gap-2">
                          🇳🇴 {t("editor.norwegian")}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="en" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">{t("editor.englishSectionTitle")}</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleTranslate('no', 'en')}
                            disabled={isTranslating === 'en'}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isTranslating === 'en'
                              ? t("editor.translating")
                              : t("editor.translateFromNorwegian")}
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name="translations.en.title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("form.title")}</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder={t("editor.placeholders.englishTitle")}
                                  {...field}
                                  className="glass-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="translations.en.description"
                          render={({ field }) => (
                            <FormItem>
                            <FormLabel>{t("form.description")}</FormLabel>
                              <FormControl>
                                <RichTextEditor
                                  content={field.value || ''}
                                  onChange={field.onChange}
                                  editable={true}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      <TabsContent value="no" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">{t("editor.norwegianSectionTitle")}</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleTranslate('en', 'no')}
                            disabled={isTranslating === 'no'}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isTranslating === 'no'
                              ? t("editor.translating")
                              : t("editor.translateFromEnglish")}
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name="translations.no.title"
                          render={({ field }) => (
                            <FormItem>
                            <FormLabel>{t("form.title")}</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder={t("editor.placeholders.norwegianTitle")}
                                  {...field}
                                  className="glass-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="translations.no.description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("form.description")}</FormLabel>
                              <FormControl>
                                <RichTextEditor
                                  content={field.value || ''}
                                  onChange={field.onChange}
                                  editable={true}
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

                {/* Schedule & Details */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {t("editor.scheduleTitle")}
                    </CardTitle>
                    <CardDescription>
                      {t("editor.scheduleDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.startDate")}</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} className="glass-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.endDate")}</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} className="glass-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="metadata.start_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.startTime")}</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} className="glass-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="metadata.end_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.endTime")}</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} className="glass-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("editor.location")}</FormLabel>
                          <FormControl>
                            <Input placeholder="Event location" {...field} className="glass-input" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="metadata.units"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Associated Units</FormLabel>
                          <Select
                            value={field.value?.[0] ?? undefined}
                            onValueChange={(value) => {
                              const currentUnits = field.value || []
                              if (!currentUnits.includes(value)) {
                                field.onChange([...currentUnits, value])
                              }
                            }}
                            disabled={!form.watch('campus_id') || loadingDepartments}
                          >
                            <FormControl>
                              <SelectTrigger className="glass-input">
                              <SelectValue placeholder={unitPlaceholder} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.$id} value={dept.$id}>
                                  {dept.Name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {field.value?.map((unitId) => {
                              const dept = departments.find((d) => d.$id === unitId)
                              return (
                                <Badge key={unitId} variant="secondary" className="flex items-center gap-1">
                                  {dept?.Name || unitId}
                                  <button
                                    type="button"
                                    className="ml-1 hover:text-destructive"
                                    onClick={() => {
                                      field.onChange((field.value || []).filter((id) => id !== unitId))
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              )
                            })}
                          </div>
                          <FormDescription>{t("editor.unitsHint")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Toggle Sections */}
                <div className="space-y-4">
                  <ToggleSection
                    title={t("editor.membersOnlyTitle")}
                    description={t("editor.membersOnlyDescription")}
                    enabled={memberOnlyEnabled}
                    onToggle={(enabled) => {
                      setMemberOnlyEnabled(enabled)
                      form.setValue('member_only', enabled)
                    }}
                    icon={Users}
                  >
                    <div className="rounded-lg border border-primary/20 p-4 bg-white/40">
                      <p className="text-sm text-muted-foreground">
                        {t("editor.membersOnlyMessage")}
                      </p>
                    </div>
                  </ToggleSection>

                  <ToggleSection
                    title={t("editor.pricingTitle")}
                    description={t("editor.pricingDescription")}
                    enabled={pricingEnabled}
                    onToggle={(enabled) => {
                      setPricingEnabled(enabled)
                      if (!enabled) {
                        form.setValue('price', undefined)
                        form.setValue('ticket_url', '')
                      }
                    }}
                    icon={DollarSign}
                  >
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.priceLabel")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="1"
                                placeholder="0"
                                value={field.value ?? ''}
                                onChange={(event) => {
                                  const value = event.target.value
                                  if (value === '') {
                                    field.onChange(undefined)
                                  } else {
                                    const num = Number(value)
                                    field.onChange(Number.isNaN(num) ? undefined : num)
                                  }
                                }}
                                className="glass-input"
                              />
                            </FormControl>
                            <FormDescription>{t("editor.priceDescription")}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ticket_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.ticketUrlLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder="https://..." {...field} className="glass-input" />
                            </FormControl>
                            <FormDescription>
                              {t("editor.ticketUrlDescription")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </ToggleSection>

                  <ToggleSection
                    title={t("editor.collectionTitle")}
                    description={t("editor.collectionDescription")}
                    enabled={collectionEnabled}
                    onToggle={(enabled) => {
                      setCollectionEnabled(enabled)
                      form.setValue('is_collection', enabled)
                      if (!enabled) {
                        form.setValue('collection_id', '')
                        form.setValue('collection_pricing', undefined)
                      }
                    }}
                    icon={Ticket}
                  >
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="collection_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.collectionIdLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("editor.collectionIdPlaceholder")} {...field} className="glass-input" />
                            </FormControl>
                            <FormDescription>
                              {t("editor.collectionIdDescription")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="collection_pricing"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("editor.collectionPricingLabel")}</FormLabel>
                            <Select
                              value={field.value ?? undefined}
                              onValueChange={(value) =>
                                field.onChange(value as 'bundle' | 'individual')
                              }
                            >
                              <FormControl>
                                <SelectTrigger className="glass-input">
                                  <SelectValue placeholder={t("editor.collectionPricingPlaceholder")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="bundle">{t("editor.collectionBundle")}</SelectItem>
                                <SelectItem value="individual">{t("editor.collectionIndividual")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {t("editor.collectionPricingDescription")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </ToggleSection>
                </div>
              </div>

              {/* RIGHT COLUMN - Sticky Sidebar */}
              <div className="lg:sticky lg:top-6 lg:self-start space-y-6">
                {/* Event Settings */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Event Settings</CardTitle>
                    <CardDescription>Configure status and location</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.slug")}</FormLabel>
                          <FormControl>
                            {!isEditingSlug ? (
                              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-white/40 px-3 py-2">
                                <code className="flex-1 text-sm font-mono text-muted-foreground">
                                  {field.value || t("editor.slugFallback")}
                                </code>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setIsEditingSlug(true)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">
                                    {t("editor.editSlug")}
                                  </span>
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder={t("editor.slugPlaceholder")}
                                  {...field}
                                  ref={(e) => {
                                    field.ref(e)
                                    slugInputRef.current = e
                                  }}
                                  className="glass-input flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      setIsEditingSlug(false)
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault()
                                      setIsEditingSlug(false)
                                      const enTitle = form.getValues('translations.en.title')
                                      const noTitle = form.getValues('translations.no.title')
                                      const titleToUse = slugSource === 'no' ? noTitle : enTitle
                                      if (titleToUse) {
                                        form.setValue('slug', slugify(titleToUse))
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => setIsEditingSlug(false)}
                                >
                                  <Check className="h-4 w-4" />
                                  <span className="sr-only">
                                    {t("editor.saveSlug")}
                                  </span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setIsEditingSlug(false)
                                    const enTitle = form.getValues('translations.en.title')
                                    const noTitle = form.getValues('translations.no.title')
                                    const titleToUse = slugSource === 'no' ? noTitle : enTitle
                                    if (titleToUse) {
                                      form.setValue('slug', slugify(titleToUse))
                                    }
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                  <span className="sr-only">
                                    {t("editor.cancelSlug")}
                                  </span>
                                </Button>
                              </div>
                            )}
                          </FormControl>
                          <FormDescription>
                            {!isEditingSlug ? slugDescription : slugEditingHint}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.status")}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="glass-input">
                                <SelectValue placeholder={t("editor.selectStatus")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">{t("status.draft")}</SelectItem>
                              <SelectItem value="published">{t("status.published")}</SelectItem>
                              <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="campus_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.campus")}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="glass-input">
                                <SelectValue placeholder={t("editor.selectCampus")} />
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
                          {selectedCampus && (
                            <FormDescription>
                              {t("editor.selectedCampus", { name: selectedCampus.name })}
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="department_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department (optional)</FormLabel>
                          <Select
                            value={field.value ?? undefined}
                            onValueChange={(value) => field.onChange(value)}
                            disabled={!form.watch('campus_id') || loadingDepartments}
                          >
                            <FormControl>
                              <SelectTrigger className="glass-input">
                                <SelectValue placeholder={departmentPlaceholder} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.$id} value={dept.$id}>
                                  {dept.Name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {!form.watch('campus_id') && t("editor.selectCampusDepartmentHint")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Event Images */}
                <FormField
                  control={form.control}
                  name="metadata.images"
                  render={({ field }) => (
                    <FormItem>
                      <ImageUploadCard
                        images={field.value || []}
                        onChange={(next) => {
                          field.onChange(next)
                          // Update the image field with the primary image
                          form.setValue('image', next[0] || '')
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Live Preview */}
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        {t("editor.livePreviewTitle")}
                      </CardTitle>
                      <Tabs value={previewLocale} onValueChange={(value) => setPreviewLocale(value as 'en' | 'no')} className="w-auto">
                        <TabsList className="h-8">
                          <TabsTrigger value="en" className="text-xs px-2">🇬🇧</TabsTrigger>
                          <TabsTrigger value="no" className="text-xs px-2">🇳🇴</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <CardDescription>
                      {t("editor.livePreviewDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EventPreview 
                      data={{
                        ...form.watch(),
                        image: form.watch('metadata.images')?.[0] || '',
                      }} 
                      locale={previewLocale} 
                    />
                  </CardContent>
                </Card>
              </div>
            </form>
          </Form>

          {/* Mobile Actions */}
          <div className="flex items-center justify-center gap-2 md:hidden mt-4">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              {t("form.cancel")}
            </Button>
            <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? t("editor.saving") : t("editor.saveEvent")}
            </Button>
          </div>
        </main>
      </div>
    </div>
  )
}
