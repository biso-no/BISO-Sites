"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import type { FormValues } from "./schema";

export function JobMetadata() {
  const t = useTranslations("adminJobs");
  const form = useFormContext<FormValues>();

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-lg">{t("editor.metadataTitle")}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.type")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("editor.labels.jobTypePlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="application_deadline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.deadline")}</FormLabel>
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
          name="contact_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.contactPerson")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("editor.labels.contactNamePlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.contactEmail")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("editor.labels.contactEmailPlaceholder")}
                  type="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
