"use client";

import { initiateVippsCheckout } from "@repo/payment/actions";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowLeft, Award, CheckCircle, CreditCard } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

type MembershipDuration = "semester" | "year" | "three-year";

const MEMBERSHIP_PRICES = {
 semester: 350,
 year: 550,
 "three-year": 1400,
};

type NotMemberStateProps = {
 benefitsCount?: number;
};

export function NotMemberState({ benefitsCount = 6 }: NotMemberStateProps) {
 const t = useTranslations("memberPortal");
 const [selectedPlan, setSelectedPlan] = useState<MembershipDuration>("year");
 const [isPending, startTransition] = useTransition();

 const handlePurchase = () => {
 startTransition(async () => {
 try {
 await initiateVippsCheckout({
 reference: `membership-${Date.now()}`,
 amount: MEMBERSHIP_PRICES[selectedPlan] * 100, // Convert to øre
 description: `BISO Membership - ${t(`states.notMember.pricing.${selectedPlan}`)}`,
 returnUrl: `${window.location.origin}/member?purchase=success`,
 customerInfo: {
 // Will be filled by Vipps from session
 },
 });
 } catch (error) {
 console.error("Failed to initiate checkout:", error);
 }
 });
 };

 return (
 <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-section to-background p-4 dark:from-background dark:to-card">
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="w-full max-w-2xl"
 initial={{ opacity: 0, y: 20 }}
 >
 <Card className="border-0 p-8 shadow-xl dark:bg-inverted/50 dark:backdrop-blur-sm">
 <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
 <Award className="h-8 w-8 text-white" />
 </div>
 <h2 className="mb-4 text-center font-bold text-3xl text-foreground dark:text-foreground">
 {t("states.notMember.title")}
 </h2>
 <p className="mx-auto mb-8 max-w-xl text-center text-muted-foreground dark:text-muted-foreground">
 {t("states.notMember.description")}
 </p>

 {/* Membership Options */}
 <div className="mb-8 grid gap-4 sm:grid-cols-3">
 {Object.entries(MEMBERSHIP_PRICES).map(([type, price]) => (
 <Card
 className={`cursor-pointer border-2 p-6 transition-colors ${
 selectedPlan === type
 ? "border-brand bg-brand-muted dark:bg-brand-muted"
 : "border-border hover:border-brand-border-strong dark:border-border dark:hover:border-brand-border-strong"
 }`}
 key={type}
 onClick={() => setSelectedPlan(type as MembershipDuration)}
 >
 <div className="text-center">
 <h3 className="mb-2 font-semibold text-foreground text-lg dark:text-foreground">
 {t(`states.notMember.pricing.${type}`)}
 </h3>
 <div className="mb-4 font-bold text-2xl text-foreground dark:text-foreground">
 {price} NOK
 </div>
 <Badge
 className="border-brand-border text-brand dark:border-brand-border-strong"
 variant="outline"
 >
 {type === "three-year"
 ? t("states.notMember.pricing.bestValue")
 : t("states.notMember.pricing.popular")}
 </Badge>
 </div>
 </Card>
 ))}
 </div>

 {/* Benefits Preview */}
 <div className="mb-6 rounded-lg bg-linear-to-br from-brand-muted to-brand-muted p-6 dark:from-brand-muted-strong dark:to-brand-muted-strong">
 <h3 className="mb-4 font-semibold text-foreground text-lg dark:text-foreground">
 {t("states.notMember.whatYouGet")}
 </h3>
 <ul className="space-y-3">
 <li className="flex items-start gap-3">
 <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
 <span className="text-muted-foreground dark:text-muted-foreground">
 {t("states.notMember.benefits.discounts", {
 count: benefitsCount,
 })}
 </span>
 </li>
 <li className="flex items-start gap-3">
 <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
 <span className="text-muted-foreground dark:text-muted-foreground">
 {t("states.notMember.benefits.memberPricing")}
 </span>
 </li>
 <li className="flex items-start gap-3">
 <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
 <span className="text-muted-foreground dark:text-muted-foreground">
 {t("states.notMember.benefits.priorityAccess")}
 </span>
 </li>
 <li className="flex items-start gap-3">
 <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
 <span className="text-muted-foreground dark:text-muted-foreground">
 {t("states.notMember.benefits.community")}
 </span>
 </li>
 </ul>
 </div>

 <Button
 className="mb-4 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
 disabled={isPending}
 onClick={handlePurchase}
 >
 <CreditCard className="mr-2 h-4 w-4" />
 {isPending
 ? "Processing..."
 : t("states.notMember.purchaseMembership")}
 </Button>
 <Link href="/">
 <Button className="w-full" variant="outline">
 <ArrowLeft className="mr-2 h-4 w-4" />
 {t("backToHome")}
 </Button>
 </Link>
 </Card>
 </motion.div>
 </div>
 );
}
