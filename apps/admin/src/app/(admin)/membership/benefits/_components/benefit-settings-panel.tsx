"use client";

import type { BenefitPartner } from "@repo/api/types/appwrite";
import { BENEFIT_CATEGORIES } from "@repo/shared/utils/benefit-scope";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { Globe, Settings2, Star } from "lucide-react";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import type { BenefitEditorForm } from "./use-benefit-editor";

interface BenefitSettingsPanelProps {
  form: BenefitEditorForm;
  managedCampusIds: string[];
  partners: BenefitPartner[];
  onPartnerSelect: (id: string) => void;
}

const isGlobalAdmin = (ids: string[]) =>
  ids.includes("5") || ids.length === 0;

const CAMPUS_OPTIONS = ["1", "2", "3", "4"];

export function BenefitSettingsPanel({
  form,
  managedCampusIds,
  partners,
  onPartnerSelect,
}: BenefitSettingsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Settings</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {/* Campus */}
          <form.Field name="campus_id">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="campus-select">Campus</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <SelectTrigger id="campus-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isGlobalAdmin(managedCampusIds) ? (
                      <>
                        <SelectItem value="5">
                          <span className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" />
                            National
                          </span>
                        </SelectItem>
                        {CAMPUS_OPTIONS.map((id) => (
                          <SelectItem key={id} value={id}>
                            {CAMPUS_ID_TO_NAME[id]}
                          </SelectItem>
                        ))}
                      </>
                    ) : (
                      managedCampusIds.map((id) => (
                        <SelectItem key={id} value={id}>
                          {CAMPUS_ID_TO_NAME[id] ?? id}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          {/* Kind */}
          <form.Field name="kind">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="kind-select">Kind</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(v) =>
                    field.handleChange(v as typeof field.state.value)
                  }
                >
                  <SelectTrigger id="kind-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offer">
                      Offer — % or value discount
                    </SelectItem>
                    <SelectItem value="perk">
                      Perk — member exclusive
                    </SelectItem>
                    <SelectItem value="service">
                      Service — access or resource
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          {/* Category */}
          <form.Field name="category">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="category-select">Category</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <SelectTrigger id="category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BENEFIT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          {/* Partner */}
          <form.Field name="partner_id">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="partner-select">Partner</FieldLabel>
                <Select
                  value={field.state.value ?? "none"}
                  onValueChange={onPartnerSelect}
                >
                  <SelectTrigger id="partner-select">
                    <SelectValue placeholder="No partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No partner</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p.$id} value={p.$id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          {/* Image URL */}
          <form.Field name="image_url">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="image-url">Image URL</FieldLabel>
                <Input
                  id="image-url"
                  placeholder="https://..."
                  value={field.state.value ?? ""}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(e.target.value || null)
                  }
                />
              </Field>
            )}
          </form.Field>

          {/* Sort order */}
          <form.Field name="sort_order">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="sort-order">Sort Order</FieldLabel>
                <FieldDescription>
                  Lower numbers appear first (0–9999)
                </FieldDescription>
                <Input
                  id="sort-order"
                  type="number"
                  min={0}
                  max={9999}
                  value={field.state.value ?? 0}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                />
              </Field>
            )}
          </form.Field>

          <FieldSeparator />

          {/* Featured toggle */}
          <form.Field name="is_featured">
            {(field) => (
              <Field orientation="horizontal">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-amber-50 dark:bg-amber-900/20">
                  <Star className="h-4 w-4 text-amber-500" />
                </div>
                <FieldLabel
                  className="flex-1 cursor-pointer"
                  htmlFor="is-featured"
                >
                  Featured
                  <FieldDescription>
                    Highlighted prominently in the portal
                  </FieldDescription>
                </FieldLabel>
                <Switch
                  id="is-featured"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(v)}
                />
              </Field>
            )}
          </form.Field>

        </FieldGroup>
      </CardContent>
    </Card>
  );
}
