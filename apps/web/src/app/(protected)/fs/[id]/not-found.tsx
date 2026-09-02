import { FileX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  StatusPanel,
  statusPanelPrimaryAction,
} from "@/components/ui/status-panel";

export default async function NotFound() {
  const t = await getTranslations("expenses");
  return (
    <StatusPanel
      actions={
        <Link className={statusPanelPrimaryAction} href="/fs">
          {t("back")}
        </Link>
      }
      body={t("notFoundBody")}
      icon={<FileX className="size-8" />}
      title={t("notFoundTitle")}
    />
  );
}
