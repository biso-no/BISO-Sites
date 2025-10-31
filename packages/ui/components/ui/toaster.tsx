"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@repo/ui/components/ui/toast"

// Empty component that's safe to use but doesn't do anything
// This prevents errors when components try to use the old toaster system
export function Toaster() {
  return null;
}

// If you want to completely remove this component in the future,
// make sure to update all imports and usages in your application
