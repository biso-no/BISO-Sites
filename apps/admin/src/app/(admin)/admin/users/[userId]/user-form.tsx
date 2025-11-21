"use client";

import type { Campus, Users } from "@repo/api/types/appwrite";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
  AlertTriangle,
  ArrowLeft,
  Mail,
  RefreshCw,
  Save,
  Shield,
  UserCog,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { updateProfile } from "@/lib/actions/user";
import { toast } from "@/lib/hooks/use-toast";

export type UserFormProps = {
  user: Users;
  campuses: Campus[];
};

export function UserForm({ user: initialUser, campuses }: UserFormProps) {
  const [user, setUser] = useState<Users>(initialUser);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const t = useTranslations("adminUsers");

  const handleRoleChange = (role: string) => {
    if (!user) {
      return;
    }

    const currentRoles = user.roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];

    setUser({ ...user, roles: newRoles });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile(user);
      toast({
        title: t("messages.saveTitleSuccess"),
        description: t("messages.saveDescriptionSuccess"),
        variant: "default",
      });
      router.refresh(); // Refresh server components
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: t("messages.saveTitleError"),
        description: t("messages.saveDescriptionError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoBack = () => {
    router.push("/admin/users");
  };

  // Generate user's initials for avatar
  const initials = (user.name || "")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Generate color for avatar based on user name
  const nameHash = (user.name || "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ];
  const bgColor = colors[nameHash % colors.length];

  return (
    <Card className="mx-auto max-w-4xl shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              className="h-8 w-8 rounded-full"
              onClick={handleGoBack}
              size="icon"
              variant="ghost"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-2xl">
                {t("editor.userDetailsTitle")}
              </CardTitle>
              <CardDescription>
                {t("editor.userDetailsDescription")}
              </CardDescription>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="gap-2"
                  disabled={isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("editor.saveChanges")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("editor.saveChangesTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-8 pb-6">
        <div className="flex flex-col items-start gap-6 md:flex-row">
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-background/50 p-4">
            <Avatar className="h-24 w-24">
              <AvatarImage alt={user.name || ""} src="" />
              <AvatarFallback
                className={`font-semibold text-white text-xl ${bgColor}`}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="font-medium text-lg">{user.name}</h3>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
            <Badge
              className={
                user.isActive
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-100"
              }
              variant={user.isActive ? "default" : "secondary"}
            >
              {user.isActive ? t("status.active") : t("status.inactive")}
            </Badge>
          </div>

          <div className="flex-1">
            <Tabs className="w-full" defaultValue="profile">
              <TabsList className="mb-4 grid grid-cols-3">
                <TabsTrigger className="gap-2" value="profile">
                  <UserCog className="h-4 w-4" />
                  <span>{t("editor.profileTab")}</span>
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="roles">
                  <Shield className="h-4 w-4" />
                  <span>{t("editor.rolesTab")}</span>
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="security">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{t("editor.securityTab")}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent className="space-y-4" value="profile">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">{t("editor.fullName")}</Label>
                    <Input
                      className="mt-1"
                      id="name"
                      onChange={(e) =>
                        setUser({ ...user, name: e.target.value })
                      }
                      value={user.name || ""}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">{t("form.email")}</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        disabled
                        id="email"
                        value={user.email || ""}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="campus">{t("editor.campus")}</Label>
                    <Select
                      onValueChange={(value) =>
                        setUser({ ...user, campus_id: value })
                      }
                      value={user.campus_id || undefined}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t("editor.selectCampus")} />
                      </SelectTrigger>
                      <SelectContent>
                        {campuses.map((campus) => (
                          <SelectItem key={campus.$id} value={campus.$id}>
                            {campus.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="account-status">
                      {t("editor.accountStatus")}
                    </Label>
                    <div className="mt-3 flex items-center space-x-2">
                      <Switch
                        checked={user.isActive}
                        id="account-status"
                        onCheckedChange={(checked) =>
                          setUser({ ...user, isActive: checked })
                        }
                      />
                      <Label
                        className="font-normal text-sm"
                        htmlFor="account-status"
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent className="space-y-4" value="roles">
                <div className="rounded-lg bg-muted/40 p-4">
                  <h3 className="mb-1 font-medium">
                    {t("editor.userRolesTitle")}
                  </h3>
                  <p className="mb-4 text-muted-foreground text-sm">
                    {t("editor.userRolesDescription")}
                  </p>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {["User", "HR", "PR", "KK", "Finance", "Admin"].map(
                      (role) => {
                        const currentRoles = user.roles || [];
                        return (
                          <div
                            className={`flex items-center gap-2 rounded-md p-2 transition-colors ${
                              currentRoles.includes(role)
                                ? "border border-primary/30 bg-primary/10"
                                : "border border-transparent bg-muted"
                            }
                          `}
                            key={role}
                            onClick={() => handleRoleChange(role)}
                          >
                            <Checkbox
                              checked={currentRoles.includes(role)}
                              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                              id={`role-${role}`}
                              onCheckedChange={() => handleRoleChange(role)}
                            />
                            <label
                              className="flex-1 cursor-pointer font-medium text-sm leading-none"
                              htmlFor={`role-${role}`}
                            >
                              {role}
                            </label>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent className="space-y-4" value="security">
                <div className="rounded-lg bg-muted/40 p-4">
                  <h3 className="mb-1 font-medium">
                    {t("editor.accountSecurityTitle")}
                  </h3>
                  <p className="mb-4 text-muted-foreground text-sm">
                    {t("editor.accountSecurityDescription")}
                  </p>

                  <div className="space-y-2">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => {
                        toast({
                          title: t("messages.passwordResetTitle"),
                          description: t("messages.passwordResetDescription"),
                        });
                      }}
                      variant="outline"
                    >
                      {t("editor.passwordReset")}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
