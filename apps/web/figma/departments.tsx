import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Users, Instagram, Facebook, Linkedin, Twitter, Globe, 
  Mail, MapPin, Building2, ShoppingBag, Newspaper, ExternalLink,
  TrendingUp, Calendar, Tag, ChevronRight, Award, Target, Heart
} from 'lucide-react';
import { Card } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Separator } from '@repo/ui/components/ui/separator';
import { ImageWithFallback } from '@repo/ui/components/image';
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { DepartmentSocials, DepartmentBoard, ContentTranslations, WebshopProducts, News } from '@repo/api/types/appwrite';









interface Department {
  Id: string;
  Name: string;
  campus: {
    name: string;
    id: string;
  };
  campus_id: string;
  logo: string | null;
  active: boolean | null;
  type: string | null;
  description: string | null;
  socials: DepartmentSocials[];
  news: News[];
  departmentBoard: DepartmentBoard[];
  products: WebshopProducts[];
}

interface DepartmentPageProps {
  departmentId: string;
  onBack: () => void;
  onProductClick?: (slug: string) => void;
  onNewsClick?: (newsId: string) => void;
  isMember?: boolean;
}

export function DepartmentPage({ departmentId, onBack, onProductClick, onNewsClick, isMember = false }: DepartmentPageProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Mock department data - in production this would come from your database
  const department: Department = {
    Id: departmentId,
    Name: 'Events Committee',
    campus: {
      name: 'Oslo',
      id: '1',
    },
    campus_id: '1',
    logo: null,
    active: true,
    type: 'committee',
    description: 'The Events Committee is the heart of student life at BISO Oslo. We organize unforgettable experiences, from networking galas to themed parties, career workshops to cultural celebrations. Our mission is to create meaningful moments that bring students together, foster connections, and make your time at BI truly memorable.',
    socials: [
      { platform: 'instagram', url: 'https://instagram.com/biso.events', department_id: departmentId },
      { platform: 'facebook', url: 'https://facebook.com/biso.events', department_id: departmentId },
      { platform: 'linkedin', url: 'https://linkedin.com/company/biso-events', department_id: departmentId },
    ],
    news: [
      {
        id: '1',
        title: 'Winter Gala 2024 - A Night to Remember',
        excerpt: 'Over 500 students attended our biggest event of the year, featuring live music, gourmet dinner, and networking opportunities...',
        date: '2024-11-10',
        image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYWxhJTIwZXZlbnR8ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
        category: 'Event Recap',
      },
      {
        id: '2',
        title: 'Upcoming: New Year Celebration 2025',
        excerpt: 'Join us for the biggest party of the year! Ring in 2025 with your fellow students at an exclusive venue...',
        date: '2024-11-08',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5ZWFyJTIwcGFydHl8ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
        category: 'Announcement',
      },
      {
        id: '3',
        title: 'Career Networking Workshop Success',
        excerpt: 'Industry leaders shared insights with students at our latest career-focused event...',
        date: '2024-11-05',
        image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXR3b3JraW5nJTIwZXZlbnR8ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
        category: 'Event Recap',
      },
    ],
    departmentBoard: [
      {
        name: 'Sophia Chen',
        role: 'Events Coordinator',
        imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjB3b21hbnxlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      },
      {
        name: 'Marcus Berg',
        role: 'Vice Coordinator',
        imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBtYW58ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      },
      {
        name: 'Emma Andersson',
        role: 'Logistics Manager',
        imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbnxlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      },
      {
        name: 'Oliver Hansen',
        role: 'Sponsorship Lead',
        imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBtYW58ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      },
    ],
    products: [
      {
        slug: 'winter-gala-ticket',
        status: 'active',
        campus_id: '1',
        category: 'Events',
        regular_price: 450,
        member_price: 350,
        member_only: false,
        image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYWxhJTIwdGlja2V0fGVufDF8fHx8MTc2MjE2NTE0NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
        stock: 150,
        departmentId: departmentId,
        translation: {
          locale: 'en',
          title: 'Winter Gala 2024 - Ticket',
          description: 'Join us for an unforgettable evening of elegance, networking, and celebration',
          short_description: 'Premium event ticket with dinner included',
        },
      },
      {
        slug: 'events-hoodie',
        status: 'active',
        campus_id: '1',
        category: 'Merchandise',
        regular_price: 399,
        member_price: 349,
        member_only: false,
        image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob29kaWV8ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
        stock: 50,
        departmentId: departmentId,
        translation: {
          locale: 'en',
          title: 'Events Committee Hoodie',
          description: 'Premium quality hoodie with embroidered Events Committee logo',
          short_description: 'Comfortable and stylish',
        },
      },
      {
        slug: 'networking-workshop',
        status: 'active',
        campus_id: '1',
        category: 'Events',
        regular_price: 200,
        member_price: 150,
        member_only: true,
        image: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b3Jrc2hvcHxlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
        stock: 30,
        departmentId: departmentId,
        translation: {
          locale: 'en',
          title: 'Career Networking Workshop',
          description: 'Exclusive workshop with industry leaders and career experts',
          short_description: 'Members only event',
        },
      },
    ],
  };

  const getSocialIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('instagram')) return Instagram;
    if (platformLower.includes('facebook')) return Facebook;
    if (platformLower.includes('linkedin')) return Linkedin;
    if (platformLower.includes('twitter')) return Twitter;
    return Globe;
  };

  const typeColors: Record<string, string> = {
    committee: 'bg-[#3DA9E0]/10 text-[#3DA9E0] border-[#3DA9E0]/30',
    team: 'bg-purple-100 text-purple-700 border-purple-200',
    service: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[60vh] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMHRlYW18ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt={department.Name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
        
        <div className="absolute inset-0">
          <div className="max-w-7xl mx-auto px-4 h-full flex items-center">
            <motion.button
              onClick={onBack}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white hover:text-[#3DA9E0] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl"
            >
              <div className="flex items-center gap-4 mb-6">
                {department.logo && (
                  <div className="w-20 h-20 rounded-xl bg-white/10 backdrop-blur-sm p-3 border border-white/20">
                    <img src={department.logo} alt={department.Name} className="w-full h-full object-contain" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-white/20 text-white border-white/30">
                      <Building2 className="w-3 h-3 mr-1" />
                      {department.type?.charAt(0).toUpperCase() + department.type?.slice(1)}
                    </Badge>
                    <Badge className="bg-white/20 text-white border-white/30">
                      <MapPin className="w-3 h-3 mr-1" />
                      {department.campus.name}
                    </Badge>
                  </div>
                  <h1 className="text-white mb-0">
                    {department.Name}
                  </h1>
                </div>
              </div>
              
              <p className="text-white/90 text-lg mb-8 max-w-2xl">
                {department.description}
              </p>

              {/* Social Links */}
              {department.socials && department.socials.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-white/70 text-sm">Follow us:</span>
                  {department.socials.map((social, index) => {
                    const SocialIcon = getSocialIcon(social.platform || '');
                    return (
                      <motion.a
                        key={index}
                        href={social.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110"
                      >
                        <SocialIcon className="w-5 h-5 text-white" />
                      </motion.a>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-0 rounded-none">
              <TabsTrigger 
                value="overview" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-[#3DA9E0] data-[state=active]:text-[#3DA9E0] px-6 py-4"
              >
                <Target className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="team" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-[#3DA9E0] data-[state=active]:text-[#3DA9E0] px-6 py-4"
              >
                <Users className="w-4 h-4 mr-2" />
                Our Team
              </TabsTrigger>
              <TabsTrigger 
                value="news" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-[#3DA9E0] data-[state=active]:text-[#3DA9E0] px-6 py-4"
              >
                <Newspaper className="w-4 h-4 mr-2" />
                News & Updates
              </TabsTrigger>
              <TabsTrigger 
                value="products" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-[#3DA9E0] data-[state=active]:text-[#3DA9E0] px-6 py-4"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Products & Tickets
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-8 border-0 shadow-xl bg-linear-to-br from-[#3DA9E0]/5 to-white">
                <h2 className="text-gray-900 mb-6">About {department.Name}</h2>
                <p className="text-gray-700 text-lg leading-relaxed mb-6">
                  {department.description}
                </p>
                
                <div className="grid md:grid-cols-3 gap-6 mt-8">
                  <div className="text-center p-6 rounded-lg bg-white border border-[#3DA9E0]/10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                      <Award className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-gray-900 mb-2">{department.news.length}+</h3>
                    <p className="text-gray-600">Events Organized</p>
                  </div>
                  
                  <div className="text-center p-6 rounded-lg bg-white border border-[#3DA9E0]/10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-gray-900 mb-2">{department.departmentBoard.length}</h3>
                    <p className="text-gray-600">Team Members</p>
                  </div>
                  
                  <div className="text-center p-6 rounded-lg bg-white border border-[#3DA9E0]/10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                      <Heart className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-gray-900 mb-2">1000+</h3>
                    <p className="text-gray-600">Students Reached</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Latest Highlights */}
            <section>
              <h2 className="text-gray-900 mb-8">Recent Highlights</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {department.news.slice(0, 3).map((news, index) => (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card 
                      className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                      onClick={() => onNewsClick?.(news.id)}
                    >
                      <div className="relative h-48 overflow-hidden">
                        {news.image && (
                          <ImageWithFallback
                            src={news.image}
                            alt={news.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        )}
                        <Badge className="absolute top-4 right-4 bg-[#3DA9E0] text-white border-0">
                          {news.category}
                        </Badge>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <Calendar className="w-4 h-4 text-[#3DA9E0]" />
                          {new Date(news.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                        <h3 className="text-gray-900 mb-2 group-hover:text-[#3DA9E0] transition-colors">
                          {news.title}
                        </h3>
                        <p className="text-gray-600 text-sm line-clamp-2">{news.excerpt}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h2 className="text-gray-900 mb-4">Meet Our Team</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Passionate students dedicated to creating amazing experiences for the BISO community
              </p>
            </motion.div>

            {department.departmentBoard && department.departmentBoard.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {department.departmentBoard.map((member, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-all text-center group">
                      <Avatar className="w-32 h-32 mx-auto mb-4 ring-4 ring-[#3DA9E0]/20 group-hover:ring-[#3DA9E0] transition-all">
                        <AvatarImage src={member.imageUrl || undefined} alt={member.name || ''} />
                        <AvatarFallback className="bg-linear-to-br from-[#3DA9E0] to-[#001731] text-white text-2xl">
                          {member.name?.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-gray-900 mb-1">{member.name}</h3>
                      <p className="text-[#3DA9E0] mb-4">{member.role}</p>
                      <div className="flex justify-center gap-3">
                        <Button variant="outline" size="sm" className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10">
                          <Mail className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10">
                          <Linkedin className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Join CTA */}
            <Card className="p-12 text-center border-0 shadow-xl bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10">
              <Users className="w-16 h-16 text-[#3DA9E0] mx-auto mb-6" />
              <h3 className="text-gray-900 mb-4">Want to Join Our Team?</h3>
              <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                We're always looking for passionate students to join {department.Name}. Check out our open positions and be part of something amazing!
              </p>
              <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white">
                View Open Positions
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h2 className="text-gray-900 mb-4">News & Updates</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Stay up to date with everything happening in {department.Name}
              </p>
            </motion.div>

            <div className="space-y-6">
              {department.news.map((news, index) => (
                <motion.div
                  key={news.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                    onClick={() => onNewsClick?.(news.id)}
                  >
                    <div className="md:flex">
                      <div className="md:w-1/3 h-64 md:h-auto relative overflow-hidden">
                        {news.image && (
                          <ImageWithFallback
                            src={news.image}
                            alt={news.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        )}
                        <Badge className="absolute top-4 right-4 bg-[#3DA9E0] text-white border-0">
                          {news.category}
                        </Badge>
                      </div>
                      <div className="md:w-2/3 p-8">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                          <Calendar className="w-4 h-4 text-[#3DA9E0]" />
                          {new Date(news.date).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                        <h3 className="text-gray-900 mb-4 group-hover:text-[#3DA9E0] transition-colors">
                          {news.title}
                        </h3>
                        <p className="text-gray-600 mb-6">{news.excerpt}</p>
                        <Button 
                          variant="outline" 
                          className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                        >
                          Read More
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h2 className="text-gray-900 mb-4">Products & Event Tickets</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Get your tickets and merchandise from {department.Name}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {department.products.map((product, index) => (
                <motion.div
                  key={product.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all group cursor-pointer"
                    onClick={() => onProductClick?.(product.slug)}
                  >
                    <div className="relative h-64 overflow-hidden bg-gray-100">
                      {product.image && (
                        <ImageWithFallback
                          src={product.image}
                          alt={product.translation.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      )}
                      {product.member_only && (
                        <Badge className="absolute top-4 left-4 bg-[#001731] text-white border-0">
                          Members Only
                        </Badge>
                      )}
                      <Badge className="absolute top-4 right-4 bg-[#3DA9E0] text-white border-0">
                        <Tag className="w-3 h-3 mr-1" />
                        {product.category}
                      </Badge>
                      
                      {product.stock !== null && product.stock < 20 && (
                        <Badge className="absolute bottom-4 right-4 bg-orange-500 text-white border-0">
                          Only {product.stock} left!
                        </Badge>
                      )}
                    </div>

                    <div className="p-6">
                      <h3 className="text-gray-900 mb-2 group-hover:text-[#3DA9E0] transition-colors">
                        {product.translation.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {product.translation.short_description || product.translation.description}
                      </p>

                      <Separator className="my-4" />

                      <div className="flex items-center justify-between">
                        <div>
                          {product.member_price && isMember ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-900">{product.member_price} NOK</span>
                                <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                                  Member
                                </Badge>
                              </div>
                              <span className="text-sm text-gray-500 line-through">
                                {product.regular_price} NOK
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-gray-900">{product.regular_price} NOK</span>
                              {product.member_price && !isMember && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {product.member_price} NOK for members
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <Button 
                          size="sm"
                          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
                        >
                          View
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {department.products.length === 0 && (
              <Card className="p-12 text-center border-0 shadow-lg">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-gray-900 mb-2">No Products Available</h3>
                <p className="text-gray-600">
                  Check back soon for new products and event tickets!
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
