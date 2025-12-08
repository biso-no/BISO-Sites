"use client";
import { Card } from "@repo/ui/components/ui/card";
import {
 Briefcase,
 Calendar,
 Link,
 Megaphone,
 Rocket,
 Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

type AboutClientProps = {
 eventCount: number;
 jobCount: number;
 departmentsCount: number;
};

export function AboutClient({
 eventCount,
 jobCount,
 departmentsCount,
}: AboutClientProps) {
 const t = useTranslations("home");
 const tAbout = useTranslations("about");
 const stats = [
  {
   number: `${eventCount}+`,
   label: t("about.upcomingEvents"),
   icon: Calendar,
  },
  {
   number: `${jobCount}+`,
   label: t("about.jobOpportunities"),
   icon: Briefcase,
  },
  {
   number: `${departmentsCount}+`,
   label: t("about.studentGroups"),
   icon: Rocket,
  },
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
  <section className="bg-linear-to-b from-section to-background py-24" id="about">
   <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    {/* Stats */}
    <div className="mb-20 grid grid-cols-2 gap-6 md:grid-cols-4">
     {stats.map((stat, index) => (
      <motion.div
       initial={{ opacity: 0, y: 20 }}
       key={stat.label}
       transition={{ delay: index * 0.1 }}
       viewport={{ once: true }}
       whileInView={{ opacity: 1, y: 0 }}
      >
       <Card className="border-0 p-6 text-center shadow-lg transition-shadow hover:shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731]">
         <stat.icon className="h-6 w-6 text-white" />
        </div>
        <div className="mb-1 text-foreground">{stat.number}</div>
        <div className="text-muted-foreground">{stat.label}</div>
       </Card>
      </motion.div>
     ))}
    </div>

    {/* Main Content */}
    <div className="mb-20 grid items-center gap-16 md:grid-cols-2">
     <motion.div
      initial={{ opacity: 0, x: -30 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, x: 0 }}
     >
      <div className="mb-6 inline-block rounded-full bg-[#3DA9E0]/10 px-4 py-2 text-[#001731]">
       About BISO
      </div>
      <h2 className="mb-6 text-foreground">
       {t("about.mainContent.premier")}
       <br />
       <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
        {t("about.mainContent.studentCommunity")}
       </span>
      </h2>
      <p className="mb-6 text-muted-foreground">
       {t("about.mainContent.paragraph1")}
      </p>
      <p className="text-muted-foreground">{t("about.mainContent.paragraph2")}</p>
     </motion.div>

     <motion.div
      className="relative"
      initial={{ opacity: 0, x: 30 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, x: 0 }}
     >
      <div className="aspect-video overflow-hidden rounded-2xl shadow-2xl">
       <video autoPlay height="100%" loop muted width="100%">
        <source
         src="https://appwrite.biso.no/v1/storage/buckets/content/files/biso_video/view?project=biso&mode=admin"
         type="video/mp4"
        />
       </video>
      </div>
      <div className="-bottom-6 -right-6 absolute h-32 w-32 rounded-2xl bg-linear-to-br from-[#3DA9E0] to-[#001731] opacity-20 blur-2xl" />
     </motion.div>
    </div>

    {/* Values */}
    <div className="grid gap-8 md:grid-cols-3">
     {values.map((value, index) => (
      <motion.div
       initial={{ opacity: 0, y: 20 }}
       key={value.title}
       transition={{ delay: index * 0.1 }}
       viewport={{ once: true }}
       whileInView={{ opacity: 1, y: 0 }}
      >
       <Card className="hover:-translate-y-2 border-0 p-8 shadow-lg transition-all duration-300 hover:shadow-xl">
        <div
         className={`mb-6 h-16 w-16 rounded-2xl bg-linear-to-br ${value.gradient} flex items-center justify-center shadow-lg`}
        >
         <value.icon className="h-8 w-8 text-white" />
        </div>
        <h3 className="mb-3 text-foreground">{value.title}</h3>
        <p className="text-muted-foreground">{value.description}</p>
       </Card>
      </motion.div>
     ))}
    </div>
   </div>
  </section>
 );
}
