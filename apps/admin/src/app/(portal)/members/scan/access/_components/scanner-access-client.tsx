"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  inviteScanner,
  resendScannerInvite,
  revokeScannerGrant,
  type ScannerGrantView,
} from "../../../../_actions/member-pass-scanners";

type Status = ScannerGrantView["status"];

const STATUS_VARIANT: Record<Status, "default" | "destructive" | "secondary"> =
  {
    active: "default",
    expired: "secondary",
    revoked: "destructive",
  };

/** ISO time for a datetime-local value; null (no end date) if empty or invalid. */
function toExpiryIso(value: string): string | null {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** Puts the saved grant first, replacing an older copy of it. */
function upsert(
  grants: ScannerGrantView[],
  grant: ScannerGrantView
): ScannerGrantView[] {
  return [grant, ...grants.filter((current) => current.id !== grant.id)];
}

export function ScannerAccessClient({
  allowAllCampuses,
  campuses,
  initialGrants,
  loadFailed,
}: {
  allowAllCampuses: boolean;
  campuses: { id: string; name: string }[];
  initialGrants: ScannerGrantView[];
  loadFailed: boolean;
}) {
  const t = useTranslations("adminPortal.memberPass.access");
  const format = useFormatter();
  const ids = {
    campus: useId(),
    email: useId(),
    expires: useId(),
    name: useId(),
  };
  const [grants, setGrants] = useState(initialGrants);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, startTransition] = useTransition();

  const campusName = (id: string | null) =>
    id === null
      ? t("allCampuses")
      : (campuses.find((campus) => campus.id === id)?.name ?? id);
  const formatDate = (iso: string | null) =>
    iso
      ? format.dateTime(new Date(iso), {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  const showError = (error: string) =>
    toast.error(t(`errors.${error}` as "errors.failed"));
  const reportInvite = (emailSent: boolean, sentMessage: string) => {
    if (emailSent) {
      toast.success(sentMessage);
    } else {
      toast.warning(t("emailNotSent"));
    }
  };

  const invite = () =>
    startTransition(async () => {
      const result = await inviteScanner({
        campusId: campusId || null,
        email,
        expiresAt: toExpiryIso(expiresAt),
        name,
      });
      if (!result.success) {
        showError(result.error);
        return;
      }
      setGrants((current) => upsert(current, result.data.grant));
      setEmail("");
      setName("");
      setExpiresAt("");
      reportInvite(result.data.emailSent, t("invited"));
    });

  const resend = (id: string) =>
    startTransition(async () => {
      const result = await resendScannerInvite(id);
      if (!result.success) {
        showError(result.error);
        return;
      }
      setGrants((current) => upsert(current, result.data.grant));
      reportInvite(result.data.emailSent, t("resent"));
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      const result = await revokeScannerGrant(id);
      if (!result.success) {
        showError(result.error);
        return;
      }
      const revoked = result.data;
      setGrants((current) =>
        current.map((grant) => (grant.id === revoked.id ? revoked : grant))
      );
      toast.success(t("revoked"));
    });

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">{t("addTitle")}</h2>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            invite();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={ids.email}>{t("email")}</Label>
            <Input
              autoComplete="off"
              id={ids.email}
              maxLength={320}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.name}>{t("name")}</Label>
            <Input
              autoComplete="off"
              id={ids.name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
              value={name}
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
            <p className="text-muted-foreground text-xs">{t("expiresHint")}</p>
          </div>
          <div className="md:col-span-2">
            <Button disabled={pending} type="submit">
              {t("invite")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="font-semibold">{t("listTitle")}</h2>
        {loadFailed ? (
          <p className="text-destructive text-sm">{t("errors.failed")}</p>
        ) : null}
        {grants.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("columns.name")}</th>
                  <th className="px-3 py-2 font-medium">
                    {t("columns.email")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("columns.campus")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("columns.grantedBy")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("columns.expiresAt")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("columns.status")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("columns.invitedAt")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => (
                  <tr className="border-b last:border-b-0" key={grant.id}>
                    <td className="px-3 py-2">{grant.name ?? "—"}</td>
                    <td className="px-3 py-2">{grant.email}</td>
                    <td className="px-3 py-2">{campusName(grant.campusId)}</td>
                    <td className="px-3 py-2">{grant.grantedBy}</td>
                    <td className="px-3 py-2">
                      {grant.expiresAt
                        ? formatDate(grant.expiresAt)
                        : t("noEndDate")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[grant.status]}>
                        {t(`status.${grant.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {grant.invitedAt
                        ? formatDate(grant.invitedAt)
                        : t("notInvited")}
                    </td>
                    <td className="px-3 py-2">
                      {grant.status === "active" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            disabled={pending}
                            onClick={() => resend(grant.id)}
                            size="sm"
                            variant="outline"
                          >
                            {t("resend")}
                          </Button>
                          <Button
                            disabled={pending}
                            onClick={() => revoke(grant.id)}
                            size="sm"
                            variant="destructive"
                          >
                            {t("revoke")}
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
