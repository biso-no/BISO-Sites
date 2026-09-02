"use client";

import {
  UNIT_CATEGORIES,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDepartment } from "@/app/(portal)/_actions/departments";
import {
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/app/(portal)/_components/portal-fields";
import {
  SERIF_STACK,
  STUDIO,
  StudioButton,
  StudioPanel,
} from "@/app/(portal)/_components/studio";
import { UnitImageField } from "./unit-image-field";

const LOCALES = ["no", "en"] as const;
type Locale = (typeof LOCALES)[number];

export interface UnitProfileTranslation {
  description: string;
  short_description: string;
  title: string;
}

export interface UnitProfileInitialValues {
  hero: string | null;
  logo: string | null;
  translations: Record<Locale, UnitProfileTranslation>;
  type: UnitCategory | null;
}

const emptyTranslation = (): UnitProfileTranslation => ({
  description: "",
  short_description: "",
  title: "",
});

export function UnitProfileCard({
  departmentId,
  initial,
}: {
  departmentId: string;
  initial: UnitProfileInitialValues;
}) {
  const t = useTranslations("adminPortal.departments");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<UnitCategory | "">(initial.type ?? "");
  const [logo, setLogo] = useState<string | null>(initial.logo);
  const [hero, setHero] = useState<string | null>(initial.hero);
  const [translations, setTranslations] = useState(initial.translations);
  const [activeLocale, setActiveLocale] = useState<Locale>("no");

  const active = translations[activeLocale] ?? emptyTranslation();

  const patchTranslation = (patch: Partial<UnitProfileTranslation>) => {
    setTranslations((current) => ({
      ...current,
      [activeLocale]: {
        ...(current[activeLocale] ?? emptyTranslation()),
        ...patch,
      },
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateDepartment(departmentId, {
        hero,
        logo,
        translations,
        type: type === "" ? null : type,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("profile.saved"));
      router.refresh();
    });
  };

  const imageLabels = {
    browse: t("profile.imageBrowse"),
    constraints: t("profile.imageConstraints"),
    remove: t("profile.imageRemove"),
    replace: t("profile.imageReplace"),
    uploading: t("profile.imageUploading"),
  };

  return (
    <StudioPanel className="mt-6 p-5">
      <h2
        className="text-xl leading-6"
        style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
      >
        {t("profile.heading")}
      </h2>
      <p className="mt-1 mb-5 text-sm" style={{ color: STUDIO.ink3 }}>
        {t("profile.description")}
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <PortalField
            hint={t("profile.typeHint")}
            label={t("profile.typeLabel")}
          >
            <PortalSelect
              disabled={pending}
              id="unit-type"
              onChange={(event) =>
                setType(event.target.value as UnitCategory | "")
              }
              options={[
                { label: t("profile.typeNone"), value: "" },
                ...UNIT_CATEGORIES.map((category) => ({
                  label: t(`categories.${category}`),
                  value: category,
                })),
              ]}
              value={type}
            />
          </PortalField>
        </div>

        <PortalField
          hint={t("profile.logoHint")}
          label={t("profile.logoLabel")}
        >
          <UnitImageField
            disabled={pending}
            labels={imageLabels}
            onChange={setLogo}
            previewHeightClass="h-32"
            storage="fileId"
            value={logo}
          />
        </PortalField>

        <PortalField
          hint={t("profile.heroHint")}
          label={t("profile.heroLabel")}
        >
          <UnitImageField
            disabled={pending}
            labels={imageLabels}
            onChange={setHero}
            previewHeightClass="h-32"
            storage="url"
            value={hero}
          />
        </PortalField>
      </div>

      <div className="mt-6 border-t pt-5" style={{ borderColor: STUDIO.rule }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3
            className="text-lg leading-6"
            style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
          >
            {t("profile.contentHeading")}
          </h3>
          <div
            className="flex overflow-hidden rounded-lg"
            style={{ border: `0.5px solid ${STUDIO.rule2}` }}
          >
            {LOCALES.map((locale) => (
              <button
                className="px-3 py-1.5 font-medium text-xs transition"
                key={locale}
                onClick={() => setActiveLocale(locale)}
                style={{
                  background:
                    activeLocale === locale ? STUDIO.ink : "transparent",
                  color: activeLocale === locale ? STUDIO.paper : STUDIO.ink3,
                }}
                type="button"
              >
                {t(locale === "no" ? "actions.localeNo" : "actions.localeEn")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <PortalField
            hint={t("profile.titleHint")}
            label={t("profile.titleLabel")}
          >
            <PortalTextarea
              disabled={pending}
              maxLength={500}
              onChange={(event) =>
                patchTranslation({ title: event.target.value })
              }
              rows={1}
              value={active.title}
            />
          </PortalField>

          <PortalField
            hint={t("profile.shortDescriptionHint")}
            label={t("profile.shortDescriptionLabel")}
          >
            <PortalTextarea
              disabled={pending}
              maxLength={500}
              onChange={(event) =>
                patchTranslation({ short_description: event.target.value })
              }
              rows={2}
              value={active.short_description}
            />
          </PortalField>

          <PortalField
            hint={t("profile.descriptionHint")}
            label={t("profile.descriptionLabel")}
          >
            <PortalTextarea
              disabled={pending}
              maxLength={8000}
              onChange={(event) =>
                patchTranslation({ description: event.target.value })
              }
              rows={8}
              value={active.description}
            />
          </PortalField>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <StudioButton disabled={pending} onClick={handleSave} variant="primary">
          <Save size={15} />
          {pending ? t("profile.saving") : t("profile.save")}
        </StudioButton>
      </div>
    </StudioPanel>
  );
}
