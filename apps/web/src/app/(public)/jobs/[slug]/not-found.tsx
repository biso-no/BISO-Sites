import { FileSearch } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  StatusPanel,
  statusPanelPrimaryAction,
} from "@/components/ui/status-panel";

export default async function JobNotFound() {
  const t = await getTranslations("jobs.errors");

  return (
    <StatusPanel
      actions={
        <Link className={statusPanelPrimaryAction} href="/jobs">
          {t("browse")}
        </Link>
      }
      body={t("notFoundBody")}
      icon={<FileSearch className="size-8" />}
      title={t("notFoundTitle")}
    />
  );
}
