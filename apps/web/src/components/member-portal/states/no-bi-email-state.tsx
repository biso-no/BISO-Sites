"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
 AlertCircle,
 ArrowLeft,
 Building2,
 Link as LinkIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function NoBIEmailState() {
 const t = useTranslations("memberPortal");

 const handleLinkBIEmail = () => {
 // Redirect to BI OAuth flow
 // This will be implemented with your OAuth provider
 window.location.href = "/api/auth/oauth/bi";
 };

 return (
 <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-section to-background p-4 dark:from-background dark:to-card">
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="w-full max-w-md"
 initial={{ opacity: 0, y: 20 }}
 >
 <Card className="border-0 p-8 shadow-xl dark:bg-inverted/50 dark:backdrop-blur-sm">
 <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731]">
 <Building2 className="h-8 w-8 text-white" />
 </div>
 <h2 className="mb-4 text-center font-bold text-2xl text-foreground dark:text-foreground">
 {t("states.noBIEmail.title")}
 </h2>
 <p className="mb-6 text-center text-muted-foreground dark:text-muted-foreground">
 {t("states.noBIEmail.description")}
 </p>

 <Alert className="mb-6 border-[#3DA9E0]/20 bg-[#3DA9E0]/5 dark:border-[#3DA9E0]/30 dark:bg-[#3DA9E0]/10">
 <AlertCircle className="h-4 w-4 text-[#3DA9E0]" />
 <AlertDescription className="text-muted-foreground dark:text-muted-foreground">
 {t("states.noBIEmail.securityNote")}
 </AlertDescription>
 </Alert>

 <Button
 className="mb-4 w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
 onClick={handleLinkBIEmail}
 >
 <LinkIcon className="mr-2 h-4 w-4" />
 {t("states.noBIEmail.linkEmail")}
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
