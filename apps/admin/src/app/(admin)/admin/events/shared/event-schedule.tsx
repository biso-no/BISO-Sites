"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  FormControl,
  FormDescription,
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
import { Calendar, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import type { Campus } from "@/lib/types/post";
import type { FormValues } from "./schema";

type EventScheduleProps = {
  campuses: Campus[];
  departments: Array<{ $id: string; Name: string }>;
  loadingDepartments: boolean;
};

export function EventSchedule({
  campuses,
  departments,
  loadingDepartments,
}: EventScheduleProps) {
  const t = useTranslations("adminEvents");
  const form = useFormContext<FormValues>();

  const selectedCampus = campuses.find(
    (c) => c.$id === form.watch("campus_id")
  );

  let unitPlaceholder = t("editor.placeholders.selectCampusFirst");
  if (loadingDepartments) {
    unitPlaceholder = t("editor.placeholders.loading");
  } else if (selectedCampus) {
    unitPlaceholder = t("editor.placeholders.addUnit");
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t("editor.scheduleTitle")}
        </CardTitle>
        <CardDescription>{t("editor.scheduleDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.startDate")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="glass-input" />
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
                <FormLabel>{t("editor.endDate")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="glass-input" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="metadata.start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.startTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} className="glass-input" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metadata.end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.endTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} className="glass-input" />
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
              <FormLabel>{t("editor.location")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="Event location"
                  {...field}
                  className="glass-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.units"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Associated Units</FormLabel>
              <Select
                disabled={!form.watch("campus_id") || loadingDepartments}
                onValueChange={(value) => {
                  const currentUnits = field.value || [];
                  if (!currentUnits.includes(value)) {
                    field.onChange([...currentUnits, value]);
                  }
                }}
                value={field.value?.[0] ?? undefined}
              >
                <FormControl>
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder={unitPlaceholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.$id} value={dept.$id}>
                      {dept.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex flex-wrap gap-2">
                {field.value?.map((unitId) => {
                  const dept = departments.find((d) => d.$id === unitId);
                  return (
                    <Badge
                      className="flex items-center gap-1"
                      key={unitId}
                      variant="secondary"
                    >
                      {dept?.Name || unitId}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => {
                          field.onChange(
                            (field.value || []).filter((id) => id !== unitId)
                          );
                        }}
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <FormDescription>{t("editor.unitsHint")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
