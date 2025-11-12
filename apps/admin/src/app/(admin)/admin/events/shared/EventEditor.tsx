"use client"
import * as React from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { createEvent, updateEvent } from '@/app/actions/events'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/lib/hooks/use-toast'
import dynamic from 'next/dynamic'
import { uploadEventImage } from '@/app/actions/events'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { X } from 'lucide-react'

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false })

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  status: z.enum(['draft', 'published', 'cancelled']).default('draft'),
  locale: z.enum(['en', 'no']).default('en'),
  campus_id: z.string().min(1, 'Campus is required'),
  department_id: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  location: z.string().optional(),
  price: z.coerce.number().optional(),
  ticket_url: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
  image: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function EventEditor({ event, campuses, departments }: { event?: any, campuses?: { $id: string; name: string }[], departments?: { $id: string; Name: string; campus_id?: string }[] }) {
  const router = useRouter()
  const [selectedCampus, setSelectedCampus] = React.useState<string>(event?.campus_id || '')
  const filteredDepartments = React.useMemo(() => {
    if (!departments) return []
    if (!selectedCampus) return departments
    return departments.filter(d => d.campus_id === selectedCampus)
  }, [departments, selectedCampus])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: event?.title || '',
      description: event?.description || '',
      status: event?.status || 'draft',
      locale: event?.locale || 'en',
      campus_id: event?.campus_id || '',
      department_id: event?.department_id || '',
      start_date: event?.start_date || '',
      end_date: event?.end_date || '',
      location: event?.location || '',
      price: event?.price || undefined,
      ticket_url: event?.ticket_url || '',
      image: event?.image || '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      if (event?.$id) {
        await updateEvent(event.$id, values)
        toast({ title: 'Event updated' })
      } else {
        await createEvent(values)
        toast({ title: 'Event created' })
      }
      router.push('/admin/events')
    } catch (e) {
      console.error(e)
      toast({ title: 'Failed to save event', variant: 'destructive' })
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const uploaded = await uploadEventImage(fd)
    const url = `https://appwrite.biso.no/v1/storage/buckets/events/files/${uploaded.$id}/view?project=biso`
    form.setValue('image', url)
    toast({ title: 'Image uploaded' })
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Event details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Event title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <JoditEditor value={field.value} config={{ height: 400 }} onBlur={field.onBlur} onChange={(val: string) => field.onChange(val)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  name="units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Units (departments)</FormLabel>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {field.value?.map((id) => {
                          const idVal = typeof id === 'string' ? id : ((id as any)?.$id || (id as any)?.id || '')
                          const label = departments?.find(d => d.$id === idVal)?.Name || idVal
                          return (
                            <span key={idVal} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted">
                              {label}
                              <button type="button" className="opacity-70 hover:opacity-100" onClick={() => field.onChange((field.value || []).filter(v => (typeof v === 'string' ? v : (v as any)?.$id) !== idVal))}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <Select onValueChange={(val) => field.onChange([...(field.value || []), val])}>
                          <SelectTrigger>
                            <SelectValue placeholder="Add a unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredDepartments.map((d) => (
                              <SelectItem key={d.$id} value={d.$id}>{d.Name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" onClick={() => field.onChange([])}>Clear</Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="publish">Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="campus"
                render={({ field }) => (
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
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (NOK)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" placeholder="0" {...field} />
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
                        {field.value && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={field.value} alt="cover" className="w-full h-32 object-cover rounded" />
                        )}
                        <Input placeholder="https://..." {...field} />
                        <Input type="file" accept="image/*" onChange={handleImageChange} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


