"use client";

import type { PublicProfiles, Users } from "@repo/api/types/appwrite";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { updatePublicProfile, uploadAvatar } from "@/app/actions/member-portal";
import { Pill } from "@/components/ui/pill";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

interface ProfileTabProps {
  accountUser: { name: string; email: string } | null;
  biEmail: string;
  publicProfile: PublicProfiles | null;
  user: Users | null;
}

const inputClass =
  "type-body w-full rounded-biso-md border border-edge bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted disabled:bg-surface-sunken disabled:text-ink-muted focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2";

const labelClass = "type-body-sm mb-1.5 block font-semibold text-ink";

function Field({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * The member's public-facing details: photo, name, visibility.
 *
 * The "Connected Accounts" block with LinkedIn, Twitter and Facebook "Connect"
 * buttons is gone — none of the three was wired to anything, so each was a
 * button that did nothing. The BI email shows only when there is a student
 * number to build it from; it said "Verified" over "@bi.no" otherwise.
 */
export function ProfileTab({
  user,
  accountUser,
  publicProfile,
  biEmail,
}: ProfileTabProps) {
  const t = useTranslations("memberPortal.profile");
  const ids = useId();
  const [isPending, startTransition] = useTransition();
  const effectiveName = user?.name || accountUser?.name || "";
  const initialForm = {
    name: effectiveName,
    isPublic: publicProfile?.email_visible || publicProfile?.phone_visible,
    emailVisible: publicProfile?.email_visible,
    phoneVisible: publicProfile?.phone_visible,
  };
  const [formData, setFormData] = useState(initialForm);

  if (!(user || accountUser)) {
    return (
      <TabsContent value="profile">
        <section className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-8">
          <h2 className="type-display-sm text-ink">{t("guestTitle")}</h2>
          <p className="type-body text-ink-muted">{t("guestDescription")}</p>
          <Link
            className={statusPanelPrimaryAction}
            href="/auth/login?redirectTo=/member"
          >
            {t("login")}
          </Link>
        </section>
      </TabsContent>
    );
  }

  const initials = (effectiveName || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const hasStudentId = Boolean(user?.student_id);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const avatarData = new FormData();
    avatarData.append("avatar", file);

    startTransition(async () => {
      const result = await uploadAvatar(avatarData);
      if (result.success) {
        // Update user profile with new avatar URL
        await updatePublicProfile({ avatar: result.url });
        window.location.reload(); // Refresh to show new avatar
      }
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      await updatePublicProfile({
        name: formData.name,
        email_visible: formData.emailVisible,
        phone_visible: formData.phoneVisible,
      });
    });
  };

  return (
    <TabsContent value="profile">
      <section className="rounded-biso-md border border-edge p-6 sm:p-8">
        <h2 className="type-display-sm text-ink">{t("title")}</h2>

        <div className="mt-6 mb-8 flex flex-wrap items-center gap-6">
          <Avatar className="size-24 border border-edge">
            {user?.avatar ? (
              <AvatarImage alt={effectiveName} src={user.avatar} />
            ) : null}
            <AvatarFallback className="type-heading-section bg-surface-sunken text-ink">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <label
              className={`${statusPanelSecondaryAction} cursor-pointer focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-2`}
              htmlFor={`${ids}-avatar`}
            >
              {t("changePhoto")}
              <input
                accept="image/*"
                className="sr-only"
                disabled={isPending}
                id={`${ids}-avatar`}
                onChange={handleAvatarChange}
                type="file"
              />
            </label>
            <p className="type-body-sm mt-2 text-ink-muted">
              {t("photoRequirements")}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Field id={`${ids}-name`} label={t("fullName")}>
            <input
              className={inputClass}
              id={`${ids}-name`}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              value={formData.name}
            />
          </Field>
          <Field id={`${ids}-campus`} label={t("campus")}>
            <input
              className={inputClass}
              disabled
              id={`${ids}-campus`}
              value={user?.campus?.name || ""}
            />
          </Field>
          <Field id={`${ids}-email`} label={t("email")}>
            <input
              className={inputClass}
              disabled
              id={`${ids}-email`}
              value={user?.email || accountUser?.email || ""}
            />
          </Field>
          {hasStudentId ? (
            <Field id={`${ids}-bi-email`} label={t("biEmail")}>
              <div className="flex items-center gap-2">
                <input
                  className={inputClass}
                  disabled
                  id={`${ids}-bi-email`}
                  value={biEmail}
                />
                <Pill className="shrink-0" tone="success">
                  <Check aria-hidden="true" className="size-3.5 shrink-0" />
                  {t("verified")}
                </Pill>
              </div>
            </Field>
          ) : null}
          {hasStudentId ? (
            <Field id={`${ids}-student-id`} label={t("studentId")}>
              <input
                className={inputClass}
                disabled
                id={`${ids}-student-id`}
                value={user?.student_id || ""}
              />
            </Field>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-biso-md bg-surface-sunken p-4">
          <div className="flex items-start gap-3">
            {formData.isPublic ? (
              <Eye
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-ink-accent"
              />
            ) : (
              <EyeOff
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-ink-muted"
              />
            )}
            <div>
              <label
                className="type-body-sm font-semibold text-ink"
                htmlFor={`${ids}-public`}
              >
                {t("publicProfile")}
              </label>
              <p className="type-body-sm text-ink-muted">
                {t("publicProfileDescription")}
              </p>
            </div>
          </div>
          {/* A native switch: the shared one paints its "on" state in the sky
              blue, under the 3:1 a control's state needs against white. */}
          <input
            aria-checked={Boolean(formData.isPublic)}
            checked={Boolean(formData.isPublic)}
            className="size-5 shrink-0 cursor-pointer accent-action focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2"
            id={`${ids}-public`}
            onChange={(e) => {
              const checked = e.target.checked;
              setFormData({
                ...formData,
                isPublic: checked,
                emailVisible: checked ? formData.emailVisible : false,
                phoneVisible: checked ? formData.phoneVisible : false,
              });
            }}
            role="switch"
            type="checkbox"
          />
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            className={statusPanelSecondaryAction}
            disabled={isPending}
            onClick={() => setFormData(initialForm)}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            aria-busy={isPending}
            className={`${statusPanelPrimaryAction} disabled:opacity-60`}
            disabled={isPending}
            onClick={handleSave}
            type="button"
          >
            {isPending ? t("saving") : t("saveChanges")}
          </button>
        </div>
      </section>
    </TabsContent>
  );
}
