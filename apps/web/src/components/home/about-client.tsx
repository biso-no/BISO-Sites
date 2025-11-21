"use client";
import { Card } from "@repo/ui/components/ui/card";
import { Briefcase, Calendar, Link, Megaphone, Rocket, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

interface AboutClientProps {
  eventCount: number;
  jobCount: number;
  departmentsCount: number;
}

export function AboutClient({ eventCount, jobCount, departmentsCount }: AboutClientProps) {
  const t = useTranslations("home");
  const tAbout = useTranslations("about");
  const stats = [
    { number: `${eventCount}+`, label: t("about.upcomingEvents"), icon: Calendar },
    { number: `${jobCount}+`, label: t("about.jobOpportunities"), icon: Briefcase },
    { number: `${departmentsCount}+`, label: t("about.studentGroups"), icon: Rocket },
    //{ number: '15+', label: 'Years Strong', icon: Trophy },
  ];

  const values = [
    {
      icon: Megaphone,
      title: tAbout("general.strategy.items.impact.title"),
      description: tAbout("general.strategy.items.impact.desc"),
      gradient: "from-[#3DA9E0] to-[#001731]",
    },
    {
      icon: Link,
      title: tAbout("general.strategy.items.connected.title"),
      description: tAbout("general.strategy.items.connected.desc"),
      gradient: "from-[#3DA9E0] to-cyan-600",
    },
    {
      icon: Sparkles,
      title: tAbout("general.strategy.items.engaged.title"),
      description: tAbout("general.strategy.items.engaged.desc"),
      gradient: "from-[#001731] to-[#3DA9E0]",
    },
  ];

  return (
    <section id="about" className="py-24 bg-linear-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 text-center border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-gray-900 mb-1">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-6">
              About BISO
            </div>
            <h2 className="mb-6 text-gray-900">
              {t("about.mainContent.premier")}
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
                {t("about.mainContent.studentCommunity")}
              </span>
            </h2>
            <p className="text-gray-600 mb-6">{t("about.mainContent.paragraph1")}</p>
            <p className="text-gray-600">{t("about.mainContent.paragraph2")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <video width="100%" height="100%" autoPlay loop muted>
                <source
                  src="https://appwrite.biso.no/v1/storage/buckets/content/files/biso_video/view?project=biso&mode=admin"
                  type="video/mp4"
                />
              </video>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-linear-to-br from-[#3DA9E0] to-[#001731] rounded-2xl opacity-20 blur-2xl" />
          </motion.div>
        </div>

        {/* Values */}
        <div className="grid md:grid-cols-3 gap-8">
          {values.map((value, index) => (
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
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="mb-3 text-gray-900">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
