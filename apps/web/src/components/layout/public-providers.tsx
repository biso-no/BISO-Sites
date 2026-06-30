"use client";

import type React from "react";
import type { MembershipStatus } from "@/lib/actions/membership";
import { CartProvider } from "@/lib/contexts/cart-context";
import { CampusProvider } from "../context/campus";
import { MembershipProvider } from "../context/membership-provider";
import { CartDrawer } from "../shop/cart/cart-drawer";
import { AnalyticsIdentity, type MemberIdentity } from "./analytics-identity";

interface PublicProvidersProps {
  children: React.ReactNode;
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
  initialMembershipStatus,
  memberIdentity = null,
}: PublicProvidersProps) => (
  <CampusProvider>
    <CartProvider>
      <MembershipProvider initialStatus={initialMembershipStatus}>
        <AnalyticsIdentity identity={memberIdentity} />
        {children}
        <CartDrawer />
      </MembershipProvider>
    </CartProvider>
  </CampusProvider>
);
