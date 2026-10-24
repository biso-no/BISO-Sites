"use client";

import type { Campus } from "@repo/api/types/appwrite";
import type React from "react";
import type { MembershipStatus } from "@/lib/actions/membership";
import { CartProvider } from "@/lib/contexts/cart-context";
import { CampusProvider } from "../context/campus";
import { MembershipProvider } from "../context/membership-provider";
import { CartDrawer } from "../shop/cart/cart-drawer";
import { AnalyticsIdentity, type MemberIdentity } from "./analytics-identity";

interface PublicProvidersProps {
  /** Campus list, resolved server-side so the switcher never fetches on mount. */
  campuses: Campus[];
  children: React.ReactNode;
  /** Active campus from `getActiveCampus()` (cookie -> prefs). Null = all. */
  initialCampusId: string | null;
  /**
   * Initial membership status from server-side.
   * If provided, the MembershipProvider will use this value
   * instead of fetching on client mount.
   */
  initialMembershipStatus?: MembershipStatus;
  /** Non-PII identity for logged-in members; null for anonymous visitors. */
  memberIdentity?: MemberIdentity | null;
}

export const PublicProviders = ({
  children,
  campuses,
  initialCampusId,
  initialMembershipStatus,
  memberIdentity = null,
}: PublicProvidersProps) => (
  <CampusProvider campuses={campuses} initialCampusId={initialCampusId}>
    <CartProvider>
      <MembershipProvider initialStatus={initialMembershipStatus}>
        <AnalyticsIdentity identity={memberIdentity} />
        {children}
        <CartDrawer />
      </MembershipProvider>
    </CartProvider>
  </CampusProvider>
);
