"use client";

import type { PublicProfiles, Users } from "@repo/api/types/appwrite";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { Switch } from "@repo/ui/components/ui/switch";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { Check, Eye, EyeOff, Facebook, Linkedin, Twitter } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { updatePublicProfile, uploadAvatar } from "@/app/actions/memberPortal";

type ProfileTabProps = {
  user: Users;
  publicProfile: PublicProfiles | null;
  biEmail: string;
};

export function ProfileTab({ user, publicProfile, biEmail }: ProfileTabProps) {
  const t = useTranslations("memberPortal.profile");
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    name: user.name || "",
    bio: publicProfile?.bio || user.bio || "",
    isPublic: publicProfile?.email_visible || publicProfile?.phone_visible,
    emailVisible: publicProfile?.email_visible,
    phoneVisible: publicProfile?.phone_visible,
  });

  const initials = (user.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (result.success) {
        // Update user profile with new avatar URL
        await updatePublicProfile({ avatar: result.url });
        window.location.reload(); // Refresh to show new avatar
      }
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      await updatePublicProfile({
        name: formData.name,
        bio: formData.bio,
        email_visible: formData.emailVisible,
        phone_visible: formData.phoneVisible,
      });
    });
  };

  return (
    <TabsContent className="space-y-8" value="profile">
      <Card className="border-0 p-8 shadow-lg dark:bg-gray-900/50 dark:backdrop-blur-sm">
        <h3 className="mb-6 font-bold text-gray-900 text-xl dark:text-gray-100">
          {t("title")}
        </h3>

        <div className="mb-8 flex items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-[#3DA9E0]/20">
            {user.avatar && (
              <AvatarImage alt={user.name || ""} src={user.avatar} />
            )}
            <AvatarFallback className="bg-linear-to-br from-[#3DA9E0] to-[#001731] text-2xl text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button asChild className="mb-2" size="sm" variant="outline">
              <label className="cursor-pointer" htmlFor="avatar-upload">
                {t("changePhoto")}
                <input
                  accept="image/*"
                  className="hidden"
                  disabled={isPending}
                  id="avatar-upload"
                  onChange={handleAvatarChange}
                  type="file"
                />
              </label>
            </Button>
            <p className="text-gray-500 text-sm dark:text-gray-400">
              {t("photoRequirements")}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div>
            <Label>{t("fullName")}</Label>
            <Input
              className="mt-2"
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              value={formData.name}
            />
          </div>
          <div>
            <Label>{t("campus")}</Label>
            <Input className="mt-2" disabled value={user.campus?.name || ""} />
          </div>
          <div>
            <Label>{t("email")}</Label>
            <Input className="mt-2" disabled value={user.email || ""} />
          </div>
          <div>
            <Label>{t("biEmail")}</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input disabled value={biEmail} />
              <Badge className="whitespace-nowrap border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
                <Check className="mr-1 h-3 w-3" />
                {t("verified")}
              </Badge>
            </div>
          </div>
          <div>
            <Label>{t("studentId")}</Label>
            <Input className="mt-2" disabled value={user.student_id || ""} />
          </div>
        </div>

        <div className="mb-6">
          <Label>{t("bio")}</Label>
          <Input
            className="mt-2"
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder={t("bioPlaceholder")}
            value={formData.bio}
          />
        </div>

        <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            {formData.isPublic ? (
              <Eye className="h-5 w-5 text-[#3DA9E0]" />
            ) : (
              <EyeOff className="h-5 w-5 text-gray-400" />
            )}
            <div>
              <Label>{t("publicProfile")}</Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                {t("publicProfileDescription")}
              </p>
            </div>
          </div>
          <Switch
            checked={formData.isPublic}
            onCheckedChange={(checked) =>
              setFormData({
                ...formData,
                isPublic: checked,
                emailVisible: checked ? formData.emailVisible : false,
                phoneVisible: checked ? formData.phoneVisible : false,
              })
            }
          />
        </div>

        <Separator className="my-6" />

        <h3 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">
          {t("connectedAccounts")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Linkedin className="h-5 w-5 text-[#0077B5]" />
              <div>
                <div className="font-medium text-sm">LinkedIn</div>
                <div className="text-gray-500 text-xs dark:text-gray-400">
                  {t("notConnected")}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline">
              {t("connect")}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Twitter className="h-5 w-5 text-[#1DA1F2]" />
              <div>
                <div className="font-medium text-sm">Twitter</div>
                <div className="text-gray-500 text-xs dark:text-gray-400">
                  {t("notConnected")}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline">
              {t("connect")}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Facebook className="h-5 w-5 text-[#4267B2]" />
              <div>
                <div className="font-medium text-sm">Facebook</div>
                <div className="text-gray-500 text-xs dark:text-gray-400">
                  {t("notConnected")}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline">
              {t("connect")}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline">{t("cancel")}</Button>
          <Button
            className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
            disabled={isPending}
            onClick={handleSave}
          >
            {isPending ? "Saving..." : t("saveChanges")}
          </Button>
        </div>
      </Card>
    </TabsContent>
  );
}
