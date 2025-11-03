'use client';
import { motion } from 'motion/react';
import { Check, Sparkles, Gift, Crown, Zap } from 'lucide-react';
import { Card } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';

export function JoinUs() {
  const benefits = [
    { icon: Sparkles, text: 'Access to 200+ exclusive events yearly' },
    { icon: Gift, text: 'Member discounts at partner venues' },
    { icon: Crown, text: 'Priority booking for popular events' },
    { icon: Zap, text: 'Networking with 5000+ students' },
    { icon: Check, text: 'Career development workshops' },
    { icon: Check, text: 'International exchange opportunities' },
  ];

  const membershipTiers = [
    {
      name: 'Basic',
      price: '299 NOK',
      period: 'per semester',
      features: [
        'Access to all social events',
        'Student discount card',
        'BISO newsletter',
        'Basic event priority',
      ],
      popular: false,
      gradient: 'from-gray-600 to-gray-700',
    },
    {
      name: 'Premium',
      price: '499 NOK',
      period: 'per semester',
      features: [
        'Everything in Basic',
        'Priority event registration',
        'Exclusive networking events',
        'Career development workshops',
        'Free welcome package',
      ],
      popular: true,
      gradient: 'from-purple-600 to-pink-600',
    },
    {
      name: 'VIP',
      price: '799 NOK',
      period: 'per semester',
      features: [
        'Everything in Premium',
        'VIP event access',
        'One-on-one mentorship',
        'Premium partner discounts',
        'International opportunities',
        'Exclusive VIP lounge access',
      ],
      popular: false,
      gradient: 'from-yellow-600 to-orange-600',
    },
  ];

  return (
    <section id="join" className="py-24 bg-linear-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full opacity-20 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-200 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full bg-linear-to-r from-purple-100 to-pink-100 text-purple-700 mb-6">
            Membership
          </div>
          <h2 className="mb-6 text-gray-900">
            Join the
            <br />
            <span className="bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Best Student Community
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-12">
            Unlock exclusive benefits, unforgettable experiences, and connections that will shape your future.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6 mb-20"
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 rounded-lg bg-linear-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                <benefit.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-gray-700">{benefit.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {membershipTiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="bg-linear-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full shadow-lg">
                    Most Popular
                  </div>
                </div>
              )}
              <Card className={`p-8 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 h-full flex flex-col ${
                tier.popular ? 'ring-2 ring-purple-600 transform scale-105' : ''
              }`}>
                <div className="text-center mb-8">
                  <h3 className="mb-4 text-gray-900">{tier.name}</h3>
                  <div className="mb-2">
                    <span className="text-gray-900">{tier.price}</span>
                  </div>
                  <p className="text-gray-600">{tier.period}</p>
                </div>

                <ul className="space-y-4 mb-8 grow">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full bg-linear-to-br ${tier.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button className={`w-full bg-linear-to-r ${tier.gradient} hover:opacity-90 text-white border-0 shadow-lg`}>
                  Choose {tier.name}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Card className="p-12 border-0 shadow-2xl bg-linear-to-br from-purple-600 to-pink-600 text-white">
            <h3 className="mb-4 text-white">Not sure which to choose?</h3>
            <p className="mb-8 text-white/90 max-w-2xl mx-auto">
              Contact our team and we&apos;ll help you find the perfect membership plan for your student journey.
            </p>
            <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 border-0">
              Talk to Us
            </Button>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
