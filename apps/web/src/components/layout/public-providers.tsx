"use client";

import type React from "react";
import { CartProvider } from "@/lib/contexts/cart-context";
import { CampusProvider } from "../context/campus";

export const PublicProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <CampusProvider>
    <CartProvider>{children}</CartProvider>
  </CampusProvider>
);
