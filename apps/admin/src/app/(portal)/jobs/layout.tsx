import type { ReactNode } from "react";
import { AdminTourProvider } from "@/components/tours/admin-tour-provider";

/**
 * Recruitment-scoped layout. Wraps every `/jobs/*` route in the tour provider so
 * a multi-page tour's state survives navigation between the overview, editor,
 * and review workspace. Auth is already enforced by the parent (portal) layout.
 */
export default function JobsLayout({ children }: { children: ReactNode }) {
  return <AdminTourProvider>{children}</AdminTourProvider>;
}
