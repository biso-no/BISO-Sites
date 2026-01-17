"use client";
import { motion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Partner } from "@/app/actions/about";

export function Partners({ partners }: { partners: Partner[] }) {
  const t = useTranslations("about");

  return (
    <>
      {partners.length > 0 && (
        <section className="bg-section/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="mb-8 text-center font-bold text-2xl text-foreground md:text-3xl">
                {t("general.partners.title")}
              </h2>
              <div className="grid items-center justify-items-center gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {partners.map((partner, index) => (
                  <motion.div
                    className="flex items-center justify-center rounded-xl border border-border/50 bg-background p-6 shadow-sm transition-shadow hover:shadow-md"
                    initial={{ opacity: 0, scale: 0.9 }}
                    key={partner.name}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    viewport={{ once: true }}
                    whileInView={{ opacity: 1, scale: 1 }}
                  >
                    {partner.url ? (
                      <a
                        className="transition-opacity hover:opacity-80"
                        href={partner.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Image
                          alt={partner.name}
                          className="h-16 w-auto object-contain"
                          height={100}
                          src={partner.image_url}
                          width={200}
                        />
                      </a>
                    ) : (
                      <Image
                        alt={partner.name}
                        className="h-16 w-auto object-contain"
                        height={100}
                        src={partner.image_url}
                        width={200}
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </>
  );
}
