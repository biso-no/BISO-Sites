"use client";

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
import { DollarSign, Ticket, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import type { AdminEvent } from "@/lib/types/event";
import type { FormValues } from "./schema";
import { ToggleSection } from "./toggle-section";
import { useState } from "react";

type EventOptionsProps = {
  event?: AdminEvent | null;
};

export function EventOptions({ event }: EventOptionsProps) {
  const t = useTranslations("adminEvents");
  const form = useFormContext<FormValues>();

  // Local states for toggle sections
  // We initialize these based on the form values or props
  const [memberOnlyEnabled, setMemberOnlyEnabled] = useState(
    event?.member_only ?? false
  );
  const [collectionEnabled, setCollectionEnabled] = useState(
    event?.is_collection ?? false
  );
  const [pricingEnabled, setPricingEnabled] = useState(
    !!(event?.price !== null && event?.price !== undefined) ||
      !!event?.ticket_url
  );

  return (
    <div className="space-y-4">
      <ToggleSection
        description={t("editor.membersOnlyDescription")}
        enabled={memberOnlyEnabled}
        icon={Users}
        onToggle={(enabled) => {
          setMemberOnlyEnabled(enabled);
          form.setValue("member_only", enabled);
        }}
        title={t("editor.membersOnlyTitle")}
      >
        <div className="rounded-lg border border-primary/20 bg-white/40 p-4">
          <p className="text-muted-foreground text-sm">
            {t("editor.membersOnlyMessage")}
          </p>
        </div>
      </ToggleSection>

      <ToggleSection
        description={t("editor.pricingDescription")}
        enabled={pricingEnabled}
        icon={DollarSign}
        onToggle={(enabled) => {
          setPricingEnabled(enabled);
          if (!enabled) {
            form.setValue("price", undefined);
            form.setValue("ticket_url", "");
          }
        }}
        title={t("editor.pricingTitle")}
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.priceLabel")}</FormLabel>
                <FormControl>
                  <Input
                    className="glass-input"
                    onChange={(newEvent) => {
                      const value = newEvent.target.value;
                      if (value === "") {
                        field.onChange(undefined);
                      } else {
                        const num = Number(value);
                        field.onChange(Number.isNaN(num) ? undefined : num);
                      }
                    }}
                    placeholder="0"
                    step="1"
                    type="number"
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>{t("editor.priceDescription")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ticket_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.ticketUrlLabel")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://..."
                    {...field}
                    className="glass-input"
                  />
                </FormControl>
                <FormDescription>
                  {t("editor.ticketUrlDescription")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </ToggleSection>

      <ToggleSection
        description={t("editor.collectionDescription")}
        enabled={collectionEnabled}
        icon={Ticket}
        onToggle={(enabled) => {
          setCollectionEnabled(enabled);
          form.setValue("is_collection", enabled);
          if (!enabled) {
            form.setValue("collection_id", "");
            form.setValue("collection_pricing", undefined);
          }
        }}
        title={t("editor.collectionTitle")}
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="collection_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.collectionIdLabel")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("editor.collectionIdPlaceholder")}
                    {...field}
                    className="glass-input"
                  />
                </FormControl>
                <FormDescription>
                  {t("editor.collectionIdDescription")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="collection_pricing"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.collectionPricingLabel")}</FormLabel>
                <Select
                  onValueChange={(value) =>
                    field.onChange(value as "bundle" | "individual")
                  }
                  value={field.value ?? undefined}
                >
                  <FormControl>
                    <SelectTrigger className="glass-input">
                      <SelectValue
                        placeholder={t("editor.collectionPricingPlaceholder")}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="bundle">
                      {t("editor.collectionBundle")}
                    </SelectItem>
                    <SelectItem value="individual">
                      {t("editor.collectionIndividual")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t("editor.collectionPricingDescription")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </ToggleSection>
    </div>
  );
}
