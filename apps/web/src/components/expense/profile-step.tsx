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

interface ProfileStepProps {
  profile: Partial<Users>;
  onNext: (profile: Partial<Users>) => void;
  onUpdateProfile?: (profile: Partial<Users>) => Promise<void>;
}

export function ProfileStep({
  profile: initialProfile,
  onNext,
  onUpdateProfile,
}: ProfileStepProps) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [isSaving, setIsSaving] = useState(false);

  const isIBAN = (account: string) => {
    return /^[A-Z]{2}/.test(account?.replace(/\s/g, "") || "");
  };

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
    <Card className="p-8 border-0 shadow-lg">
      <h2 className="text-gray-900 mb-6">Contact & Banking Information</h2>

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900">Contact Information</h3>
          {!editing && canProceed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Label>Full Name</Label>
            <Input value={profile.name || ""} disabled className="bg-gray-50" />
            <p className="text-xs text-gray-500 mt-1">Cannot be edited</p>
          </div>

          <div>
            <Label>Email</Label>
            <Input value={profile.email || ""} disabled className="bg-gray-50" />
            <p className="text-xs text-gray-500 mt-1">Cannot be edited</p>
          </div>

          <div>
            <Label>Phone Number *</Label>
            {editing || !canProceed ? (
              <Input
                value={profile.phone || ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+47 123 45 678"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md text-gray-700">{profile.phone}</div>
            )}
          </div>

          <div className="md:col-span-2">
            <Label>Address *</Label>
            {editing || !canProceed ? (
              <Input
                value={profile.address || ""}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Street name and number"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md text-gray-700">{profile.address}</div>
            )}
          </div>

          <div>
            <Label>Postal Code *</Label>
            {editing || !canProceed ? (
              <Input
                value={profile.zip || ""}
                onChange={(e) => setProfile({ ...profile, zip: e.target.value })}
                placeholder="0123"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md text-gray-700">{profile.zip}</div>
            )}
          </div>

          <div>
            <Label>City *</Label>
            {editing || !canProceed ? (
              <Input
                value={profile.city || ""}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder="Oslo"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md text-gray-700">{profile.city}</div>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Banking Information */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900">Banking Information</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className={isIBAN(profile.bank_account || "") ? "md:col-span-1" : "md:col-span-2"}>
            <Label>Bank Account / IBAN *</Label>
            {editing || !canProceed ? (
              <Input
                value={profile.bank_account || ""}
                onChange={(e) => setProfile({ ...profile, bank_account: e.target.value })}
                placeholder="1234 56 78901 or NO93 8601 1117 947"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md text-gray-700">{profile.bank_account}</div>
            )}
            <p className="text-xs text-gray-500 mt-1">Norwegian account number or IBAN</p>
          </div>

          {isIBAN(profile.bank_account || "") && (
            <div>
              <Label>SWIFT/BIC *</Label>
              {editing || !canProceed ? (
                <Input
                  value={profile.swift || ""}
                  onChange={(e) => setProfile({ ...profile, swift: e.target.value })}
                  placeholder="DABANO22"
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md text-gray-700">{profile.swift}</div>
              )}
              <p className="text-xs text-gray-500 mt-1">Required for IBAN accounts</p>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-8 flex gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setProfile(initialProfile);
              setEditing(false);
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button
          onClick={() => onNext(profile)}
          disabled={!canProceed}
          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
        >
          Next: Campus & Department
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}
