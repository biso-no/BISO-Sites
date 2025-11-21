"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { useTranslations } from "next-intl";
import type { JobApplication } from "@/lib/types/job-application";

interface ApplicationStatusBadgeProps {
  status: JobApplication["status"];
}

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  const t = useTranslations("adminJobs");
  const statusConfig = {
    submitted: { variant: "secondary" as const },
    reviewed: { variant: "outline" as const },
    interview: { variant: "default" as const },
    accepted: { variant: "default" as const },
    rejected: { variant: "destructive" as const },
  };

  const config = statusConfig[status] || statusConfig.submitted;
  const label = t(`applications.status.${status}`) || status;

  return (
    <Badge
      variant={config.variant}
      className={status === "accepted" ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
    >
      {label}
    </Badge>
  );
}
