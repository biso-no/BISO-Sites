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

interface ProfileTabProps {
  user: Users;
  publicProfile: PublicProfiles | null;
  biEmail: string;
}

export function ProfileTab({ user, publicProfile, biEmail }: ProfileTabProps) {
  const t = useTranslations("memberPortal.profile");
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    name: user.name || "",
    bio: publicProfile?.bio || user.bio || "",
    isPublic:
      publicProfile?.email_visible || publicProfile?.phone_visible || false,
    emailVisible: publicProfile?.email_visible || false,
    phoneVisible: publicProfile?.phone_visible || false,
  });

  const initials = (user.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    <TabsContent value="profile" className="space-y-8">
      <Card className="p-8 border-0 shadow-lg dark:bg-gray-900/50 dark:backdrop-blur-sm">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {t("title")}
        </h3>

        <div className="flex items-center gap-6 mb-8">
          <Avatar className="w-24 h-24 border-4 border-[#3DA9E0]/20">
            {user.avatar && (
              <AvatarImage src={user.avatar} alt={user.name || ""} />
            )}
            <AvatarFallback className="bg-linear-to-br from-[#3DA9E0] to-[#001731] text-white text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button size="sm" variant="outline" className="mb-2" asChild>
              <label htmlFor="avatar-upload" className="cursor-pointer">
                {t("changePhoto")}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isPending}
                />
              </label>
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("photoRequirements")}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label>{t("fullName")}</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="mt-2"
            />
          </div>
          <div>
            <Label>{t("campus")}</Label>
            <Input value={user.campus?.name || ""} className="mt-2" disabled />
          </div>
          <div>
            <Label>{t("email")}</Label>
            <Input value={user.email || ""} className="mt-2" disabled />
          </div>
          <div>
            <Label>{t("biEmail")}</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input value={biEmail} disabled />
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 whitespace-nowrap">
                <Check className="w-3 h-3 mr-1" />
                {t("verified")}
              </Badge>
            </div>
          </div>
          <div>
            <Label>{t("studentId")}</Label>
            <Input value={user.student_id || ""} className="mt-2" disabled />
          </div>
        </div>

        <div className="mb-6">
          <Label>{t("bio")}</Label>
          <Input
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder={t("bioPlaceholder")}
            className="mt-2"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
          <div className="flex items-center gap-3">
            {formData.isPublic ? (
              <Eye className="w-5 h-5 text-[#3DA9E0]" />
            ) : (
              <EyeOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <Label>{t("publicProfile")}</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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

        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t("connectedAccounts")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Linkedin className="w-5 h-5 text-[#0077B5]" />
              <div>
                <div className="text-sm font-medium">LinkedIn</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("notConnected")}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline">
              {t("connect")}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Twitter className="w-5 h-5 text-[#1DA1F2]" />
              <div>
                <div className="text-sm font-medium">Twitter</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("notConnected")}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline">
              {t("connect")}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Facebook className="w-5 h-5 text-[#4267B2]" />
              <div>
                <div className="text-sm font-medium">Facebook</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("notConnected")}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline">
              {t("connect")}
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline">{t("cancel")}</Button>
          <Button
            className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving..." : t("saveChanges")}
          </Button>
        </div>
      </Card>
    </TabsContent>
  );
}
