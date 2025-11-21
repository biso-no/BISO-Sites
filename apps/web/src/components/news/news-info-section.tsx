"use client";

import { Bell, Mail, Share2 } from "lucide-react";
import { motion } from "motion/react";

export function NewsInfoSection() {
  return (
    <div className="bg-[#001731] py-16 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h3 className="mb-4 font-bold text-3xl">Stay Connected with BISO</h3>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            Never miss out on important updates, events, and stories from the
            BISO community.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#3DA9E0]/20">
              <Bell className="h-8 w-8 text-[#3DA9E0]" />
            </div>
            <h4 className="mb-2 font-bold text-xl">Get Notifications</h4>
            <p className="text-white/70">
              Follow us on social media to get instant notifications about new
              articles and announcements.
            </p>
          </motion.div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#3DA9E0]/20">
              <Mail className="h-8 w-8 text-[#3DA9E0]" />
            </div>
            <h4 className="mb-2 font-bold text-xl">Weekly Newsletter</h4>
            <p className="text-white/70">
              Subscribe to our newsletter to receive a weekly digest of the most
              important news and events.
            </p>
          </motion.div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.3 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#3DA9E0]/20">
              <Share2 className="h-8 w-8 text-[#3DA9E0]" />
            </div>
            <h4 className="mb-2 font-bold text-xl">Share Stories</h4>
            <p className="text-white/70">
              Help us spread the word! Share interesting articles with your
              friends and fellow students.
            </p>
          </motion.div>
        </div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1 }}
        >
          <p className="font-semibold text-[#3DA9E0] text-lg">
            Have a story to share? Contact us at{" "}
            <a
              className="underline transition-colors hover:text-cyan-300"
              href="mailto:news@biso.no"
            >
              news@biso.no
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
