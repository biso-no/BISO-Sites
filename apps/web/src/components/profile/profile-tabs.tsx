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
      defaultValue="account"
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-6"
    >
      <TabsList className="w-full rounded-xl border border-primary/10 bg-surface-strong/60 p-1 shadow-card-soft">
        <TabsTrigger
          value="account"
          className="flex h-10 flex-1 items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-100"
        >
          <User className="h-4 w-4" />
          <span>Account</span>
        </TabsTrigger>
        <TabsTrigger
          value="privacy"
          className="flex h-10 flex-1 items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-100"
        >
          <Shield className="h-4 w-4" />
          <span>Privacy</span>
        </TabsTrigger>
        <TabsTrigger
          value="identities"
          className="flex h-10 flex-1 items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-100"
        >
          <Link2 className="h-4 w-4" />
          <span>Linked Accounts</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="space-y-6">
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

      <TabsContent value="privacy" className="space-y-6">
        <PrivacyControls userId={userData.user.$id} />
      </TabsContent>

      <TabsContent value="identities" className="space-y-6">
        <IdentityManagement initialIdentities={identities} />
      </TabsContent>
    </Tabs>
  );
}
