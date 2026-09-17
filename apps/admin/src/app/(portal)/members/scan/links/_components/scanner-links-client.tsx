"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Copy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createScannerLink,
  revokeScannerLink,
  type ScannerLinkView,
} from "../../../../_actions/member-pass";

const DEFAULT_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ScannerLinksClient({
  allowAllCampuses,
  campuses,
  initialLinks,
}: {
  allowAllCampuses: boolean;
  campuses: { id: string; name: string }[];
  initialLinks: ScannerLinkView[];
}) {
  const t = useTranslations("adminPortal.memberPass.links");
  const format = useFormatter();
  const ids = { campus: useId(), expires: useId(), label: useId() };
  const [links, setLinks] = useState(initialLinks);
  const [label, setLabel] = useState("");
  const [campusId, setCampusId] = useState(
    allowAllCampuses ? "" : (campuses[0]?.id ?? "")
  );
  const [expiresAt, setExpiresAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + DEFAULT_HOURS * HOUR_MS))
  );
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createScannerLink({
        campusId: campusId || null,
        expiresAt: new Date(expiresAt).toISOString(),
        label,
      });
      if (!result.success) {
        toast.error(t(`errors.${result.error}` as "errors.failed"));
        return;
      }
      setLinks((current) => [...current, result.data.link]);
      setCreatedUrl(result.data.url);
      setLabel("");
      toast.success(t("created"));
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      const result = await revokeScannerLink(id);
      if (!result.success) {
        toast.error(t(`errors.${result.error}` as "errors.failed"));
        return;
      }
      setLinks((current) => current.filter((link) => link.id !== id));
      toast.success(t("revoked"));
    });

  const copy = async () => {
    if (createdUrl) {
      await navigator.clipboard.writeText(createdUrl);
      toast.success(t("copied"));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor={ids.label}>{t("label")}</Label>
          <Input
            id={ids.label}
            maxLength={120}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("labelPlaceholder")}
            value={label}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.campus}>{t("campus")}</Label>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            id={ids.campus}
            onChange={(event) => setCampusId(event.target.value)}
            value={campusId}
          >
            {allowAllCampuses ? (
              <option value="">{t("allCampuses")}</option>
            ) : null}
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.expires}>{t("expiresAt")}</Label>
          <Input
            id={ids.expires}
            onChange={(event) => setExpiresAt(event.target.value)}
            type="datetime-local"
            value={expiresAt}
          />
        </div>
        <Button disabled={pending} onClick={create}>
          {t("create")}
        </Button>

        {createdUrl ? (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
            <p>{t("created")}</p>
            <p className="break-all font-mono">{createdUrl}</p>
            <Button onClick={copy} size="sm" variant="outline">
              <Copy className="mr-2 h-4 w-4" />
              {t("copy")}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="font-semibold">{t("active")}</h2>
        {links.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("none")}</p>
        ) : null}
        {links.map((link) => (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
            key={link.id}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{link.label}</p>
              <p className="text-muted-foreground text-xs">
                {t("expires", {
                  date: format.dateTime(new Date(link.expiresAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </p>
            </div>
            <Button
              disabled={pending}
              onClick={() => revoke(link.id)}
              size="sm"
              variant="destructive"
            >
              {t("revoke")}
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
