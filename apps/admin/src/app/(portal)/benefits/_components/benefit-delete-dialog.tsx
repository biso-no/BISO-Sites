import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { BoardConfirmDialog } from "./board-confirm-dialog";

export interface BenefitDeleteDialogProps {
  /** The button that opens it; focus returns there when it closes. */
  children: ReactElement;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  /** The benefit's title, as the board shows it. */
  title: string;
}

/** A plain "are you sure" before a benefit is deleted for good. */
export function BenefitDeleteDialog({
  children,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
}: BenefitDeleteDialogProps) {
  const t = useTranslations("adminPortal.benefits.panel");
  return (
    <BoardConfirmDialog
      body={t("deleteBody")}
      cancelLabel={t("cancel")}
      confirmLabel={t("delete")}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      pending={pending}
      title={t("deleteTitle", { title })}
      trigger={children}
    />
  );
}
