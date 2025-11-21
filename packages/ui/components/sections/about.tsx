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

export interface AboutStat {
  number: string;
  label: string;
  iconName: "Calendar" | "Briefcase" | "Rocket" | "Trophy";
}

export interface AboutValue {
  iconName: "Megaphone" | "Link" | "Sparkles";
  title: string;
  description: string;
  gradient: string;
}

export interface AboutProps {
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
}

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
    <section id="about" className="py-24 bg-linear-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, index) => {
            const Icon = IconMap[stat.iconName] || Calendar;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 text-center border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-gray-900 mb-1">{stat.number}</div>
                  <div className="text-gray-600">{stat.label}</div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-6">
              {mainContent.tag}
            </div>
            <h2 className="mb-6 text-gray-900">
              {mainContent.titleLine1}
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
                {mainContent.titleLine2}
              </span>
            </h2>
            <p className="text-gray-600 mb-6">{mainContent.paragraph1}</p>
            <p className="text-gray-600">{mainContent.paragraph2}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <video width="100%" height="100%" autoPlay loop muted playsInline>
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-linear-to-br from-[#3DA9E0] to-[#001731] rounded-2xl opacity-20 blur-2xl" />
          </motion.div>
        </div>

        {/* Values */}
        <div className="grid md:grid-cols-3 gap-8">
          {values.map((value, index) => {
            const Icon = IconMap[value.iconName] || Sparkles;
            return (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-8 border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-2 duration-300 bg-white">
                  <div
                    className={`w-16 h-16 mb-6 rounded-2xl bg-linear-to-br ${value.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-8 h-8 text-white" />
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
