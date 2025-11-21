"use client";

import type { Users } from "@repo/api/types/appwrite";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { AlertCircle, ChevronRight, Edit, Save } from "lucide-react";
import { useState } from "react";

type ProfileStepProps = {
  profile: Partial<Users>;
  onNext: (profile: Partial<Users>) => void;
  onUpdateProfile?: (profile: Partial<Users>) => Promise<void>;
};

export function ProfileStep({
  profile: initialProfile,
  onNext,
  onUpdateProfile,
}: ProfileStepProps) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [isSaving, setIsSaving] = useState(false);

  const isIBAN = (account: string) =>
    /^[A-Z]{2}/.test(account?.replace(/\s/g, "") || "");

  const canProceed =
    profile.name &&
    profile.phone &&
    profile.address &&
    profile.zip &&
    profile.city &&
    profile.bank_account;

  const handleSave = async () => {
    if (onUpdateProfile) {
      setIsSaving(true);
      try {
        await onUpdateProfile(profile);
      } finally {
        setIsSaving(false);
      }
    }
    setEditing(false);
  };

  return (
    <Card className="border-0 p-8 shadow-lg">
      <h2 className="mb-6 text-gray-900">Contact & Banking Information</h2>

      {!canProceed && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Please complete your profile information to submit a reimbursement.
          </AlertDescription>
        </Alert>
      )}

      {/* Contact Information */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-gray-900">Contact Information</h3>
          {!editing && canProceed && (
            <Button
              className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
              onClick={() => setEditing(true)}
              size="sm"
              variant="outline"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Full Name</Label>
            <Input className="bg-gray-50" disabled value={profile.name || ""} />
            <p className="mt-1 text-gray-500 text-xs">Cannot be edited</p>
          </div>

          <div>
            <Label>Email</Label>
            <Input
              className="bg-gray-50"
              disabled
              value={profile.email || ""}
            />
            <p className="mt-1 text-gray-500 text-xs">Cannot be edited</p>
          </div>

          <div>
            <Label>Phone Number *</Label>
            {editing || !canProceed ? (
              <Input
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                placeholder="+47 123 45 678"
                value={profile.phone || ""}
              />
            ) : (
              <div className="rounded-md bg-gray-50 p-3 text-gray-700">
                {profile.phone}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <Label>Address *</Label>
            {editing || !canProceed ? (
              <Input
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
                placeholder="Street name and number"
                value={profile.address || ""}
              />
            ) : (
              <div className="rounded-md bg-gray-50 p-3 text-gray-700">
                {profile.address}
              </div>
            )}
          </div>

          <div>
            <Label>Postal Code *</Label>
            {editing || !canProceed ? (
              <Input
                onChange={(e) =>
                  setProfile({ ...profile, zip: e.target.value })
                }
                placeholder="0123"
                value={profile.zip || ""}
              />
            ) : (
              <div className="rounded-md bg-gray-50 p-3 text-gray-700">
                {profile.zip}
              </div>
            )}
          </div>

          <div>
            <Label>City *</Label>
            {editing || !canProceed ? (
              <Input
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
                placeholder="Oslo"
                value={profile.city || ""}
              />
            ) : (
              <div className="rounded-md bg-gray-50 p-3 text-gray-700">
                {profile.city}
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Banking Information */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-gray-900">Banking Information</h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div
            className={
              isIBAN(profile.bank_account || "")
                ? "md:col-span-1"
                : "md:col-span-2"
            }
          >
            <Label>Bank Account / IBAN *</Label>
            {editing || !canProceed ? (
              <Input
                onChange={(e) =>
                  setProfile({ ...profile, bank_account: e.target.value })
                }
                placeholder="1234 56 78901 or NO93 8601 1117 947"
                value={profile.bank_account || ""}
              />
            ) : (
              <div className="rounded-md bg-gray-50 p-3 text-gray-700">
                {profile.bank_account}
              </div>
            )}
            <p className="mt-1 text-gray-500 text-xs">
              Norwegian account number or IBAN
            </p>
          </div>

          {isIBAN(profile.bank_account || "") && (
            <div>
              <Label>SWIFT/BIC *</Label>
              {editing || !canProceed ? (
                <Input
                  onChange={(e) =>
                    setProfile({ ...profile, swift: e.target.value })
                  }
                  placeholder="DABANO22"
                  value={profile.swift || ""}
                />
              ) : (
                <div className="rounded-md bg-gray-50 p-3 text-gray-700">
                  {profile.swift}
                </div>
              )}
              <p className="mt-1 text-gray-500 text-xs">
                Required for IBAN accounts
              </p>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-8 flex gap-3">
          <Button
            className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
            disabled={isSaving}
            onClick={handleSave}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              setProfile(initialProfile);
              setEditing(false);
            }}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button
          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
          disabled={!canProceed}
          onClick={() => onNext(profile)}
        >
          Next: Campus & Department
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
