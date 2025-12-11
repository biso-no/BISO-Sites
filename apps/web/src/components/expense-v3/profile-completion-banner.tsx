"use client";

import type { Users } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { AlertTriangle, Loader2, UserCog } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/actions/user";

type RequiredProfileFields = {
  name: string | null;
  email: string | null;
  phone: string | null;
  bank_account: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
};

type ProfileCompletionBannerProps = {
  userProfile: Partial<Users>;
  onProfileUpdate: (profile: Partial<Users>) => void;
};

const REQUIRED_FIELDS: (keyof RequiredProfileFields)[] = [
  "name",
  "email",
  "phone",
  "bank_account",
  "address",
  "zip",
  "city",
];

const FIELD_LABELS: Record<keyof RequiredProfileFields, string> = {
  name: "Full Name",
  email: "Email Address",
  phone: "Phone Number",
  bank_account: "Bank Account Number",
  address: "Street Address",
  zip: "Postal Code",
  city: "City",
};

function getMissingFields(
  profile: Partial<Users>
): (keyof RequiredProfileFields)[] {
  return REQUIRED_FIELDS.filter((field) => !profile[field]);
}

export function ProfileCompletionBanner({
  userProfile,
  onProfileUpdate,
}: ProfileCompletionBannerProps) {
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
        `Please fill in: ${stillMissing.map((f) => FIELD_LABELS[f]).join(", ")}`
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
        toast.success("Profile updated successfully");
        onProfileUpdate({ ...userProfile, ...updateData });
        setIsOpen(false);
      } else {
        toast.error("Failed to update profile");
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
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 space-y-2">
            <p className="font-medium text-amber-900 text-sm dark:text-amber-200">
              Complete Your Profile
            </p>
            <p className="text-amber-700 text-xs dark:text-amber-400">
              The following information is required to submit expenses:{" "}
              <span className="font-medium">
                {missingFields.map((f) => FIELD_LABELS[f]).join(", ")}
              </span>
            </p>
            <Button
              className="mt-2 gap-2 border-amber-200 bg-background text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/50"
              onClick={() => setIsOpen(true)}
              size="sm"
              variant="outline"
            >
              <UserCog className="h-4 w-4" />
              Update Profile
            </Button>
          </div>
        </div>
      </div>

      <Dialog onOpenChange={setIsOpen} open={isOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Profile</DialogTitle>
            <DialogDescription>
              Please provide the following information to submit expense
              reports.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {missingFields.map((field) => (
              <div className="space-y-2" key={field}>
                <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
                <Input
                  id={field}
                  onChange={(e) => handleInputChange(field, e.target.value)}
                  placeholder={
                    field === "bank_account"
                      ? "1234 56 78901"
                      : field === "phone"
                        ? "+47 123 45 678"
                        : field === "email"
                          ? "your@email.com"
                          : field === "address"
                            ? "Street name 123"
                            : field === "zip"
                              ? "0123"
                              : field === "city"
                                ? "Oslo"
                                : "Your full name"
                  }
                  type={field === "email" ? "email" : "text"}
                  value={formData[field] ?? ""}
                />
              </div>
            ))}

            <DialogFooter className="pt-4">
              <Button
                onClick={() => setIsOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
