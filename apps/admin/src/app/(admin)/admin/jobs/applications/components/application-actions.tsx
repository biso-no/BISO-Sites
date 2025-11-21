"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Download, Mail, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  deleteJobApplicationData,
  exportJobApplicationData,
  updateJobApplicationStatus,
} from "@/app/actions/jobs";
import { toast } from "@/lib/hooks/use-toast";
import type { JobApplication } from "@/lib/types/job-application";

interface ApplicationActionsProps {
  application: JobApplication;
}

export function ApplicationActions({ application }: ApplicationActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("adminJobs");
  const mailSubject = encodeURIComponent(t("applications.actions.mailSubject"));

  const handleStatusUpdate = async (newStatus: JobApplication["status"]) => {
    setIsLoading(true);
    try {
      await updateJobApplicationStatus(application.$id, newStatus);
      toast({ title: t("applications.messages.statusUpdated") });
      router.refresh();
    } catch (error) {
      toast({ title: t("applications.messages.statusUpdateError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportJobApplicationData(application.$id);
      if (data) {
        // Create downloadable JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `application-${application.$id}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({ title: t("applications.messages.exportSuccess") });
      }
    } catch (error) {
      toast({ title: t("applications.messages.exportError"), variant: "destructive" });
    }
  };

  const handleDeleteData = async () => {
    if (!confirm(t("applications.actions.confirmDelete"))) {
      return;
    }

    setIsLoading(true);
    try {
      const success = await deleteJobApplicationData(application.$id);
      if (success) {
        toast({ title: t("applications.messages.deleteSuccess") });
        router.refresh();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      toast({ title: t("applications.messages.deleteError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Quick status update buttons */}
      {application.status === "submitted" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleStatusUpdate("reviewed")}
          disabled={isLoading}
        >
          {t("applications.actions.markReviewed")}
        </Button>
      )}

      {application.status === "reviewed" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleStatusUpdate("interview")}
          disabled={isLoading}
        >
          {t("applications.actions.scheduleInterview")}
        </Button>
      )}

      {/* Contact applicant */}
      <Button size="sm" variant="outline" asChild>
        <a href={`mailto:${application.applicant_email}?subject=${mailSubject}`}>
          <Mail className="h-4 w-4" />
        </a>
      </Button>

      {/* More actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleStatusUpdate("accepted")}>
            {t("applications.actions.markAccepted")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusUpdate("rejected")}>
            {t("applications.actions.markRejected")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            {t("applications.actions.exportData")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDeleteData}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("applications.actions.deleteData")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
