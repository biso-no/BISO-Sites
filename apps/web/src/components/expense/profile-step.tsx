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

const IBAN_REGEX = /^[A-Z]{2}/;

type ProfileStepProps = {
 profile: Partial<Users>;
 onNext: (profile: Partial<Users>) => void;
 onUpdateProfile?: (profile: Partial<Users>) => Promise<void>;
};

type EditableFieldProps = {
 label: string;
 value?: string | null;
 placeholder?: string;
 required?: boolean;
 helperText?: string;
 inputType?: string;
 showInput: boolean;
 onChange: (value: string) => void;
 className?: string;
};

type ReadonlyFieldProps = {
 label: string;
 value?: string | null;
 helperText?: string;
};

const ReadonlyField = ({ label, value, helperText }: ReadonlyFieldProps) => (
 <div>
 <Label>{label}</Label>
 <Input className="bg-section" disabled value={value || ""} />
 {helperText ? (
 <p className="mt-1 text-muted-foreground text-xs">{helperText}</p>
 ) : null}
 </div>
);

const EditableField = ({
 label,
 value,
 placeholder,
 required,
 helperText,
 inputType = "text",
 showInput,
 onChange,
 className,
}: EditableFieldProps) => (
 <div className={className}>
 <Label>
 {label} {required ? "*" : ""}
 </Label>
 {showInput ? (
 <Input
 onChange={(e) => onChange(e.target.value)}
 placeholder={placeholder}
 type={inputType}
 value={value || ""}
 />
 ) : (
 <div className="rounded-md bg-section p-3 text-muted-foreground">{value}</div>
 )}
 {helperText ? (
 <p className="mt-1 text-muted-foreground text-xs">{helperText}</p>
 ) : null}
 </div>
);

export function ProfileStep({
 profile: initialProfile,
 onNext,
 onUpdateProfile,
}: ProfileStepProps) {
 const [editing, setEditing] = useState(false);
 const [profile, setProfile] = useState(initialProfile);
 const [isSaving, setIsSaving] = useState(false);

 const isIBAN = (account: string) =>
 IBAN_REGEX.test(account?.replace(/\s/g, "") || "");

 const canProceed =
 profile.name &&
 profile.phone &&
 profile.address &&
 profile.zip &&
 profile.city &&
 profile.bank_account;

 const showInputs = editing || !canProceed;
 const accountIsIBAN = isIBAN(profile.bank_account || "");

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
 <h2 className="mb-6 text-foreground">Contact & Banking Information</h2>

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
 <h3 className="text-foreground">Contact Information</h3>
 {!editing && canProceed && (
 <Button
 className="border-brand-border text-brand hover:bg-brand-muted"
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
 <ReadonlyField
 helperText="Cannot be edited"
 label="Full Name"
 value={profile.name}
 />
 <ReadonlyField
 helperText="Cannot be edited"
 label="Email"
 value={profile.email}
 />
 <EditableField
 label="Phone Number"
 onChange={(value) => setProfile({ ...profile, phone: value })}
 placeholder="+47 123 45 678"
 required
 showInput={showInputs}
 value={profile.phone}
 />
 <EditableField
 className="md:col-span-2"
 label="Address"
 onChange={(value) => setProfile({ ...profile, address: value })}
 placeholder="Street name and number"
 required
 showInput={showInputs}
 value={profile.address}
 />
 <EditableField
 label="Postal Code"
 onChange={(value) => setProfile({ ...profile, zip: value })}
 placeholder="0123"
 required
 showInput={showInputs}
 value={profile.zip}
 />
 <EditableField
 label="City"
 onChange={(value) => setProfile({ ...profile, city: value })}
 placeholder="Oslo"
 required
 showInput={showInputs}
 value={profile.city}
 />
 </div>
 </div>

 <Separator className="my-8" />

 {/* Banking Information */}
 <div>
 <div className="mb-4 flex items-center justify-between">
 <h3 className="text-foreground">Banking Information</h3>
 </div>

 <div className="grid gap-6 md:grid-cols-2">
 <EditableField
 className={accountIsIBAN ? "md:col-span-1" : "md:col-span-2"}
 helperText="Norwegian account number or IBAN"
 label="Bank Account / IBAN"
 onChange={(value) =>
 setProfile({ ...profile, bank_account: value })
 }
 placeholder="1234 56 78901 or NO93 8601 1117 947"
 required
 showInput={showInputs}
 value={profile.bank_account}
 />

 {accountIsIBAN ? (
 <EditableField
 helperText="Required for IBAN accounts"
 label="SWIFT/BIC"
 onChange={(value) => setProfile({ ...profile, swift: value })}
 placeholder="DABANO22"
 required
 showInput={showInputs}
 value={profile.swift}
 />
 ) : null}
 </div>
 </div>

 {editing && (
 <div className="mt-8 flex gap-3">
 <Button
 className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
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
 className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
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
