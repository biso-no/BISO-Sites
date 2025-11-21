"use client";
import { Check, Crown, Gift, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export type JoinUsBenefit = {
  iconName: "Sparkles" | "Gift" | "Crown" | "Zap" | "Check";
  text: string;
};

export type JoinUsDuration = {
  name: string;
  price: string;
  period: string;
  savings?: string | null;
  popular: boolean;
  gradient: string;
};

export type JoinUsProps = {
  tag: string;
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  benefits: JoinUsBenefit[];
  heroBadge: string;
  heroSubtitle: string;
  memberFeaturesHeader: string;
  memberFeatures: string[];
  durations: JoinUsDuration[];
  cta: {
    title: string;
    subtitle: string;
    buttonText: string;
  };
};

const IconMap = {
  Sparkles,
  Gift,
  Crown,
  Zap,
  Check,
};

export function JoinUs({
  tag,
  titleLine1,
  titleLine2,
  subtitle,
  benefits,
  heroBadge,
  heroSubtitle,
  memberFeaturesHeader,
  memberFeatures,
  durations,
  cta,
}: JoinUsProps) {
  return (
    <section
      className="relative overflow-hidden bg-linear-to-b from-gray-50 to-white py-24"
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
            {tag}
          </div>
          <h2 className="mb-6 text-gray-900">
            {titleLine1}
            <br />
            <span className="bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {titleLine2}
            </span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-gray-600">{subtitle}</p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          className="mb-20 grid gap-6 md:grid-cols-3"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {benefits.map((benefit, index) => {
            const Icon = IconMap[benefit.iconName] || Sparkles;
            return (
              <motion.div
                className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-md transition-shadow hover:shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                key={index}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-purple-600 to-pink-600">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-gray-700">{benefit.text}</span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Membership Description */}
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h3 className="mb-6 font-bold text-2xl text-gray-900">{heroBadge}</h3>
          <p className="mx-auto mb-8 max-w-3xl text-gray-600">{heroSubtitle}</p>
        </motion.div>

        {/* Common Features */}
        <motion.div
          className="mx-auto mb-16 max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Card className="border-0 bg-white p-8 shadow-xl">
            <h4 className="mb-6 text-center font-semibold text-gray-900 text-xl">
              {memberFeaturesHeader}
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              {memberFeatures.map((feature, idx) => (
                <div className="flex items-start gap-3" key={idx}>
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-600 to-pink-600">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gray-600">{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Duration Options */}
        <div className="mb-16 grid gap-8 md:grid-cols-3">
          {durations.map((duration, index) => (
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
                  <h3 className="mb-4 font-bold text-2xl text-gray-900">
                    {duration.name}
                  </h3>
                  <div className="mb-2">
                    <span className="font-bold text-4xl text-gray-900">
                      {duration.price}
                    </span>
                  </div>
                  <p className="text-gray-600">{duration.period}</p>
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
            <h3 className="mb-4 text-white">{cta.title}</h3>
            <p className="mx-auto mb-8 max-w-2xl text-white/90">
              {cta.subtitle}
            </p>
            <Button
              className="border-0 bg-white text-purple-600 hover:bg-gray-100"
              size="lg"
            >
              {cta.buttonText}
            </Button>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
