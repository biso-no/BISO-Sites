'use client'

import { motion } from 'motion/react'
import { Bell, Mail, Share2 } from 'lucide-react'

export function NewsInfoSection() {
  return (
    <div className="bg-[#001731] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h3 className="text-3xl font-bold mb-4">Stay Connected with BISO</h3>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Never miss out on important updates, events, and stories from the BISO community.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#3DA9E0]/20 mb-4">
              <Bell className="w-8 h-8 text-[#3DA9E0]" />
            </div>
            <h4 className="text-xl font-bold mb-2">Get Notifications</h4>
            <p className="text-white/70">
              Follow us on social media to get instant notifications about new articles and announcements.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#3DA9E0]/20 mb-4">
              <Mail className="w-8 h-8 text-[#3DA9E0]" />
            </div>
            <h4 className="text-xl font-bold mb-2">Weekly Newsletter</h4>
            <p className="text-white/70">
              Subscribe to our newsletter to receive a weekly digest of the most important news and events.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#3DA9E0]/20 mb-4">
              <Share2 className="w-8 h-8 text-[#3DA9E0]" />
            </div>
            <h4 className="text-xl font-bold mb-2">Share Stories</h4>
            <p className="text-white/70">
              Help us spread the word! Share interesting articles with your friends and fellow students.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-[#3DA9E0] font-semibold text-lg">
            Have a story to share? Contact us at <a href="mailto:news@biso.no" className="underline hover:text-cyan-300 transition-colors">news@biso.no</a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

