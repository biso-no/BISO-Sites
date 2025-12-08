"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Link2, Shield, User } from "lucide-react";
import { useState } from "react";
import { ProfileForm } from "@/app/expenses/profile/profile-form";
import { PrivacyControls } from "@/components/privacy-controls";
import { IdentityManagement } from "@/components/profile/identity-management";

export function ProfileTabs({
  userData,
  identities,
}: {
  userData: any;
  identities?: any[];
}) {
  const [activeTab, setActiveTab] = useState("account");

  return (
    <Tabs
      className="space-y-6"
      defaultValue="account"
      onValueChange={setActiveTab}
      value={activeTab}
    >
      <TabsList className="w-full rounded-xl border border-primary/10 bg-surface-strong/60 p-1 shadow-card-soft">
        <TabsTrigger
          className="flex h-10 flex-1 items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary-100"
          value="account"
        >
          <User className="h-4 w-4" />
          <span>Account</span>
        </TabsTrigger>
        <TabsTrigger
          className="flex h-10 flex-1 items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary-100"
          value="privacy"
        >
          <Shield className="h-4 w-4" />
          <span>Privacy</span>
        </TabsTrigger>
        <TabsTrigger
          className="flex h-10 flex-1 items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary-100"
          value="identities"
        >
          <Link2 className="h-4 w-4" />
          <span>Linked Accounts</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent className="space-y-6" value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              View and manage your account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              email={userData.user.email}
              initialData={userData.profile}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent className="space-y-6" value="privacy">
        <PrivacyControls userId={userData.user.$id} />
      </TabsContent>

      <TabsContent className="space-y-6" value="identities">
        <IdentityManagement initialIdentities={identities} />
      </TabsContent>
    </Tabs>
  );
}
