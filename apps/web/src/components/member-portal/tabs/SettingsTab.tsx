"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { Switch } from "@repo/ui/components/ui/switch";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { AlertCircle, Bell, Calendar, Gift, Mail, Newspaper, Shield, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface SettingsTabProps {
  bankAccount?: string;
}

export function SettingsTab({ bankAccount: initialBankAccount }: SettingsTabProps) {
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
    <TabsContent value="settings" className="space-y-8">
      <Card className="p-8 border-0 shadow-lg dark:bg-gray-900/50 dark:backdrop-blur-sm">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {t("notificationPreferences")}
        </h3>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <Label className="text-base">{t("emailNotifications")}</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("emailDescription")}</p>
              </div>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-400" />
              <div>
                <Label className="text-base">{t("pushNotifications")}</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("pushDescription")}</p>
              </div>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <Label className="text-base">{t("eventUpdates")}</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("eventDescription")}</p>
              </div>
            </div>
            <Switch
              checked={notifications.events}
              onCheckedChange={(checked) => setNotifications({ ...notifications, events: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Newspaper className="w-5 h-5 text-gray-400" />
              <div>
                <Label className="text-base">{t("newsUpdates")}</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("newsDescription")}</p>
              </div>
            </div>
            <Switch
              checked={notifications.news}
              onCheckedChange={(checked) => setNotifications({ ...notifications, news: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-gray-400" />
              <div>
                <Label className="text-base">{t("benefitsDiscounts")}</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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

      <Card className="p-8 border-0 shadow-lg dark:bg-gray-900/50 dark:backdrop-blur-sm">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {t("paymentInformation")}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t("paymentDescription")}</p>

        <div className="space-y-4">
          <div>
            <Label className="text-base">{t("bankAccount")}</Label>
            <Input
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder={t("bankAccountPlaceholder")}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t("bankAccountNote")}</p>
          </div>

          <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">{t("securePayment")}</p>
          </div>
        </div>
      </Card>

      <Card className="p-8 border-0 shadow-lg border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t("dangerZone")}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t("dangerDescription")}</p>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            {t("cancelMembership")}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <X className="w-4 h-4 mr-2" />
            {t("deleteAccount")}
          </Button>
        </div>
      </Card>
    </TabsContent>
  );
}
