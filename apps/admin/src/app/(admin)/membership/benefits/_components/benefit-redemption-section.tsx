"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { CalendarClock, Ticket } from "lucide-react";
import type { BenefitEditorForm } from "./use-benefit-editor";

interface BenefitRedemptionSectionProps {
  form: BenefitEditorForm;
}

const REDEMPTION_LABELS: Record<string, string> = {
  none: "None (info only)",
  code: "Discount code",
  link: "URL / Link",
  qr: "QR code",
  onsite: "On-site / In-person",
};

export function BenefitRedemptionSection({
  form,
}: BenefitRedemptionSectionProps) {
  return (
    <div className="space-y-4">
      {/* Redemption method */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="font-semibold text-base">
              Redemption
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field name="redemption_type">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="redemption-type">Method</FieldLabel>
                  <FieldDescription>
                    How members access or redeem this benefit
                  </FieldDescription>
                  <Select
                    onValueChange={(v) =>
                      field.handleChange(v as typeof field.state.value)
                    }
                    value={field.state.value}
                  >
                    <SelectTrigger id="redemption-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REDEMPTION_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.redemption_type}>
              {(redemptionType) =>
                redemptionType !== "none" && redemptionType !== "onsite" ? (
                  <form.Field name="redemption_value">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="redemption-value">
                          {redemptionType === "code" ? "Discount Code" : "URL"}
                        </FieldLabel>
                        <Input
                          id="redemption-value"
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(e.target.value || null)
                          }
                          placeholder={
                            redemptionType === "code"
                              ? "e.g. BISO20"
                              : "https://partner.com/student"
                          }
                          value={field.state.value ?? ""}
                        />
                      </Field>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Availability window */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="font-semibold text-base">
              Availability Window
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="publish_start">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="publish-start">
                      Available from
                    </FieldLabel>
                    <Input
                      id="publish-start"
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(
                          e.target.value ? `${e.target.value}:00.000Z` : null
                        )
                      }
                      type="datetime-local"
                      value={field.state.value?.slice(0, 16) ?? ""}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="publish_end">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="publish-end">Expires on</FieldLabel>
                    <Input
                      id="publish-end"
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(
                          e.target.value ? `${e.target.value}:00.000Z` : null
                        )
                      }
                      type="datetime-local"
                      value={field.state.value?.slice(0, 16) ?? ""}
                    />
                  </Field>
                )}
              </form.Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
