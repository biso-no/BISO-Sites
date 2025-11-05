'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, Users, Sparkles } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { ImageWithFallback } from '@repo/ui/components/image';
import Link from 'next/link';
import type { ContentTranslations } from '@repo/api/types/appwrite';

interface HeroCarouselProps {
  featuredContent: ContentTranslations[];
}

export function HeroCarousel({ featuredContent }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const scrollToContent = () => {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  };

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % featuredContent.length);
  }, [featuredContent.length]);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredContent.length) % featuredContent.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Auto-rotate carousel
  useEffect(() => {
    if (isPaused || featuredContent.length <= 1) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 6000); // 6 seconds per slide

    return () => clearInterval(interval);
  }, [isPaused, nextSlide, featuredContent.length]);

  if (!featuredContent || featuredContent.length === 0) {
    // Fallback to static hero
    return (
      <div className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1758270704113-9fb2ac81788f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwc3R1ZGVudHMlMjBncm91cHxlbnwxfHx8fDE3NjIxNTMyMDN8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Students at BI"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
          <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8"
            >
              <Sparkles className="w-5 h-5 text-[#3DA9E0]" />
              <span className="text-white/90">BI Student Organisation</span>
            </motion.div>

            <motion.h1
              className="mb-6 text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Your Student Life,
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Elevated
              </span>
            </motion.h1>

            <motion.p
              className="mb-10 text-white/80 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              Join Norway&apos;s most vibrant student community at BI Norwegian Business School. 
              Connect, create memories, and unlock opportunities that last a lifetime.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
            >
              <Link href="#join">
                <Button size="lg" className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 px-8 py-6 shadow-2xl shadow-[#3DA9E0]/50">
                  <Users className="w-5 h-5 mr-2" />
                  Become a Member
                </Button>
              </Link>
              <Link href="/events">
                <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 px-8 py-6">
                  <Calendar className="w-5 h-5 mr-2" />
                  View Events
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.button
            onClick={scrollToContent}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ChevronDown className="w-8 h-8 text-white/70" />
          </motion.button>
        </div>
      </div>
    );
  }

  const currentItem = featuredContent[currentIndex];
  const isEvent = !!currentItem.event_ref;
  const imageUrl = isEvent 
    ? currentItem.event_ref?.image 
    : currentItem.news_ref?.image;
  const contentLink = isEvent 
    ? `/events/${currentItem.content_id}` 
    : `/news/${currentItem.content_id}`;

  return (
    <div 
      className="relative h-screen w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          <ImageWithFallback
            src={imageUrl || 'https://images.unsplash.com/photo-1758270704113-9fb2ac81788f?w=1080'}
            alt={currentItem.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
          <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 max-w-6xl mx-auto">
        <motion.div
          key={`content-${currentIndex}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8">
            <Sparkles className="w-5 h-5 text-[#3DA9E0]" />
            <span className="text-white/90">Featured {isEvent ? 'Event' : 'News'}</span>
          </div>

          <h1 className="mb-6 text-white max-w-4xl mx-auto">
            {currentItem.title}
          </h1>

          <p className="mb-10 text-white/80 max-w-2xl mx-auto text-lg">
            {currentItem.description?.replace(/<[^>]+>/g, '').slice(0, 180)}...
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={contentLink}>
              <Button size="lg" className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 px-8 py-6 shadow-2xl shadow-[#3DA9E0]/50">
                Learn More
              </Button>
            </Link>
            <Link href={isEvent ? '/events' : '/news'}>
              <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 px-8 py-6">
                View All {isEvent ? 'Events' : 'News'}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Navigation arrows */}
        {featuredContent.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {/* Dots navigation */}
        {featuredContent.length > 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {featuredContent.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-white w-8' 
                    : 'bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Scroll indicator */}
        <motion.button
          onClick={scrollToContent}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer z-20"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-8 h-8 text-white/70" />
        </motion.button>
      </div>
    </div>
  );
}

