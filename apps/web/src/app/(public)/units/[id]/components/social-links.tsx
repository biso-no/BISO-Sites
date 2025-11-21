"use client";

import type { DepartmentSocials } from "@repo/api/types/appwrite";
import { Facebook, Globe, Instagram, Linkedin, Twitter } from "lucide-react";
import { motion } from "motion/react";

type SocialLinksProps = {
  socials: DepartmentSocials[];
};

export function SocialLinks({ socials }: SocialLinksProps) {
  const getSocialIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes("instagram")) {
      return Instagram;
    }
    if (platformLower.includes("facebook")) {
      return Facebook;
    }
    if (platformLower.includes("linkedin")) {
      return Linkedin;
    }
    if (platformLower.includes("twitter") || platformLower.includes("x")) {
      return Twitter;
    }
    return Globe;
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-white/70">Follow us:</span>
      {socials.map((social, index) => {
        const SocialIcon = getSocialIcon(social.platform || "");
        return (
          <motion.a
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20"
            href={social.url || "#"}
            initial={{ opacity: 0, scale: 0.8 }}
            key={index}
            rel="noopener noreferrer"
            target="_blank"
            transition={{ delay: index * 0.1 }}
          >
            <SocialIcon className="h-5 w-5 text-white" />
          </motion.a>
        );
      })}
    </div>
  );
}
