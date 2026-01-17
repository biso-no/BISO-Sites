"use client";

import type React from "react";
import type { MembershipStatus } from "@/lib/actions/membership";
import { CartProvider } from "@/lib/contexts/cart-context";
import { CampusProvider } from "../context/campus";
import { MembershipProvider } from "../context/membership-provider";

type PublicProvidersProps = {
  children: React.ReactNode;
  /**
   * Initial membership status from server-side.
   * If provided, the MembershipProvider will use this value
   * instead of fetching on client mount.
   */
  initialMembershipStatus?: MembershipStatus;
};

export const PublicProviders = ({
  children,
  initialMembershipStatus,
}: PublicProvidersProps) => (
  <CampusProvider>
    <CartProvider>
      <MembershipProvider initialStatus={initialMembershipStatus}>
        {children}
      </MembershipProvider>
    </CartProvider>
  </CampusProvider>
);
