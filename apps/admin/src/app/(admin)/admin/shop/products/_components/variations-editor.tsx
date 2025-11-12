"use client"

import { useMemo } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ProductVariation } from "@/lib/types/product"
import { cn } from "@/lib/utils"

interface VariationsEditorProps {
  value: ProductVariation[]
  onChange: (next: ProductVariation[]) => void
}

const createVariation = (): ProductVariation => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `var_${Math.random().toString(36).slice(2)}`,
  name: "",
  description: "",
  price_modifier: 0,
  sku: "",
  stock_quantity: undefined,
  is_default: false,
})

export function VariationsEditor({ value = [], onChange }: VariationsEditorProps) {
  const variations = useMemo(() => value || [], [value])

  const updateVariation = (index: number, patch: Partial<ProductVariation>) => {
    const next = variations.map((variation, idx) =>
      idx === index ? { ...variation, ...patch } : variation
    )
    onChange(next)
  }

  const setDefault = (index: number, isDefault: boolean) => {
    const next = variations.map((variation, idx) => ({
      ...variation,
      is_default: idx === index ? isDefault : isDefault ? false : variation.is_default,
    }))
    onChange(next)
  }

  const removeVariation = (index: number) => {
    const next = [...variations]
    next.splice(index, 1)
    onChange(next)
  }

  const addVariation = () => {
    onChange([...variations, createVariation()])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Variations</h3>
          <p className="text-sm text-muted-foreground">
            Define different options such as sizes, tiers, or access levels. Leave empty if the product
            has no variations.
          </p>
        </div>
        <Button type="button" onClick={addVariation}>
          <Plus className="mr-2 h-4 w-4" />
          Add variation
        </Button>
      </div>

      {variations.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No variations added. Use the button above to add your first variation.
        </div>
      ) : (
        <div className="space-y-4">
          {variations.map((variation, index) => (
            <div
              key={variation.id}
              className={cn(
                "rounded-lg border p-4",
                variation.is_default ? "border-primary/60" : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-semibold">Variation name</Label>
                  <Input
                    value={variation.name}
                    placeholder="E.g. Locker access, Hoodie XL, VIP tier"
                    onChange={(event) =>
                      updateVariation(index, { name: event.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeVariation(index)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remove variation</span>
                </Button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={variation.description || ""}
                    placeholder="Short description that will be shown to customers."
                    rows={3}
                    onChange={(event) =>
                      updateVariation(index, { description: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Price adjustment (NOK)</Label>
                    <Input
                      type="number"
                      value={variation.price_modifier ?? 0}
                      onChange={(event) =>
                        updateVariation(index, {
                          price_modifier: Number(event.target.value || 0),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Added to the base price. Use negative numbers for discounts.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>SKU (optional)</Label>
                    <Input
                      value={variation.sku || ""}
                      placeholder="Unique SKU for this variation"
                      onChange={(event) =>
                        updateVariation(index, { sku: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Stock quantity (optional)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={variation.stock_quantity ?? ""}
                      onChange={(event) =>
                        updateVariation(index, {
                          stock_quantity: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border p-3">
                    <Switch
                      checked={!!variation.is_default}
                      onCheckedChange={(checked) => setDefault(index, checked)}
                    />
                    <div className="space-y-1">
                      <Label className="text-sm">Default variation</Label>
                      <p className="text-xs text-muted-foreground">
                        Highlight this option for customers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
