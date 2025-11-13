"use client"

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createEvent, updateEvent, uploadEventImage } from '@/app/actions/events'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import { Switch } from '@repo/ui/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { Badge } from '@repo/ui/components/ui/badge'
import { toast } from '@/lib/hooks/use-toast'
import { buildTranslationMap } from '@/lib/utils/content-translations'
import type { AdminEvent } from '@/lib/types/event'
import { Languages, X } from 'lucide-react'

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false })

const numberField = z.preprocess(
  (value) => {
    if (value === '' || value === null || typeof value === 'undefined') return undefined
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  },
  z.number().optional(),
)

const formSchema = z.object({
  slug: z.string().optional(),
  status: z.enum(['draft', 'published', 'cancelled']).default('draft'),
  campus_id: z.string().min(1, 'Campus is required'),
  department_id: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  location: z.string().optional(),
  price: numberField,
  ticket_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  image: z.string().optional(),
  member_only: z.boolean().default(false),
  collection_id: z.string().optional(),
  is_collection: z.boolean().default(false),
  collection_pricing: z.enum(['bundle', 'individual']).optional(),
  units: z.array(z.string()).optional(),
  en_title: z.string().optional(),
  en_description: z.string().optional(),
  no_title: z.string().optional(),
  no_description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface EventEditorProps {
  event?: AdminEvent | null
  campuses?: { $id: string; name: string }[]
  departments?: { $id: string; Name: string; campus_id?: string }[]
}

export default function EventEditor({
  event,
  campuses = [],
  departments = [],
}: EventEditorProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [activeLocale, setActiveLocale] = React.useState<'en' | 'no'>('en')

  const translationMap = React.useMemo(
    () => event?.translations ?? buildTranslationMap(event?.translation_refs),
    [event],
  )

  const metadata = React.useMemo(() => event?.metadata_parsed ?? {}, [event])

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
      slug: event?.slug ?? '',
      status: (event?.status as FormValues['status']) ?? 'draft',
      campus_id: event?.campus_id ?? '',
      department_id:
        typeof metadata.department_id === 'string' ? metadata.department_id : '',
      start_date: event?.start_date ?? (metadata.start_date as string) ?? '',
      end_date: event?.end_date ?? (metadata.end_date as string) ?? '',
      start_time: (metadata.start_time as string) ?? '',
      end_time: (metadata.end_time as string) ?? '',
      location: event?.location ?? (metadata.location as string) ?? '',
      price: typeof metadata.price === 'number' ? metadata.price : undefined,
      ticket_url: event?.ticket_url ?? (metadata.ticket_url as string) ?? undefined,
      image: event?.image ?? (metadata.image as string) ?? '',
      member_only: event?.member_only ?? false,
      collection_id: event?.collection_id ?? '',
      is_collection: event?.is_collection ?? false,
      collection_pricing: event?.collection_pricing ?? undefined,
      units: defaultUnits,
      en_title: translationMap.en?.title ?? '',
      en_description: translationMap.en?.description ?? '',
      no_title: translationMap.no?.title ?? '',
      no_description: translationMap.no?.description ?? '',
    },
  })

  const selectedCampus = form.watch('campus_id')
  const filteredDepartments = React.useMemo(() => {
    if (!selectedCampus) return departments
    return departments.filter((dept) => dept.campus_id === selectedCampus)
  }, [departments, selectedCampus])

  React.useEffect(() => {
    if (translationMap.no && !translationMap.en) {
      setActiveLocale('no')
    }
  }, [translationMap])

  const enTitle = form.watch('en_title')
  const enDescription = form.watch('en_description')
  const noTitle = form.watch('no_title')
  const noDescription = form.watch('no_description')
  const isCollection = form.watch('is_collection')

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const translations: NonNullable<Parameters<typeof createEvent>[0]>['translations'] = {}

      if (values.en_title && values.en_description) {
        translations.en = {
          title: values.en_title,
          description: values.en_description,
        }
      }

      if (values.no_title && values.no_description) {
        translations.no = {
          title: values.no_title,
          description: values.no_description,
        }
      }

      const metadataPayload: Record<string, unknown> = {}

      if (values.start_date) metadataPayload.start_date = values.start_date
      if (values.end_date) metadataPayload.end_date = values.end_date
      if (values.start_time) metadataPayload.start_time = values.start_time
      if (values.end_time) metadataPayload.end_time = values.end_time
      if (values.location) metadataPayload.location = values.location
      if (typeof values.price === 'number') metadataPayload.price = values.price
      if (values.ticket_url) metadataPayload.ticket_url = values.ticket_url
      if (values.image) metadataPayload.image = values.image
      if (values.units && values.units.length > 0) metadataPayload.units = values.units
      if (values.department_id) metadataPayload.department_id = values.department_id

      const payload = {
        slug: values.slug?.trim() || undefined,
        status: values.status,
        campus_id: values.campus_id,
        member_only: values.member_only ?? false,
        collection_id: values.collection_id?.trim() || undefined,
        is_collection: values.is_collection ?? false,
        collection_pricing: values.collection_pricing || undefined,
        metadata: Object.keys(metadataPayload).length ? metadataPayload : undefined,
        translations,
      }

      if (event?.$id) {
        await updateEvent(event.$id, payload)
        toast({ title: 'Event updated' })
      } else {
        await createEvent(payload)
        toast({ title: 'Event created' })
      }

      router.push('/admin/events')
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to save event', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fd = new FormData()
    fd.append('file', file)

    try {
      const uploaded = await uploadEventImage(fd)
      const url = `https://appwrite.biso.no/v1/storage/buckets/events/files/${uploaded.$id}/view?project=biso`
      form.setValue('image', url, { shouldDirty: true })
      toast({ title: 'Image uploaded' })
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to upload image', variant: 'destructive' })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                Event Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs value={activeLocale} onValueChange={(value) => setActiveLocale(value as 'en' | 'no')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="en" className="flex items-center gap-2">
                    🇬🇧 English
                    {enTitle && enDescription ? (
                      <Badge variant="secondary" className="text-xs">
                        Complete
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="no" className="flex items-center gap-2">
                    🇳🇴 Norwegian
                    {noTitle && noDescription ? (
                      <Badge variant="secondary" className="text-xs">
                        Complete
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="en" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="en_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title (English)</FormLabel>
                        <FormControl>
                          <Input placeholder="Event title in English" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="en_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (English)</FormLabel>
                        <FormControl>
                          <JoditEditor
                            value={field.value || ''}
                            config={{ height: 320 }}
                            onBlur={field.onBlur}
                            onChange={(val: string) => field.onChange(val)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="no" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="no_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tittel (Norsk)</FormLabel>
                        <FormControl>
                          <Input placeholder="Arrangementstittel på norsk" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="no_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beskrivelse (Norsk)</FormLabel>
                        <FormControl>
                          <JoditEditor
                            value={field.value || ''}
                            config={{ height: 320 }}
                            onBlur={field.onBlur}
                            onChange={(val: string) => field.onChange(val)}
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

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Schedule & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <FormLabel>End date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
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
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Event location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="units"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units (departments)</FormLabel>
                    <div className="flex flex-wrap gap-2 pb-2">
                      {field.value?.map((id) => {
                        const label =
                          departments.find((dept) => dept.$id === id)?.Name ?? id
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
                          >
                            {label}
                            <button
                              type="button"
                              className="opacity-70 hover:opacity-100"
                              onClick={() =>
                                field.onChange((field.value || []).filter((value) => value !== id))
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <Select
                        onValueChange={(value) =>
                          field.onChange([...(field.value || []), value])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add a unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredDepartments.map((dept) => (
                            <SelectItem key={dept.$id} value={dept.$id}>
                              {dept.Name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => field.onChange([])}
                      >
                        Clear
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="event-slug" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
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
                        <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    <FormLabel>Campus</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                      }}
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
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(value) => field.onChange(value || undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {filteredDepartments.map((dept) => (
                          <SelectItem key={dept.$id} value={dept.$id}>
                            {dept.Name}
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
                name="member_only"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Member only</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Restrict this event to members.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="collection_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Collection ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Collection identifier" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_collection"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Collection event</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Mark this event as a collection of sub-events.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isCollection ? (
                <FormField
                  control={form.control}
                  name="collection_pricing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection pricing</FormLabel>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(value) =>
                          field.onChange(value ? (value as 'bundle' | 'individual') : undefined)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose pricing model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bundle">Bundle</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Pricing & Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (NOK)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        placeholder="0"
                        value={field.value ?? ''}
                        onChange={(event) =>
                          field.onChange(event.target.value === '' ? undefined : event.target.value)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ticket_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover image</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {field.value ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={field.value}
                            alt="Event cover"
                            className="h-32 w-full rounded object-cover"
                          />
                        ) : null}
                        <Input placeholder="https://..." {...field} />
                        <Input type="file" accept="image/*" onChange={handleImageChange} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : event ? 'Update event' : 'Create event'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

