"use client";

import type { BenefitPartner, CampusBenefit } from "@repo/api/types/appwrite";
import { BenefitStatus } from "@repo/api/types/appwrite";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import {
  createBenefit,
  publishBenefit,
  updateBenefit,
} from "@/app/actions/benefits";
import { toast } from "@/lib/hooks/use-toast";
import type { BenefitFormValues } from "./benefit-form-schema";
import { benefitFormSchema } from "./benefit-form-schema";

interface UseBenefitEditorOptions {
  benefit: CampusBenefit | null;
  defaultCampusId: string;
  partners: BenefitPartner[];
}

export function useBenefitEditor({
  benefit,
  defaultCampusId,
  partners,
}: UseBenefitEditorOptions) {
  const router = useRouter();
  const publishIntentRef = useRef(false);

  const form = useForm({
    defaultValues: {
      campus_id: benefit?.campus_id ?? defaultCampusId,
      status: benefit?.status ?? BenefitStatus.DRAFT,
      kind: (benefit?.kind ?? "offer") as BenefitFormValues["kind"],
      redemption_type: (benefit?.redemption_type ??
        "none") as BenefitFormValues["redemption_type"],
      category: benefit?.category ?? "Career",
      partner_id: benefit?.partner_id ?? null,
      partner_name: benefit?.partner_name ?? null,
      partner_logo_url: benefit?.partner_logo_url ?? null,
      title_nb: benefit?.title_nb ?? "",
      title_en: benefit?.title_en ?? "",
      description_nb: benefit?.description_nb ?? "",
      description_en: benefit?.description_en ?? "",
      teaser_nb: benefit?.teaser_nb ?? null,
      teaser_en: benefit?.teaser_en ?? null,
      terms_nb: benefit?.terms_nb ?? null,
      terms_en: benefit?.terms_en ?? null,
      redemption_value: benefit?.redemption_value ?? null,
      image_url: benefit?.image_url ?? null,
      is_featured: benefit?.is_featured ?? false,
      publish_start: benefit?.publish_start ?? null,
      publish_end: benefit?.publish_end ?? null,
      sort_order: benefit?.sort_order ?? 0,
    } satisfies BenefitFormValues,
    validators: {
      onSubmit: benefitFormSchema,
    },
    onSubmit: async ({ value }) => {
      const publish = publishIntentRef.current;
      // Always explicitly set the status based on the user's intent so that
      // "Save as draft" correctly unpublishes and "Publish" correctly publishes,
      // regardless of what the form's status field currently holds.
      const statusToSave = publish ? BenefitStatus.PUBLISHED : BenefitStatus.DRAFT;
      const valueToSave = { ...value, status: statusToSave };

      try {
        if (benefit) {
          await updateBenefit(benefit.$id, valueToSave);
          if (publish) {
            await publishBenefit(benefit.$id);
          }
          toast({
            title: publish ? "Benefit published" : "Saved as draft",
            description: publish
              ? "The benefit is now live."
              : "Changes saved. The benefit is no longer public.",
          });
        } else {
          const created = await createBenefit(valueToSave);
          if (publish && created.$id) {
            await publishBenefit(created.$id);
          }
          toast({
            title: publish ? "Benefit published" : "Benefit created",
            description: publish
              ? "The benefit is now live."
              : "Saved as a draft.",
          });
          router.push(`/membership/benefits/${created.$id}`);
        }
        router.refresh();
      } catch (e) {
        toast({
          title: "Save failed",
          description:
            e instanceof Error ? e.message : "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    },
  });

  const handleSave = (publish: boolean) => {
    publishIntentRef.current = publish;
    form.handleSubmit();
  };

  const handlePartnerSelect = (partnerId: string) => {
    if (partnerId === "none") {
      form.setFieldValue("partner_id", null);
      form.setFieldValue("partner_name", null);
      form.setFieldValue("partner_logo_url", null);
      return;
    }
    const partner = partners.find((p) => p.$id === partnerId);
    if (partner) {
      form.setFieldValue("partner_id", partner.$id);
      form.setFieldValue("partner_name", partner.name);
      form.setFieldValue("partner_logo_url", partner.logo_url ?? null);
    }
  };

  return { form, handleSave, handlePartnerSelect };
}

export type BenefitEditorForm = ReturnType<typeof useBenefitEditor>["form"];
