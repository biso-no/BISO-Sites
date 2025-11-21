"use client";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Twitter } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("common.footer");
  const footerLinks = {
    About: [
      { label: t("about.ourStory"), href: "#" },
      { label: t("about.team"), href: "#" },
      { label: t("about.careers"), href: "#" },
      { label: t("about.contact"), href: "#" },
    ],
    Students: [
      { label: t("students.membership"), href: "#join" },
      { label: t("students.events"), href: "#events" },
      { label: t("students.news"), href: "#news" },
      { label: t("students.resources"), href: "#" },
    ],
    Support: [
      { label: t("support.faq"), href: "#" },
      { label: t("support.helpCenter"), href: "#" },
      { label: t("support.privacyPolicy"), href: "#" },
      { label: t("support.termsOfService"), href: "#" },
    ],
  };

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Instagram, href: "#", label: "Instagram" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
  ];

  return (
    <footer className="bg-gray-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Image src="/images/logo-dark.png" alt="BISO" width={48} height={48} />
                <div>
                  <div>BISO</div>
                  <div className="text-sm text-gray-400">BI Student Organisation</div>
                </div>
              </div>
              <p className="text-gray-400 mb-6">{t("about.description")}</p>

              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-gray-400">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>Nydalsveien 37, 0484 Oslo, Norway</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <Mail className="w-5 h-5 shrink-0" />
                  <span>contact@biso.no</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links], index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <h4 className="mb-4 text-white">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Social Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-800"
        >
          <p className="text-gray-400 mb-4 md:mb-0">
            © {new Date().getFullYear()} BI Student Organisation. All rights reserved.
          </p>

          <div className="flex gap-4">
            {socialLinks.map((social) => (
              <Link
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-linear-to-br hover:from-purple-600 hover:to-pink-600 flex items-center justify-center transition-all duration-300"
              >
                <social.icon className="w-5 h-5" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
