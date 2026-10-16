import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

export function CartEmptyState() {
  const t = useTranslations("shop");

  return (
    <div className="max-w-(--measure) rounded-biso-md border border-edge p-8 sm:p-10">
      <h2 className="type-display-sm text-ink">{t("cart.empty.title")}</h2>
      <p className="type-body mt-3 text-ink-muted">
        {t("cart.empty.description")}
      </p>
      <Link className={cn(statusPanelPrimaryAction, "mt-6")} href="/shop">
        {t("cart.empty.continue")}
      </Link>
    </div>
  );
}
