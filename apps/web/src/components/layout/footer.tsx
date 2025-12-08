"use client";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Twitter,
} from "lucide-react";
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
    <footer className="bg-inverted pt-20 pb-10 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 20 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <div className="mb-4 flex items-center gap-3">
                <Image
                  alt="BISO"
                  height={48}
                  src="/images/logo-dark.png"
                  width={48}
                />
                <div>
                  <div>BISO</div>
                  <div className="text-muted-foreground text-sm">
                    BI Student Organisation
                  </div>
                </div>
              </div>
              <p className="mb-6 text-muted-foreground">{t("about.description")}</p>

              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>Nydalsveien 37, 0484 Oslo, Norway</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-5 w-5 shrink-0" />
                  <span>contact@biso.no</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links], index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              key={title}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h4 className="mb-4 text-white">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      className="text-muted-foreground transition-colors hover:text-white"
                      href={link.href}
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
          className="flex flex-col items-center justify-between border-border border-t pt-8 md:flex-row"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <p className="mb-4 text-muted-foreground md:mb-0">
            © {new Date().getFullYear()} BI Student Organisation. All rights
            reserved.
          </p>

          <div className="flex gap-4">
            {socialLinks.map((social) => (
              <Link
                aria-label={social.label}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-inverted transition-all duration-300 hover:bg-linear-to-br hover:from-purple-600 hover:to-pink-600"
                href={social.href}
                key={social.label}
              >
                <social.icon className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
