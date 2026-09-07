"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Link2, Shield, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { PrivacyControls } from "@/components/privacy-controls";
import { IdentityManagement } from "@/components/profile/identity-management";
import { ProfileForm } from "@/components/profile/profile-form";

/** `outline-solid`, not a ring: the shared trigger sets `outline-none`, and a
 * ring is swallowed by the panel's own box-shadow slot. Same fix as the member
 * portal's tab bar. */
const triggerClass =
  // `min-w-0` + `whitespace-normal` override the shared trigger's `nowrap`:
  // "Linked Accounts" is 159px on one line, and three of those overflowed a
  // 320px viewport by 21px. It wraps to two lines there and stays on one from
  // `sm` up. `h-auto py-2` so the wrapped row is not clipped by a fixed `h-10`.
  "flex h-auto min-w-0 flex-1 items-center justify-center gap-2 whitespace-normal rounded-biso-sm py-2 text-center text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 sm:h-10 sm:whitespace-nowrap";

interface ProfileTabsUserData {
  profile: Parameters<typeof ProfileForm>[0]["initialData"];
  user: {
    $id: string;
    email: string;
  };
}

interface Identity {
  $id: string;
  provider: string;
  providerUid?: string;
}

export function ProfileTabs({
  userData,
  identities,
}: {
  userData: ProfileTabsUserData;
  identities?: Identity[];
}) {
  const t = useTranslations("common.profile");
  // Uncontrolled. The `value`/`onValueChange` pair here mirrored `defaultValue`
  // into state that nothing else read, so it re-rendered the tree on every tab
  // change to arrive at the value Radix already held.
  return (
    <Tabs className="space-y-6" defaultValue="account">
      {/* `bg-surface-strong` and `shadow-card-soft` were both unregistered —
          Tailwind emitted nothing for either, so this bar had no background and
          no shadow. Same family as the two dead utilities RD-019 and RD-021
          found; `styles.test.ts` now scans this directory too. */}
      <TabsList className="w-full rounded-biso-md border border-edge bg-surface-sunken p-1">
        <TabsTrigger className={triggerClass} value="account">
          <User aria-hidden="true" className="size-4 shrink-0" />
          <span>{t("tabs.account")}</span>
        </TabsTrigger>
        <TabsTrigger className={triggerClass} value="privacy">
          <Shield aria-hidden="true" className="size-4 shrink-0" />
          <span>{t("tabs.privacy")}</span>
        </TabsTrigger>
        <TabsTrigger className={triggerClass} value="identities">
          <Link2 aria-hidden="true" className="size-4 shrink-0" />
          <span>{t("tabs.identities")}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent className="space-y-6" value="account">
        <section className="rounded-biso-md border border-edge p-6">
          <h2 className="type-heading-card text-ink">{t("accountInfo")}</h2>
          <p className="type-body-sm mt-1 mb-6 text-ink-muted">
            {t("accountInfoBody")}
          </p>
          <ProfileForm
            email={userData.user.email}
            initialData={userData.profile}
          />
        </section>
      </TabsContent>

      <TabsContent className="space-y-6" value="privacy">
        <PrivacyControls />
      </TabsContent>

      <TabsContent className="space-y-6" value="identities">
        <IdentityManagement initialIdentities={identities} />
      </TabsContent>
    </Tabs>
  );
}
