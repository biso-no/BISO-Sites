'use client';
import { motion } from 'motion/react';
import { ArrowRight, Clock } from 'lucide-react';
import { Card } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { ImageWithFallback } from '@repo/ui/components/image';

export function News() {
  const newsItems = [
    {
      id: 1,
      title: 'BISO Wins National Student Organisation Award',
      excerpt: 'We are thrilled to announce that BISO has been recognized as Norway\'s best student organisation for 2024!',
      date: '2 days ago',
      image: 'https://images.unsplash.com/photo-1745272749509-5d212d97cbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB1bml2ZXJzaXR5JTIwYnVpbGRpbmd8ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      featured: true,
    },
    {
      id: 2,
      title: 'New Student Lounge Opening Soon',
      excerpt: 'Get ready for our brand new student lounge with modern facilities, study areas, and a cozy café.',
      date: '5 days ago',
      image: 'https://images.unsplash.com/photo-1758270705657-f28eec1a5694?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1wdXMlMjBsaWZlJTIwZW5lcmd5fGVufDF8fHx8MTc2MjE2NTE0NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      featured: false,
    },
    {
      id: 3,
      title: 'International Exchange Program Launch',
      excerpt: 'Join our new exchange program and connect with student organisations across Europe.',
      date: '1 week ago',
      image: 'https://images.unsplash.com/photo-1758270704113-9fb2ac81788f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwc3R1ZGVudHMlMjBncm91cHxlbnwxfHx8fDE3NjIxNTMyMDN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      featured: false,
    },
  ];

  return (
    <section id="news" className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-6">
            Latest News
          </div>
          <h2 className="mb-6 text-gray-900">
            Stay Updated with
            <br />
            <span className="bg-gradient-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
              What's Happening
            </span>
          </h2>
        </motion.div>

        {/* Featured News */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <Card className="overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-shadow duration-300">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative h-96 md:h-auto overflow-hidden group">
                <ImageWithFallback
                  src={newsItems[0].image}
                  alt={newsItems[0].title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
              <div className="p-12 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-[#3DA9E0] mb-4">
                  <Clock className="w-4 h-4" />
                  <span>{newsItems[0].date}</span>
                </div>
                <h3 className="mb-4 text-gray-900">{newsItems[0].title}</h3>
                <p className="text-gray-600 mb-6">{newsItems[0].excerpt}</p>
                <Button className="w-fit bg-gradient-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 group">
                  Read More
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Other News */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {newsItems.slice(1).map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group h-full">
                <div className="relative h-56 overflow-hidden">
                  <ImageWithFallback
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[#3DA9E0] mb-3">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{item.date}</span>
                  </div>
                  <h4 className="mb-3 text-gray-900">{item.title}</h4>
                  <p className="text-gray-600 mb-4">{item.excerpt}</p>
                  <Button variant="ghost" className="text-[#001731] hover:text-[#3DA9E0] p-0 h-auto group">
                    Read More
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Button variant="outline" size="lg" className="border-blue-600 text-blue-600 hover:bg-blue-50">
            View All News
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
