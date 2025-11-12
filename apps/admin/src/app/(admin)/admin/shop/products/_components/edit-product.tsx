'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Languages, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { updateProduct, createProduct, translateProductContent } from '@/app/actions/products'
import { listCampuses } from '@/app/actions/events' // Using from events actions
import type { 
  ProductWithTranslations, 
  ProductMetadata, 
  ProductTranslation, 
  CreateProductData, 
  UpdateProductData 
} from '@/lib/types/product'
import type { Campus } from '@/lib/types/campus'
import ImageUploadCard from './image-upload-card'
import { VariationsEditor } from './variations-editor'
import { CustomFieldsEditor } from './custom-fields-editor'

const customFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['text', 'textarea', 'number', 'select']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
})

const variationSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Variation name is required'),
  description: z.string().optional(),
  price_modifier: z.number().optional(),
  sku: z.string().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  is_default: z.boolean().optional(),
})

const productSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
  status: z.enum(['draft', 'published', 'archived']),
  campus_id: z.string().min(1, 'Campus is required'),
  metadata: z.object({
    price: z.number().min(0).optional(),
    sku: z.string().optional(),
    stock_quantity: z.number().int().min(0).optional(),
    category: z.string().optional(),
    image: z.string().optional(),
    images: z.array(z.string()).optional(),
    weight: z.number().min(0).optional(),
    dimensions: z.string().optional(),
    is_digital: z.boolean().optional(),
    shipping_required: z.boolean().optional(),
    member_discount_enabled: z.boolean().optional(),
    member_discount_percent: z.number().min(0).max(100).optional(),
    max_per_user: z.number().int().min(1).optional(),
    max_per_order: z.number().int().min(1).optional(),
    custom_fields: z.array(customFieldSchema).optional(),
    variations: z.array(variationSchema).optional(),
  }).optional(),
  translations: z.object({
    en: z.object({
      title: z.string().min(1, 'English title is required'),
      description: z.string().min(1, 'English description is required'),
    }).optional(),
    no: z.object({
      title: z.string().min(1, 'Norwegian title is required'),
      description: z.string().min(1, 'Norwegian description is required'),
    }).optional(),
  }),
})

type ProductFormData = z.infer<typeof productSchema>

interface EditProductProps {
  product?: ProductWithTranslations
}

export function EditProduct({ product }: EditProductProps) {
  const router = useRouter()
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTranslating, setIsTranslating] = useState<'en' | 'no' | null>(null)

  const isEditing = !!product

  // Extract translations from product
  const getTranslation = (locale: 'en' | 'no'): ProductTranslation | undefined => {
    if (!product?.translation_refs) return undefined
    const translation = product.translation_refs.find((t: any) => t.locale === locale)
    if (!translation) return undefined
    return {
      title: translation.title,
      description: translation.description,
    }
  }

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      slug: product?.slug || '',
      status: product?.status || 'draft',
      campus_id: product?.campus_id || '',
      metadata: {
        price: product?.price || 0,
        sku: product?.sku || '',
        stock_quantity: product?.stock_quantity || 0,
        category: product?.category || '',
        image: product?.image || '',
        images: product?.images || [],
        weight: product?.weight || 0,
        dimensions: product?.dimensions || '',
        is_digital: product?.is_digital || false,
        shipping_required: product?.shipping_required !== false,
        member_discount_enabled: product?.member_discount_enabled || false,
        member_discount_percent: product?.member_discount_percent || 0,
        max_per_user: product?.max_per_user,
        max_per_order: product?.max_per_order,
        custom_fields: product?.custom_fields || [],
        variations: product?.variations || [],
      },
      translations: {
        en: getTranslation('en'),
        no: getTranslation('no'),
      },
    },
  })

  useEffect(() => {
    async function fetchCampuses() {
      try {
        const campusData = await listCampuses()
        setCampuses(campusData)
      } catch (error) {
        console.error('Error fetching campuses:', error)
        toast.error('Failed to load campuses')
      }
    }

    fetchCampuses()
  }, [])

  const handleTranslate = async (fromLocale: 'en' | 'no', toLocale: 'en' | 'no') => {
    const fromTranslation = form.getValues(`translations.${fromLocale}`)
    if (!fromTranslation?.title || !fromTranslation?.description) {
      toast.error(`Please fill in the ${fromLocale === 'en' ? 'English' : 'Norwegian'} content first`)
      return
    }

    // Ensure we have the required fields for ProductTranslation
    const translationData: ProductTranslation = {
      title: fromTranslation.title,
      description: fromTranslation.description,
    }

    setIsTranslating(toLocale)

    try {
      const translated = await translateProductContent(translationData, fromLocale, toLocale)
      if (translated) {
        form.setValue(`translations.${toLocale}`, translated)
        toast.success(`Content translated to ${toLocale === 'en' ? 'English' : 'Norwegian'}`)
      } else {
        toast.error('Translation failed')
      }
    } catch (error) {
      console.error('Translation error:', error)
      toast.error('Translation failed')
    } finally {
      setIsTranslating(null)
    }
  }

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true)

    try {
      // Transform the form data to match the expected types
      const transformedTranslations: { en?: ProductTranslation; no?: ProductTranslation } = {}
      
      if (data.translations.en?.title && data.translations.en?.description) {
        transformedTranslations.en = {
          title: data.translations.en.title,
          description: data.translations.en.description,
        }
      }
      
      if (data.translations.no?.title && data.translations.no?.description) {
        transformedTranslations.no = {
          title: data.translations.no.title,
          description: data.translations.no.description,
        }
      }

      const metadata: ProductMetadata | undefined = data.metadata ? { ...data.metadata } : undefined

      if (metadata) {
        const imageList = Array.isArray(metadata.images)
          ? metadata.images.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
          : []

        metadata.images = imageList
        if (imageList.length > 0) {
          metadata.image = imageList[0]
        } else {
          delete metadata.image
        }

        if (!metadata.member_discount_enabled) {
          metadata.member_discount_percent = 0
        }

        if (!metadata.custom_fields || metadata.custom_fields.length === 0) {
          delete metadata.custom_fields
        } else {
          metadata.custom_fields = metadata.custom_fields.map((field) => ({
            ...field,
            options: field.type === 'select'
              ? (field.options || []).filter((option) => option.trim().length > 0)
              : undefined,
          }))
        }

        if (!metadata.variations || metadata.variations.length === 0) {
          delete metadata.variations
        } else {
          metadata.variations = metadata.variations.map((variation) => ({
            ...variation,
            price_modifier: typeof variation.price_modifier === 'number'
              ? variation.price_modifier
              : 0,
            stock_quantity: typeof variation.stock_quantity === 'number'
              ? Math.max(0, variation.stock_quantity)
              : undefined,
          }))
        }

        if (!metadata.max_per_user) {
          delete metadata.max_per_user
        }

        if (!metadata.max_per_order) {
          delete metadata.max_per_order
        }

        if (metadata.sku) {
          metadata.sku = metadata.sku.trim()
        }
        if (!metadata.sku) {
          delete metadata.sku
        }

        if (metadata.category) {
          metadata.category = metadata.category.trim()
        }
        if (!metadata.category) {
          delete metadata.category
        }

        if (metadata.dimensions) {
          metadata.dimensions = metadata.dimensions.trim()
        }
        if (!metadata.dimensions) {
          delete metadata.dimensions
        }
      }

      if (isEditing && product) {
        const updateData: UpdateProductData = {
          slug: data.slug,
          status: data.status,
          campus_id: data.campus_id,
          metadata,
          translations: transformedTranslations,
        }
        await updateProduct(product.$id, updateData)
        toast.success('Product updated successfully')
      } else {
        const createData: CreateProductData = {
          slug: data.slug!,
          status: data.status,
          campus_id: data.campus_id!,
          metadata,
          translations: transformedTranslations,
        }
        await createProduct(createData)
        toast.success('Product created successfully')
      }
      
      router.push('/admin/shop/products')
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCampus = campuses.find(c => c.$id === form.watch('campus_id'))

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              {isEditing ? `Edit ${product.title}` : 'New Product'}
            </h1>
            <Badge variant="outline" className="ml-auto sm:ml-0">
              {form.watch('status')}
            </Badge>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Product'}
              </Button>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-[1fr_300px] lg:gap-8">
              <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
                {/* Product Details with Translations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="h-5 w-5" />
                      Product Content
                    </CardTitle>
                    <CardDescription>
                      Manage product content in multiple languages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="en" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="en" className="flex items-center gap-2">
                          🇬🇧 English
                        </TabsTrigger>
                        <TabsTrigger value="no" className="flex items-center gap-2">
                          🇳🇴 Norsk
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="en" className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">English Content</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleTranslate('no', 'en')}
                            disabled={isTranslating === 'en'}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isTranslating === 'en' ? 'Translating...' : 'Translate from Norwegian'}
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name="translations.en.title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title</FormLabel>
                              <FormControl>
                                <Input placeholder="Product title in English" {...field} />
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
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Product description in English"
                                  className="min-h-32"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      <TabsContent value="no" className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">Norwegian Content</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleTranslate('en', 'no')}
                            disabled={isTranslating === 'no'}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isTranslating === 'no' ? 'Translating...' : 'Translate from English'}
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name="translations.no.title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tittel</FormLabel>
                              <FormControl>
                                <Input placeholder="Produkttittel på norsk" {...field} />
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
                              <FormLabel>Beskrivelse</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Produktbeskrivelse på norsk"
                                  className="min-h-32"
                                  {...field}
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

                <Accordion
                  type="multiple"
                  defaultValue={['product-details']}
                  className="space-y-4"
                >
                  <AccordionItem value="product-details" className="overflow-hidden rounded-lg border bg-card">
                    <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">
                      Product Details
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="pb-4 text-sm text-muted-foreground">
                        Configure pricing, inventory, and other product data.
                      </p>
                      <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="metadata.price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price (NOK)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="metadata.sku"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SKU</FormLabel>
                                <FormControl>
                                  <Input placeholder="Product SKU" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="metadata.stock_quantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="metadata.category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <FormControl>
                                  <Input placeholder="Product category" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="metadata.is_digital"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel>Digital Product</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="metadata.shipping_required"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel>Shipping Required</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="metadata.member_discount_enabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel>Enable member discount</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="metadata.member_discount_percent"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Member discount %</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="metadata.max_per_user"
                          render={({ field }) => (
                            <FormItem className="flex flex-col space-y-2 rounded-md border p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <FormLabel className="text-sm font-medium leading-none">
                                    Limit to one per customer
                                  </FormLabel>
                                  <FormDescription>
                                    Prevents customers from purchasing the same product more than once with their account.
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={!!field.value && field.value <= 1}
                                    onCheckedChange={(checked) => field.onChange(checked ? 1 : undefined)}
                                  />
                                </FormControl>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="metadata.max_per_order"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum per order</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  value={field.value ?? ''}
                                  onChange={(event) => {
                                    const next = event.target.value
                                    field.onChange(next ? parseInt(next) : undefined)
                                  }}
                                  placeholder="Unlimited"
                                />
                              </FormControl>
                              <FormDescription>Restrict how many units can be purchased in a single checkout.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="options-fields" className="overflow-hidden rounded-lg border bg-card">
                    <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">
                      Options & Fields
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="pb-4 text-sm text-muted-foreground">
                        Configure variations and gather extra details needed to fulfill the order.
                      </p>
                      <div className="space-y-8">
                        <FormField
                          control={form.control}
                          name="metadata.variations"
                          render={({ field }) => (
                            <FormItem>
                              <VariationsEditor
                                value={field.value || []}
                                onChange={(next) => field.onChange(next)}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="metadata.custom_fields"
                          render={({ field }) => (
                            <FormItem>
                              <CustomFieldsEditor
                                value={field.value || []}
                                onChange={(next) => field.onChange(next)}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Sidebar */}
              <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
                {/* Status & Campus */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Status</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="product-slug" {...field} />
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                {selectedCampus && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedCampus.name}
                  </div>
                )}
              </CardContent>
            </Card>
            <FormField
              control={form.control}
              name="metadata.images"
              render={({ field }) => (
                <FormItem>
                  <ImageUploadCard
                    images={field.value || []}
                    onChange={(next) => {
                      field.onChange(next)
                      form.setValue('metadata.image', next[0] || '')
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
            </form>
          </Form>

          {/* Mobile Actions */}
          <div className="flex items-center justify-center gap-2 md:hidden">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Product'}
            </Button>
          </div>
        </main>
      </div>
    </div>
  )
}
