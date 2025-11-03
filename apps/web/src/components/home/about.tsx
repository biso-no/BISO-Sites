'use client';
import { motion } from 'motion/react';
import { Users, Heart, Lightbulb, Trophy, Rocket, Star } from 'lucide-react';
import { Card } from '@repo/ui/components/ui/card';

export function About() {
  const stats = [
    { number: '5000+', label: 'Active Members', icon: Users },
    { number: '200+', label: 'Events Yearly', icon: Star },
    { number: '50+', label: 'Student Groups', icon: Rocket },
    { number: '15+', label: 'Years Strong', icon: Trophy },
  ];

  const values = [
    {
      icon: Heart,
      title: 'Community First',
      description: 'Building lasting connections and friendships that extend beyond the classroom.',
      gradient: 'from-[#3DA9E0] to-[#001731]',
    },
    {
      icon: Lightbulb,
      title: 'Innovation & Growth',
      description: 'Creating opportunities for personal and professional development.',
      gradient: 'from-[#3DA9E0] to-cyan-600',
    },
    {
      icon: Users,
      title: 'Inclusive Culture',
      description: 'Welcoming students from all backgrounds to create a diverse community.',
      gradient: 'from-[#001731] to-[#3DA9E0]',
    },
  ];

  return (
    <section id="about" className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 text-center border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-gray-900 mb-1">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-6">
              About BISO
            </div>
            <h2 className="mb-6 text-gray-900">
              Norway's Premier
              <br />
              <span className="bg-gradient-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
                Student Community
              </span>
            </h2>
            <p className="text-gray-600 mb-6">
              BI Student Organisation (BISO) is the heartbeat of student life at BI Norwegian Business School. 
              We're dedicated to creating unforgettable experiences, fostering meaningful connections, and 
              empowering students to make the most of their university years.
            </p>
            <p className="text-gray-600">
              From exciting social events and career workshops to cultural festivals and sports competitions, 
              we offer something for everyone. Join us and become part of a community that celebrates diversity, 
              encourages innovation, and creates memories that last a lifetime.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1760351065294-b069f6bcadc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50cyUyMHN0dWR5aW5nJTIwdG9nZXRoZXJ8ZW58MXx8fHwxNzYyMDczMzQ0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="BI Students"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-[#3DA9E0] to-[#001731] rounded-2xl opacity-20 blur-2xl" />
          </motion.div>
        </div>

        {/* Values */}
        <div className="grid md:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-8 border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-2 duration-300 bg-white">
                <div className={`w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br ${value.gradient} flex items-center justify-center shadow-lg`}>
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="mb-3 text-gray-900">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
