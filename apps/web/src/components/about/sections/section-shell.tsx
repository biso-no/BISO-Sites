"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface AboutSectionProps {
  children: ReactNode;
  eyebrow?: string;
  id: string;
  intro?: string;
  /** Alternate band background so consecutive sections read apart. */
  muted?: boolean;
  title: string;
  wide?: boolean;
}

/** One band of the merged Om BISO page: heading, optional intro, content. */
export function AboutSection({
  children,
  eyebrow,
  id,
  intro,
  muted,
  title,
  wide,
}: AboutSectionProps) {
  return (
    <section
      className={`scroll-mt-36 py-16 ${muted ? "bg-section/50" : ""}`}
      id={id}
    >
      <div
        className={`mx-auto px-4 sm:px-6 lg:px-8 ${wide ? "max-w-7xl" : "max-w-4xl"}`}
      >
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {eyebrow && (
            <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
              {eyebrow}
            </div>
          )}
          <h2 className="font-bold text-2xl text-foreground md:text-3xl">
            {title}
          </h2>
          {intro && (
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {intro}
            </p>
          )}
        </motion.div>
        {children}
      </div>
    </section>
  );
}

/** A block of pre-formatted copy from the message bundle. */
export function SectionCopy({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-lg text-muted-foreground leading-relaxed">
      {text}
    </p>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-12 mb-6 font-semibold text-foreground text-xl">
      {children}
    </h3>
  );
}
