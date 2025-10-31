"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select"
import type { ProductWithTranslations, ProductCustomField, ProductVariation } from "@/lib/types/product"
import { useCartStore } from "@/lib/stores/cart"

interface MemberPricing {
  discounted: number
  membership?: Record<string, unknown>
}

interface ProductPurchaseClientProps {
  product: ProductWithTranslations
  memberPricing?: MemberPricing | null
}

const getDefaultVariationId = (variations?: ProductVariation[]) => {
  if (!variations || variations.length === 0) return undefined
  const defaultVariation = variations.find((variation) => variation.is_default)
  return (defaultVariation || variations[0]).id
}

const getInitialFieldValues = (fields?: ProductCustomField[]) => {
  if (!fields) return {}
  return fields.reduce<Record<string, string>>((acc, field) => {
    if (field.type === "select" && field.options?.length) {
      acc[field.id] = field.options[0]
    } else {
      acc[field.id] = ""
    }
    return acc
  }, {})
}

export function ProductPurchaseClient({ product, memberPricing }: ProductPurchaseClientProps) {
  const addToCart = useCartStore((state) => state.addItem)
  const itemCount = useCartStore((state) =>
    state.items
      .filter((item) => item.productId === product.$id)
      .reduce((sum, item) => sum + item.quantity, 0)
  )
  const router = useRouter()

  const [selectedVariationId, setSelectedVariationId] = useState<string | undefined>(() =>
    getDefaultVariationId(product.variations)
  )
  const [quantity, setQuantity] = useState<number>(() => {
    if (product.max_per_user === 1) return 1
    if (product.max_per_order) return Math.min(1, product.max_per_order)
    return 1
  })
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    getInitialFieldValues(product.custom_fields)
  )

  const variation = useMemo(() => {
    if (!product.variations || product.variations.length === 0) return undefined
    return product.variations.find((candidate) => candidate.id === selectedVariationId) || product.variations[0]
  }, [product.variations, selectedVariationId])

  const basePrice = Number(product.price || 0)
  const variationModifier = Number(variation?.price_modifier || 0)
  const displayPrice = Math.max(0, basePrice + variationModifier)
  const remainingForProduct = useMemo(() => {
    if (!product.max_per_order) return undefined
    return Math.max(0, product.max_per_order - itemCount)
  }, [product.max_per_order, itemCount])
  const canAddMore = remainingForProduct === undefined || remainingForProduct > 0

  const handleQuantityChange = (next: number) => {
    if (Number.isNaN(next)) return
    let safe = Math.max(1, Math.floor(next))
    if (product.max_per_user === 1) {
      safe = 1
    }
    if (remainingForProduct !== undefined) {
      const remaining = Math.max(0, remainingForProduct)
      if (remaining === 0) {
        safe = 1
      } else {
        safe = Math.min(safe, remaining)
      }
    }
    setQuantity(safe)
  }

  const updateCustomField = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }))
  }

  const validateRequiredFields = () => {
    const missing = (product.custom_fields || []).filter((field) => {
      if (!field.required) return false
      const value = fieldValues[field.id]
      return !value || value.trim().length === 0
    })
    if (missing.length > 0) {
      toast.error(`Please fill out: ${missing.map((field) => field.label).join(", ")}`)
      return false
    }
    return true
  }

  const handleAddToCart = () => {
    if (!canAddMore) {
      toast.error('You have reached the maximum allowed for this product.')
      return
    }

    if (!validateRequiredFields()) {
      return
    }

    const result = addToCart({
      product,
      quantity,
      variation,
      customFieldResponses: fieldValues,
    })

    if (!result.success) {
      toast.error(result.message || "Unable to add item to cart")
      return
    }

    toast.success(`${product.title || product.slug} added to cart`)
    if (product.max_per_user === 1 || product.max_per_order === 1) {
      router.push("/shop/cart")
    }
  }

  const maxPerOrderRemaining =
    product.max_per_order !== undefined ? Math.max(0, product.max_per_order - itemCount) : undefined

  return (
    <div className="space-y-6">
      {product.variations && product.variations.length > 0 ? (
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-muted-foreground">Choose an option</Label>
          <RadioGroup
            value={selectedVariationId}
            onValueChange={(value) => setSelectedVariationId(value)}
            className="grid gap-3"
          >
            {product.variations.map((option) => {
              const optionPrice = Math.max(0, basePrice + Number(option.price_modifier || 0))
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 hover:border-foreground/20"
                >
                  <RadioGroupItem value={option.id} className="mt-1 h-4 w-4" />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {option.name}
                      <span className="text-xs text-muted-foreground">
                        {optionPrice.toFixed(2)} NOK
                      </span>
                    </div>
                    {option.description ? (
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    ) : null}
                  </div>
                </label>
              )
            })}
          </RadioGroup>
        </div>
      ) : null}

      {product.custom_fields && product.custom_fields.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Additional information</h3>
          <div className="space-y-4">
            {product.custom_fields.map((field) => {
              const value = fieldValues[field.id] ?? ""
              const isRequired = !!field.required
              const label = `${field.label}${isRequired ? " *" : ""}`
              if (field.type === "textarea") {
                return (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{label}</Label>
                    <Textarea
                      id={field.id}
                      value={value}
                      placeholder={field.placeholder}
                      rows={4}
                      onChange={(event) => updateCustomField(field.id, event.target.value)}
                    />
                  </div>
                )
              }
              if (field.type === "select") {
                return (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{label}</Label>
                    <Select
                      value={value}
                      onValueChange={(next) => updateCustomField(field.id, next)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder || "Choose an option"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }
              if (field.type === "number") {
                return (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{label}</Label>
                    <Input
                      id={field.id}
                      type="number"
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(event) => updateCustomField(field.id, event.target.value)}
                    />
                  </div>
                )
              }
              return (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>{label}</Label>
                  <Input
                    id={field.id}
                    value={value}
                    placeholder={field.placeholder}
                    onChange={(event) => updateCustomField(field.id, event.target.value)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            disabled={product.max_per_user === 1 || !canAddMore}
            onChange={(event) => handleQuantityChange(Number(event.target.value))}
          />
        </div>
        <div className="flex-1 space-y-1 text-sm">
          <div className="text-2xl font-semibold">
            {memberPricing ? (
              <>
                {memberPricing.discounted.toFixed(2)} NOK
                <span className="ml-2 text-sm text-muted-foreground line-through">
                  {displayPrice.toFixed(2)} NOK
                </span>
              </>
            ) : (
              <>{displayPrice.toFixed(2)} NOK</>
            )}
          </div>
          {memberPricing ? (
            <p className="text-xs text-green-600">Member discount applied automatically at checkout.</p>
          ) : null}
          {product.max_per_user === 1 ? (
            <p className="text-xs text-muted-foreground">Limited to one per customer.</p>
          ) : null}
          {remainingForProduct !== undefined ? (
            <p className="text-xs text-muted-foreground">
              {remainingForProduct} remaining for this order.
            </p>
          ) : null}
        </div>
      </div>
          {!canAddMore ? (
            <p className="text-xs text-destructive">Maximum quantity already in cart for this product.</p>
          ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={handleAddToCart} className="flex-1" disabled={!canAddMore}>
          Add to cart
        </Button>
        <Button asChild variant="outline" size="lg" className="flex-1">
          <Link href="/shop/cart">View cart</Link>
        </Button>
      </div>
    </div>
  )
}
