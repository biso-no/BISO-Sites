"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import type { FormValues } from "./schema";

type JobBasicInfoProps = {
  campuses?: { $id: string; name: string }[];
  filteredDepartments: { $id: string; Name: string }[];
  onCampusChange: (value: string) => void;
};

export function JobBasicInfo({
  campuses,
  filteredDepartments,
  onCampusChange,
}: JobBasicInfoProps) {
  const t = useTranslations("adminJobs");
  const form = useFormContext<FormValues>();

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-lg">{t("editor.basicInformation")}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.slug")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("editor.labels.slugPlaceholder")}
                  {...field}
                />
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
              <FormLabel>{t("form.status")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("editor.labels.selectStatus")}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="draft">{t("status.draft")}</SelectItem>
                  <SelectItem value="published">
                    {t("status.published")}
                  </SelectItem>
                  <SelectItem value="closed">{t("status.closed")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="campus_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.campus")}</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v);
                  onCampusChange(v);
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("editor.labels.selectCampus")}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {campuses?.map((c) => (
                    <SelectItem key={c.$id} value={c.$id}>
                      {c.name}
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
              <FormLabel>{t("form.department")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("editor.labels.selectDepartment")}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {filteredDepartments.map((d) => (
                    <SelectItem key={d.$id} value={d.$id}>
                      {d.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
