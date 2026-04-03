"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Languages } from "lucide-react";
import { z } from "zod";
import type { BenefitEditorForm } from "./use-benefit-editor";

interface BenefitContentTabsProps {
  form: BenefitEditorForm;
}

function fieldError(errors: unknown[]): string | undefined {
  const first = errors[0];
  if (!first) return undefined;
  return String(first);
}

export function BenefitContentTabs({ form }: BenefitContentTabsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Content</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="nb">
          <TabsList className="mb-5 w-full">
            <TabsTrigger className="flex-1" value="nb">
              Norwegian
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="en">
              English
            </TabsTrigger>
          </TabsList>

          {/* ── Norwegian ── */}
          <TabsContent value="nb">
            <FieldGroup>
              <form.Field
                name="title_nb"
                validators={{ onChange: z.string().min(1, "Title is required") }}
              >
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor="title_nb">
                      Title{" "}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </FieldLabel>
                    <Input
                      id="title_nb"
                      placeholder="f.eks. 20% rabatt på Kaffebrenneriet"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>
                      {fieldError(field.state.meta.errors)}
                    </FieldError>
                  </Field>
                )}
              </form.Field>

              <form.Field
                name="description_nb"
                validators={{
                  onChange: z.string().min(1, "Description is required"),
                }}
              >
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor="description_nb">
                      Description{" "}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </FieldLabel>
                    <Textarea
                      id="description_nb"
                      placeholder="Beskriv fordelen for studenter..."
                      rows={4}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>
                      {fieldError(field.state.meta.errors)}
                    </FieldError>
                  </Field>
                )}
              </form.Field>

              <form.Field name="teaser_nb">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="teaser_nb">Teaser</FieldLabel>
                    <FieldDescription>
                      Short preview shown to non-members
                    </FieldDescription>
                    <Input
                      id="teaser_nb"
                      placeholder="Kort oppsummering for ikke-medlemmer..."
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value || null)
                      }
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="terms_nb">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="terms_nb">
                      Terms &amp; Conditions
                    </FieldLabel>
                    <Textarea
                      id="terms_nb"
                      placeholder="Gyldige vilkår..."
                      rows={2}
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value || null)
                      }
                    />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
          </TabsContent>

          {/* ── English ── */}
          <TabsContent value="en">
            <FieldGroup>
              <form.Field
                name="title_en"
                validators={{ onChange: z.string().min(1, "Title is required") }}
              >
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor="title_en">
                      Title{" "}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </FieldLabel>
                    <Input
                      id="title_en"
                      placeholder="e.g. 20% off at Kaffebrenneriet"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>
                      {fieldError(field.state.meta.errors)}
                    </FieldError>
                  </Field>
                )}
              </form.Field>

              <form.Field
                name="description_en"
                validators={{
                  onChange: z.string().min(1, "Description is required"),
                }}
              >
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor="description_en">
                      Description{" "}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </FieldLabel>
                    <Textarea
                      id="description_en"
                      placeholder="Describe the benefit for students..."
                      rows={4}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>
                      {fieldError(field.state.meta.errors)}
                    </FieldError>
                  </Field>
                )}
              </form.Field>

              <form.Field name="teaser_en">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="teaser_en">Teaser</FieldLabel>
                    <FieldDescription>
                      Short preview shown to non-members
                    </FieldDescription>
                    <Input
                      id="teaser_en"
                      placeholder="Short preview for non-members..."
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value || null)
                      }
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="terms_en">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="terms_en">
                      Terms &amp; Conditions
                    </FieldLabel>
                    <Textarea
                      id="terms_en"
                      placeholder="Applicable terms..."
                      rows={2}
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value || null)
                      }
                    />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
