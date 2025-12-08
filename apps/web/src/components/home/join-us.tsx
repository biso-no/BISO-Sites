"use client";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Check, Crown, Gift, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

export function JoinUs() {
 const t = useTranslations("membership");
 const benefits = [
 { icon: Sparkles, text: t("benefits.categories.social.global") },
 { icon: Gift, text: t("benefits.categories.career.global") },
 { icon: Crown, text: t("benefits.categories.student.global") },
 { icon: Zap, text: t("benefits.categories.safety.global") },
 { icon: Check, text: t("benefits.categories.business.global") },
 ];

 const memberFeatures = [
 t("benefits.categories.social.global"),
 t("benefits.categories.career.global"),
 t("benefits.categories.student.global"),
 t("benefits.categories.safety.global"),
 t("benefits.categories.business.global"),
 ];

 const membershipDurations = [
 {
 name: t("durations.six-months.name"),
 price: t("durations.six-months.price"),
 period: t("durations.six-months.period"),
 savings: null,
 popular: false,
 gradient: "from-gray-600 to-gray-700",
 },
 {
 name: t("durations.one-year.name"),
 price: t("durations.one-year.price"),
 period: t("durations.one-year.period"),
 savings: t("durations.one-year.savings"),
 popular: true,
 gradient: "from-purple-600 to-pink-600",
 },
 {
 name: t("durations.three-years.name"),
 price: t("durations.three-years.price"),
 period: t("durations.three-years.period"),
 savings: t("durations.three-years.savings"),
 popular: false,
 gradient: "from-brand-gradient-from to-brand-gradient-to",
 },
 ];

 return (
 <section
 className="relative overflow-hidden bg-linear-to-b from-section to-background py-24"
 id="join"
 >
 {/* Background Decoration */}
 <div className="pointer-events-none absolute inset-0 overflow-hidden">
 <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-purple-200 opacity-20 blur-3xl" />
 <div className="absolute right-10 bottom-20 h-96 w-96 rounded-full bg-pink-200 opacity-20 blur-3xl" />
 </div>

 <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
 {/* Header */}
 <motion.div
 className="mb-16 text-center"
 initial={{ opacity: 0, y: 20 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 <div className="mb-6 inline-block rounded-full bg-linear-to-r from-purple-100 to-pink-100 px-4 py-2 text-purple-700">
 {t("membership")}
 </div>
 <h2 className="mb-6 text-foreground">
 {t("joinUs.join")}
 <br />
 <span className="bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
 {t("joinUs.biso")}
 </span>
 </h2>
 <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">
 {t("joinUs.subtitle")}
 </p>
 </motion.div>

 {/* Benefits Grid */}
 <motion.div
 className="mb-20 grid gap-6 md:grid-cols-3"
 initial={{ opacity: 0, y: 20 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 {benefits.map((benefit, index) => (
 <motion.div
 className="flex items-center gap-4 rounded-xl bg-background p-4 shadow-md transition-shadow hover:shadow-lg"
 initial={{ opacity: 0, y: 20 }}
 key={index}
 transition={{ delay: index * 0.05 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-purple-600 to-pink-600">
 <benefit.icon className="h-6 w-6 text-white" />
 </div>
 <span className="text-muted-foreground">{benefit.text}</span>
 </motion.div>
 ))}
 </motion.div>

 {/* Membership Description */}
 <motion.div
 className="mb-12 text-center"
 initial={{ opacity: 0, y: 20 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 <h3 className="mb-6 font-bold text-2xl text-foreground">
 {t("hero.badge")}
 </h3>
 <p className="mx-auto mb-8 max-w-3xl text-muted-foreground">
 {t("hero.subtitle")}
 </p>
 </motion.div>

 {/* Common Features */}
 <motion.div
 className="mx-auto mb-16 max-w-3xl"
 initial={{ opacity: 0, y: 20 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 <Card className="border-0 p-8 shadow-xl">
 <h4 className="mb-6 text-center font-semibold text-foreground text-xl">
 {t("onboarding.memberships-include")}
 </h4>
 <div className="grid gap-4 md:grid-cols-2">
 {memberFeatures.map((feature, idx) => (
 <div className="flex items-start gap-3" key={idx}>
 <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-600 to-pink-600">
 <Check className="h-4 w-4 text-white" />
 </div>
 <span className="text-muted-foreground">{feature}</span>
 </div>
 ))}
 </div>
 </Card>
 </motion.div>

 {/* Duration Options */}
 <div className="mb-16 grid gap-8 md:grid-cols-3">
 {membershipDurations.map((duration, index) => (
 <motion.div
 className="relative"
 initial={{ opacity: 0, y: 20 }}
 key={duration.name}
 transition={{ delay: index * 0.1 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 {duration.popular && (
 <div className="-top-4 -translate-x-1/2 absolute left-1/2 z-10">
 <div className="rounded-full bg-linear-to-r from-purple-600 to-pink-600 px-6 py-2 font-medium text-sm text-white shadow-lg">
 Most Popular
 </div>
 </div>
 )}
 <Card
 className={`flex h-full flex-col border-0 p-8 shadow-xl transition-all duration-300 hover:shadow-2xl ${
 duration.popular
 ? "scale-105 transform ring-2 ring-purple-600"
 : ""
 }`}
 >
 <div className="mb-8 text-center">
 <h3 className="mb-4 font-bold text-2xl text-foreground">
 {duration.name}
 </h3>
 <div className="mb-2">
 <span className="font-bold text-4xl text-foreground">
 {duration.price}
 </span>
 </div>
 <p className="text-muted-foreground">{duration.period}</p>
 {duration.savings && (
 <div className="mt-3">
 <span className="inline-block rounded-full bg-green-100 px-3 py-1 font-medium text-green-700 text-sm">
 {duration.savings}
 </span>
 </div>
 )}
 </div>

 <Button
 className={`w-full bg-linear-to-r ${duration.gradient} mt-auto border-0 text-white shadow-lg hover:opacity-90`}
 >
 Choose {duration.name}
 </Button>
 </Card>
 </motion.div>
 ))}
 </div>

 {/* CTA */}
 <motion.div
 className="text-center"
 initial={{ opacity: 0, y: 20 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 <Card className="border-0 bg-linear-to-br from-blue-600 to-primary-80 p-12 text-white shadow-2xl">
 <h3 className="mb-4 text-white">{t("onboarding.notSure.title")}</h3>
 <p className="mx-auto mb-8 max-w-2xl text-white/90">
 {t("onboarding.notSure.subtitle")}
 </p>
 <Button
 className="border-0 bg-background text-purple-600 hover:bg-muted"
 size="lg"
 >
 {t("onboarding.notSure.cta")}
 </Button>
 </Card>
 </motion.div>
 </div>
 </section>
 );
}
