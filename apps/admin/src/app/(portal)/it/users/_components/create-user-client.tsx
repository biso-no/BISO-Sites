"use client";

import type { M365CreateUserInput } from "@repo/shared/types/user-management";
import { ArrowLeft, Copy, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createM365User } from "../../../_actions/it-users";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../../_components/portal-fields";
import {
  buttonStyle,
  STUDIO,
  studioSurface,
} from "../../../_components/studio";

interface CreateUserClientProps {
  labels: {
    accountEnabled: string;
    campus: string;
    create: string;
    department: string;
    givenName: string;
    jobTitle: string;
    mailNickname: string;
    surname: string;
    temporaryPassword: string;
    userPrincipalName: string;
  };
  options: {
    campuses: Array<{ id: string; name: string; officeLocation: string }>;
    departments: Array<{ campusId: string; id: string; name: string }>;
  };
}

export function CreateUserClient({ labels, options }: CreateUserClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [campusId, setCampusId] = useState(options.campuses[0]?.id ?? "");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );

  const departments = options.departments.filter(
    (department) => department.campusId === campusId
  );

  function handleSubmit(formData: FormData) {
    const payload: M365CreateUserInput = {
      accountEnabled: formData.get("accountEnabled") === "true",
      campusId: String(formData.get("campusId") ?? ""),
      departmentId: String(formData.get("departmentId") ?? ""),
      forceChangePasswordNextSignIn: true,
      givenName: String(formData.get("givenName") ?? ""),
      jobTitle: String(formData.get("jobTitle") ?? "") || undefined,
      mailNickname: String(formData.get("mailNickname") ?? "") || undefined,
      surname: String(formData.get("surname") ?? ""),
      userPrincipalName:
        String(formData.get("userPrincipalName") ?? "") || undefined,
    };

    startTransition(async () => {
      const result = await createM365User(payload);
      if (result.error || !result.data) {
        toast.error(result.error);
        return;
      }

      setTemporaryPassword(result.data.temporaryPassword);
      toast.success("Microsoft 365 user created");
      router.refresh();
    });
  }

  function copyTemporaryPassword() {
    if (!temporaryPassword) {
      return;
    }
    navigator.clipboard.writeText(temporaryPassword);
    toast.success("Temporary password copied");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form action={handleSubmit} className="space-y-5">
        <div
          className="grid gap-4 rounded-2xl p-6 md:grid-cols-2"
          style={studioSurface}
        >
          <PortalField label={labels.givenName} required>
            <PortalInput name="givenName" required />
          </PortalField>
          <PortalField label={labels.surname} required>
            <PortalInput name="surname" required />
          </PortalField>
          <PortalField label={labels.userPrincipalName}>
            <PortalInput name="userPrincipalName" type="email" />
          </PortalField>
          <PortalField label={labels.mailNickname}>
            <PortalInput name="mailNickname" />
          </PortalField>
          <PortalField label={labels.jobTitle}>
            <PortalInput name="jobTitle" />
          </PortalField>
          <PortalField label={labels.accountEnabled}>
            <PortalSelect
              defaultValue="true"
              name="accountEnabled"
              options={[
                { label: "Enabled", value: "true" },
                { label: "Disabled", value: "false" },
              ]}
            />
          </PortalField>
          <PortalField label={labels.campus} required>
            <PortalSelect
              name="campusId"
              onChange={(event) => setCampusId(event.currentTarget.value)}
              options={options.campuses.map((campus) => ({
                label: campus.name,
                value: campus.id,
              }))}
              required
              value={campusId}
            />
          </PortalField>
          <PortalField label={labels.department} required>
            <PortalSelect
              name="departmentId"
              options={departments.map((department) => ({
                label: department.name,
                value: department.id,
              }))}
              required
            />
          </PortalField>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm transition-all disabled:opacity-50"
            disabled={isPending}
            style={buttonStyle("primary")}
            type="submit"
          >
            <UserPlus size={15} />
            {labels.create}
          </button>
          <Link
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
            href="/it/users"
            style={buttonStyle("secondary")}
          >
            <ArrowLeft size={15} />
            Back
          </Link>
        </div>
      </form>

      <aside className="h-fit rounded-2xl p-5" style={studioSurface}>
        <p className="font-medium text-sm" style={{ color: STUDIO.ink }}>
          {labels.temporaryPassword}
        </p>
        {temporaryPassword ? (
          <button
            className="mt-3 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-mono text-sm"
            onClick={copyTemporaryPassword}
            style={{
              background: "rgba(107,30,30,0.08)",
              border: "0.5px solid rgba(107,30,30,0.22)",
              color: STUDIO.ink,
            }}
            type="button"
          >
            {temporaryPassword}
            <Copy size={14} />
          </button>
        ) : (
          <p className="mt-2 text-sm" style={{ color: STUDIO.ink4 }}>
            Shown once after the account is created.
          </p>
        )}
      </aside>
    </div>
  );
}
