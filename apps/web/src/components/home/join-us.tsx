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
      gradient: "from-[#3DA9E0] to-[#001731]",
    },
  ];

  return (
    <section
      id="join"
      className="py-24 bg-linear-to-b from-gray-50 to-white relative overflow-hidden"
    >
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full opacity-20 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-200 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full bg-linear-to-r from-purple-100 to-pink-100 text-purple-700 mb-6">
            {t("membership")}
          </div>
          <h2 className="mb-6 text-gray-900">
            {t("joinUs.join")}
            <br />
            <span className="bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t("joinUs.biso")}
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-12">
            {t("joinUs.subtitle")}
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6 mb-20"
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 rounded-lg bg-linear-to-br from-purple-600 to-pink-600 flex items-center justify-center shrink-0">
                <benefit.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-gray-700">{benefit.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Membership Description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            {t("hero.badge")}
          </h3>
          <p className="text-gray-600 max-w-3xl mx-auto mb-8">
            {t("hero.subtitle")}
          </p>
        </motion.div>

        {/* Common Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto mb-16"
        >
          <Card className="p-8 border-0 shadow-xl bg-white">
            <h4 className="text-xl font-semibold text-gray-900 mb-6 text-center">
              {t("onboarding.memberships-include")}
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              {memberFeatures.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-linear-to-br from-purple-600 to-pink-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-600">{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Duration Options */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {membershipDurations.map((duration, index) => (
            <motion.div
              key={duration.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {duration.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="bg-linear-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full shadow-lg text-sm font-medium">
                    Most Popular
                  </div>
                </div>
              )}
              <Card
                className={`p-8 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 h-full flex flex-col ${
                  duration.popular
                    ? "ring-2 ring-purple-600 transform scale-105"
                    : ""
                }`}
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-4 text-gray-900">
                    {duration.name}
                  </h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {duration.price}
                    </span>
                  </div>
                  <p className="text-gray-600">{duration.period}</p>
                  {duration.savings && (
                    <div className="mt-3">
                      <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                        {duration.savings}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  className={`w-full bg-linear-to-r ${duration.gradient} hover:opacity-90 text-white border-0 shadow-lg mt-auto`}
                >
                  Choose {duration.name}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Card className="p-12 border-0 shadow-2xl bg-linear-to-br from-blue-600 to-primary-80 text-white">
            <h3 className="mb-4 text-white">{t("onboarding.notSure.title")}</h3>
            <p className="mb-8 text-white/90 max-w-2xl mx-auto">
              {t("onboarding.notSure.subtitle")}
            </p>
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 border-0"
            >
              {t("onboarding.notSure.cta")}
            </Button>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
