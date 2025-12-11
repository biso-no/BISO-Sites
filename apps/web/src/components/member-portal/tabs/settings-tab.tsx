"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { Switch } from "@repo/ui/components/ui/switch";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import {
  AlertCircle,
  Bell,
  Calendar,
  Gift,
  Mail,
  Newspaper,
  Shield,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type SettingsTabProps = {
  bankAccount?: string;
};

export function SettingsTab({
  bankAccount: initialBankAccount,
}: SettingsTabProps) {
  const t = useTranslations("memberPortal.settings");

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    events: true,
    news: false,
    benefits: true,
  });

  const [bankAccount, setBankAccount] = useState(initialBankAccount || "");

  return (
    <TabsContent className="space-y-8" value="settings">
      <Card className="border-0 p-8 shadow-lg dark:bg-inverted/50 dark:backdrop-blur-sm">
        <h3 className="mb-6 font-bold text-foreground text-xl dark:text-foreground">
          {t("notificationPreferences")}
        </h3>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base">{t("emailNotifications")}</Label>
                <p className="text-muted-foreground text-sm dark:text-muted-foreground">
                  {t("emailDescription")}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, email: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base">{t("pushNotifications")}</Label>
                <p className="text-muted-foreground text-sm dark:text-muted-foreground">
                  {t("pushDescription")}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, push: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base">{t("eventUpdates")}</Label>
                <p className="text-muted-foreground text-sm dark:text-muted-foreground">
                  {t("eventDescription")}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.events}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, events: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Newspaper className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base">{t("newsUpdates")}</Label>
                <p className="text-muted-foreground text-sm dark:text-muted-foreground">
                  {t("newsDescription")}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.news}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, news: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base">{t("benefitsDiscounts")}</Label>
                <p className="text-muted-foreground text-sm dark:text-muted-foreground">
                  {t("benefitsDescription")}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.benefits}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, benefits: checked })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="border-0 p-8 shadow-lg dark:bg-inverted/50 dark:backdrop-blur-sm">
        <h3 className="mb-6 font-bold text-foreground text-xl dark:text-foreground">
          {t("paymentInformation")}
        </h3>
        <p className="mb-6 text-muted-foreground dark:text-muted-foreground">
          {t("paymentDescription")}
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-base">{t("bankAccount")}</Label>
            <Input
              className="mt-2"
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder={t("bankAccountPlaceholder")}
              value={bankAccount}
            />
            <p className="mt-2 text-muted-foreground text-xs dark:text-muted-foreground">
              {t("bankAccountNote")}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <Shield className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-green-700 text-sm dark:text-green-300">
              {t("securePayment")}
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-0 border-red-200 bg-red-50/30 p-8 shadow-lg dark:border-red-800 dark:bg-red-900/20">
        <h3 className="mb-4 font-bold text-foreground text-xl dark:text-foreground">
          {t("dangerZone")}
        </h3>
        <p className="mb-6 text-muted-foreground dark:text-muted-foreground">
          {t("dangerDescription")}
        </p>

        <div className="space-y-3">
          <Button
            className="w-full justify-start border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20"
            variant="outline"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            {t("cancelMembership")}
          </Button>
          <Button
            className="w-full justify-start border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            variant="outline"
          >
            <X className="mr-2 h-4 w-4" />
            {t("deleteAccount")}
          </Button>
        </div>
      </Card>
    </TabsContent>
  );
}
