"use client";

import type { Users } from "@repo/api/types/appwrite";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle, Loader2, UserCog, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/actions/user";
import {
  fieldClass,
  fieldLabelClass,
  focusRingClass,
  primaryActionClass,
  secondaryActionClass,
} from "./form-styles";

interface RequiredProfileFields {
  address: string | null;
  bank_account: string | null;
  city: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  zip: string | null;
}

interface ProfileCompletionBannerProps {
  onProfileUpdate: (profile: Partial<Users>) => void;
  userProfile: Partial<Users>;
}

const REQUIRED_FIELDS: (keyof RequiredProfileFields)[] = [
  "name",
  "email",
  "phone",
  "bank_account",
  "address",
  "zip",
  "city",
];

function getMissingFields(
  profile: Partial<Users>
): (keyof RequiredProfileFields)[] {
  return REQUIRED_FIELDS.filter((field) => !profile[field]);
}

export function ProfileCompletionBanner({
  userProfile,
  onProfileUpdate,
}: ProfileCompletionBannerProps) {
  const t = useTranslations("expenses");
  const idPrefix = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<RequiredProfileFields>({
    name: userProfile.name ?? "",
    email: userProfile.email ?? "",
    phone: userProfile.phone ?? "",
    bank_account: userProfile.bank_account ?? "",
    address: userProfile.address ?? "",
    zip: userProfile.zip ?? "",
    city: userProfile.city ?? "",
  });

  const fieldLabels: Record<keyof RequiredProfileFields, string> = {
    name: t("composer.profile.fields.name"),
    email: t("composer.profile.fields.email"),
    phone: t("composer.profile.fields.phone"),
    bank_account: t("composer.profile.fields.bankAccount"),
    address: t("composer.profile.fields.address"),
    zip: t("composer.profile.fields.zip"),
    city: t("composer.profile.fields.city"),
  };
  const fieldPlaceholders: Record<keyof RequiredProfileFields, string> = {
    name: t("composer.profile.placeholders.name"),
    email: t("composer.profile.placeholders.email"),
    phone: t("composer.profile.placeholders.phone"),
    bank_account: t("composer.profile.placeholders.bankAccount"),
    address: t("composer.profile.placeholders.address"),
    zip: t("composer.profile.placeholders.zip"),
    city: t("composer.profile.placeholders.city"),
  };

  const missingFields = getMissingFields(userProfile);

  if (missingFields.length === 0) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only validate the fields that were missing (shown in the form)
    const stillMissing = missingFields.filter((field) => !formData[field]);
    if (stillMissing.length > 0) {
      toast.error(
        t("composer.profile.missing", {
          fields: stillMissing.map((f) => fieldLabels[f]).join(", "),
        })
      );
      return;
    }

    // Only send the fields that were missing
    const updateData: Partial<RequiredProfileFields> = {};
    for (const field of missingFields) {
      updateData[field] = formData[field];
    }

    startTransition(async () => {
      const result = await updateProfile(updateData);
      if (result) {
        toast.success(t("composer.profile.updated"));
        onProfileUpdate({ ...userProfile, ...updateData });
        setIsOpen(false);
      } else {
        toast.error(t("composer.profile.updateFailed"));
      }
    });
  };

  const handleInputChange = (
    field: keyof RequiredProfileFields,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <div
        className="mt-6 rounded-biso-md border border-warning/30 bg-warning/10 p-4"
        role="status"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-warning"
          />
          <div className="type-body-sm min-w-0 flex-1 space-y-2 text-ink">
            <p className="font-semibold">{t("composer.profile.title")}</p>
            <p>
              {t("composer.profile.required")}{" "}
              <span className="font-semibold">
                {missingFields.map((f) => fieldLabels[f]).join(", ")}
              </span>
            </p>
            <button
              className={cn(secondaryActionClass, "mt-2 bg-surface")}
              onClick={() => setIsOpen(true)}
              type="button"
            >
              <UserCog aria-hidden="true" className="size-4 shrink-0" />
              {t("composer.profile.update")}
            </button>
          </div>
        </div>
      </div>

      <Dialog onOpenChange={setIsOpen} open={isOpen}>
        <DialogContent
          className="rounded-biso-lg border-edge bg-surface text-ink shadow-elev-2 sm:max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="type-heading-card pr-8 text-ink">
              {t("composer.profile.title")}
            </DialogTitle>
            <DialogDescription className="type-body-sm text-ink-muted">
              {t("composer.profile.dialogBody")}
            </DialogDescription>
          </DialogHeader>
          <DialogClose
            aria-label={t("composer.close")}
            className={cn(
              "absolute top-4 right-4 rounded-biso-sm p-1 text-ink-muted transition-colors hover:text-ink",
              focusRingClass
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </DialogClose>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {missingFields.map((field) => (
              <div className="space-y-2" key={field}>
                <label
                  className={fieldLabelClass}
                  htmlFor={`${idPrefix}-${field}`}
                >
                  {fieldLabels[field]}
                </label>
                <Input
                  className={fieldClass}
                  id={`${idPrefix}-${field}`}
                  onChange={(e) => handleInputChange(field, e.target.value)}
                  placeholder={fieldPlaceholders[field]}
                  type={field === "email" ? "email" : "text"}
                  value={formData[field] ?? ""}
                />
              </div>
            ))}

            <DialogFooter className="border-edge border-t pt-4">
              <button
                className={secondaryActionClass}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                {t("composer.profile.cancel")}
              </button>
              <button
                aria-busy={isPending}
                className={primaryActionClass}
                disabled={isPending}
                type="submit"
              >
                {isPending ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 shrink-0 animate-spin"
                    />
                    {t("composer.profile.saving")}
                  </>
                ) : (
                  t("composer.profile.save")
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
