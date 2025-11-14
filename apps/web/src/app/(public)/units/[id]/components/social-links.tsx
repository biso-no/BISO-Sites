"use client";

import { motion } from "motion/react";
import { Instagram, Facebook, Linkedin, Twitter, Globe } from "lucide-react";
import { DepartmentSocials } from "@repo/api/types/appwrite";

interface SocialLinksProps {
  socials: DepartmentSocials[];
}

export function SocialLinks({ socials }: SocialLinksProps) {
  const getSocialIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('instagram')) return Instagram;
    if (platformLower.includes('facebook')) return Facebook;
    if (platformLower.includes('linkedin')) return Linkedin;
    if (platformLower.includes('twitter') || platformLower.includes('x')) return Twitter;
    return Globe;
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-white/70 text-sm">Follow us:</span>
      {socials.map((social, index) => {
        const SocialIcon = getSocialIcon(social.platform || '');
        return (
          <motion.a
            key={index}
            href={social.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110"
          >
            <SocialIcon className="w-5 h-5 text-white" />
          </motion.a>
        );
      })}
    </div>
  );
}

