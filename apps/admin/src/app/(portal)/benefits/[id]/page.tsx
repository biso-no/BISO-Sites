import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { getBenefit } from "../../_actions/benefits";
import { listCampuses } from "../../_actions/jobs";
import { BenefitEditorClient } from "./_components/benefit-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BenefitEditorPage({ params }: Props) {
  await requireNavAccess("portal.benefits");
  const { id } = await params;
  const t = await getTranslations("adminPortal.benefits");

  const isNew = id === "new";
  const [benefit, campuses] = await Promise.all([
    isNew ? null : getBenefit(id),
    listCampuses(),
  ]);

  if (!(isNew || benefit)) {
    notFound();
  }

  return (
    <BenefitEditorClient
      benefit={benefit}
      campuses={campuses}
      isNew={isNew}
      labels={{
        back: t("title"),
        titleNo: t("fields.titleNo"),
        titleEn: t("fields.titleEn"),
        descriptionNo: t("fields.descriptionNo"),
        descriptionEn: t("fields.descriptionEn"),
        kind: t("fields.kind"),
        redemptionType: t("fields.redemptionType"),
        redemptionValue: t("fields.redemptionValue"),
        category: t("fields.category"),
        campus: "Campus",
        imageUrl: t("fields.imageUrl"),
        status: t("fields.status"),
        partnerName: t("fields.partnerName"),
        isFeatured: t("fields.isFeatured"),
        isMemberOnly: t("fields.isMemberOnly"),
        discard: "Discard",
        saveDraft: "Save Draft",
        publish: "Publish",
        preview: t("preview"),
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        publishSuccess: t("publishSuccess"),
      }}
    />
  );
}
