"use client";
import {
  Briefcase,
  Calendar,
  Link as LinkIcon,
  Megaphone,
  Rocket,
  Sparkles,
  Trophy,
} from "lucide-react";
import { motion } from "motion/react";
import { Card } from "../ui/card";

export type AboutStat = {
  number: string;
  label: string;
  iconName: "Calendar" | "Briefcase" | "Rocket" | "Trophy";
};

export type AboutValue = {
  iconName: "Megaphone" | "Link" | "Sparkles";
  title: string;
  description: string;
  gradient: string;
};

export type AboutProps = {
  stats: AboutStat[];
  values: AboutValue[];
  mainContent: {
    tag: string;
    titleLine1: string;
    titleLine2: string;
    paragraph1: string;
    paragraph2: string;
  };
  videoUrl?: string;
};

const IconMap = {
  Calendar,
  Briefcase,
  Rocket,
  Trophy,
  Megaphone,
  Link: LinkIcon,
  Sparkles,
};

export function About({
  stats,
  values,
  mainContent,
  videoUrl = "https://appwrite.biso.no/v1/storage/buckets/content/files/biso_video/view?project=biso&mode=admin",
}: AboutProps) {
  return (
    <section className="bg-linear-to-b from-gray-50 to-white py-24" id="about">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-20 grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = IconMap[stat.iconName] || Calendar;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={stat.label}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 bg-white p-6 text-center shadow-lg transition-shadow hover:shadow-xl">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731]">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="mb-1 text-gray-900">{stat.number}</div>
                  <div className="text-gray-600">{stat.label}</div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="mb-20 grid items-center gap-16 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <div className="mb-6 inline-block rounded-full bg-[#3DA9E0]/10 px-4 py-2 text-[#001731]">
              {mainContent.tag}
            </div>
            <h2 className="mb-6 text-gray-900">
              {mainContent.titleLine1}
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
                {mainContent.titleLine2}
              </span>
            </h2>
            <p className="mb-6 text-gray-600">{mainContent.paragraph1}</p>
            <p className="text-gray-600">{mainContent.paragraph2}</p>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 30 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <div className="aspect-video overflow-hidden rounded-2xl shadow-2xl">
              <video autoPlay height="100%" loop muted playsInline width="100%">
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
            <div className="-bottom-6 -right-6 absolute h-32 w-32 rounded-2xl bg-linear-to-br from-[#3DA9E0] to-[#001731] opacity-20 blur-2xl" />
          </motion.div>
        </div>

        {/* Values */}
        <div className="grid gap-8 md:grid-cols-3">
          {values.map((value, index) => {
            const Icon = IconMap[value.iconName] || Sparkles;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={value.title}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Card className="hover:-translate-y-2 border-0 bg-white p-8 shadow-lg transition-all duration-300 hover:shadow-xl">
                  <div
                    className={`mb-6 h-16 w-16 rounded-2xl bg-linear-to-br ${value.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-3 text-gray-900">{value.title}</h3>
                  <p className="text-gray-600">{value.description}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
