import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { STUDIO } from "../../../_components/studio";
import { BoardConfirmDialog } from "../../_components/board-confirm-dialog";

export interface PartnerDeleteDialogProps {
  /** The button that opens it; focus returns there when it closes. */
  children: ReactElement;
  /** Every offer linked to the partner: they are deleted with it. */
  deals: { id: string; title: string }[];
  name: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}

/** The last "are you sure": names every offer that goes with the partner. */
export function PartnerDeleteDialog({
  children,
  deals,
  name,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: PartnerDeleteDialogProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const hasDeals = deals.length > 0;
  return (
    <BoardConfirmDialog
      body={hasDeals ? t("deleteBody") : t("deleteBodyNoDeals")}
      cancelLabel={t("cancel")}
      confirmLabel={t("deleteAction")}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      pending={pending}
      title={t("deleteTitle", { name })}
      trigger={children}
    >
      {hasDeals ? (
        <ul
          className="max-h-56 overflow-y-auto rounded-xl border bg-white px-4 py-1 text-sm"
          style={{ borderColor: STUDIO.rule, color: STUDIO.ink }}
        >
          {deals.map((deal) => (
            <li
              className="border-t border-dashed py-2 first:border-t-0"
              key={deal.id}
              style={{ borderColor: STUDIO.rule }}
            >
              {deal.title}
            </li>
          ))}
        </ul>
      ) : null}
    </BoardConfirmDialog>
  );
}
