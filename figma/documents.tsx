import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Search, 
  Scale, 
  BookOpen, 
  Shield, 
  Briefcase, 
  MessageSquare,
  Building2,
  Globe,
  ChevronRight,
  Eye
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

interface Document {
  id: string;
  title: string;
  description: string;
  category: 'statutes' | 'local-laws' | 'conduct' | 'business' | 'communication';
  campus?: string; // For campus-specific documents
  lastUpdated: string;
  fileSize: string;
  downloadUrl: string; // Future: SharePoint URL
}

const documents: Document[] = [
  // Statutes (National Level)
  {
    id: 'stat-1',
    title: 'BISO Constitution',
    description: 'The foundational document that establishes the structure, purpose, and governing principles of the BI Student Organisation.',
    category: 'statutes',
    lastUpdated: 'January 2024',
    fileSize: '2.4 MB',
    downloadUrl: '#',
  },
  {
    id: 'stat-2',
    title: 'National Bylaws',
    description: 'Comprehensive bylaws applicable to all BISO operations across all campuses, defining procedures and governance.',
    category: 'statutes',
    lastUpdated: 'March 2024',
    fileSize: '1.8 MB',
    downloadUrl: '#',
  },
  {
    id: 'stat-3',
    title: 'Electoral Regulations',
    description: 'Rules and procedures for all BISO elections, including board positions and student representatives.',
    category: 'statutes',
    lastUpdated: 'February 2024',
    fileSize: '890 KB',
    downloadUrl: '#',
  },
  
  // Local Laws (Campus Level)
  {
    id: 'local-oslo-1',
    title: 'Oslo Campus Bylaws',
    description: 'Campus-specific regulations governing student activities, facility usage, and local procedures at BI Oslo.',
    category: 'local-laws',
    campus: 'Oslo',
    lastUpdated: 'April 2024',
    fileSize: '1.2 MB',
    downloadUrl: '#',
  },
  {
    id: 'local-bergen-1',
    title: 'Bergen Campus Bylaws',
    description: 'Campus-specific regulations governing student activities, facility usage, and local procedures at BI Bergen.',
    category: 'local-laws',
    campus: 'Bergen',
    lastUpdated: 'March 2024',
    fileSize: '1.1 MB',
    downloadUrl: '#',
  },
  {
    id: 'local-trondheim-1',
    title: 'Trondheim Campus Bylaws',
    description: 'Campus-specific regulations governing student activities, facility usage, and local procedures at BI Trondheim.',
    category: 'local-laws',
    campus: 'Trondheim',
    lastUpdated: 'March 2024',
    fileSize: '980 KB',
    downloadUrl: '#',
  },
  {
    id: 'local-stavanger-1',
    title: 'Stavanger Campus Bylaws',
    description: 'Campus-specific regulations governing student activities, facility usage, and local procedures at BI Stavanger.',
    category: 'local-laws',
    campus: 'Stavanger',
    lastUpdated: 'February 2024',
    fileSize: '950 KB',
    downloadUrl: '#',
  },
  
  // Code of Conduct
  {
    id: 'conduct-1',
    title: 'Student Code of Conduct',
    description: 'Expected behaviors and ethical standards for all BISO members, volunteers, and participants in student activities.',
    category: 'conduct',
    lastUpdated: 'January 2024',
    fileSize: '760 KB',
    downloadUrl: '#',
  },
  {
    id: 'conduct-2',
    title: 'Event Participation Guidelines',
    description: 'Standards and expectations for student behavior at BISO events, including inclusivity and safety protocols.',
    category: 'conduct',
    lastUpdated: 'March 2024',
    fileSize: '620 KB',
    downloadUrl: '#',
  },
  {
    id: 'conduct-3',
    title: 'Anti-Discrimination Policy',
    description: 'BISO\'s commitment to equality, diversity, and creating a safe, inclusive environment for all students.',
    category: 'conduct',
    lastUpdated: 'December 2023',
    fileSize: '580 KB',
    downloadUrl: '#',
  },
  
  // Business Regulations
  {
    id: 'business-1',
    title: 'Financial Regulations',
    description: 'Guidelines for financial management, budgeting, expenditures, and fiscal responsibility within BISO.',
    category: 'business',
    lastUpdated: 'April 2024',
    fileSize: '1.5 MB',
    downloadUrl: '#',
  },
  {
    id: 'business-2',
    title: 'Procurement Policy',
    description: 'Rules and procedures for purchasing goods and services on behalf of BISO, ensuring transparency and value.',
    category: 'business',
    lastUpdated: 'February 2024',
    fileSize: '840 KB',
    downloadUrl: '#',
  },
  {
    id: 'business-3',
    title: 'Partnership and Sponsorship Guidelines',
    description: 'Framework for establishing and maintaining partnerships with external organizations and sponsors.',
    category: 'business',
    lastUpdated: 'January 2024',
    fileSize: '920 KB',
    downloadUrl: '#',
  },
  
  // Communication Guidelines
  {
    id: 'comm-1',
    title: 'Brand Identity Guidelines',
    description: 'Official BISO visual identity standards including logo usage, colors, typography, and design principles.',
    category: 'communication',
    lastUpdated: 'March 2024',
    fileSize: '3.2 MB',
    downloadUrl: '#',
  },
  {
    id: 'comm-2',
    title: 'Social Media Policy',
    description: 'Guidelines for official BISO social media accounts, content creation, and community management.',
    category: 'communication',
    lastUpdated: 'April 2024',
    fileSize: '680 KB',
    downloadUrl: '#',
  },
  {
    id: 'comm-3',
    title: 'External Communication Standards',
    description: 'Protocols for communicating with media, partners, and external stakeholders on behalf of BISO.',
    category: 'communication',
    lastUpdated: 'February 2024',
    fileSize: '540 KB',
    downloadUrl: '#',
  },
];

const categories = [
  {
    id: 'statutes',
    name: 'National Statutes',
    description: 'Constitutional documents and bylaws applicable across all BISO campuses',
    icon: Scale,
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'local-laws',
    name: 'Campus Bylaws',
    description: 'Campus-specific regulations and local governance documents',
    icon: Building2,
    color: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'conduct',
    name: 'Code of Conduct',
    description: 'Ethical standards and behavioral expectations for all members',
    icon: Shield,
    color: 'from-indigo-500 to-purple-500',
  },
  {
    id: 'business',
    name: 'Business Regulations',
    description: 'Financial policies, procurement rules, and operational guidelines',
    icon: Briefcase,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'communication',
    name: 'Communication Guidelines',
    description: 'Brand standards and communication protocols',
    icon: MessageSquare,
    color: 'from-pink-500 to-cyan-500',
  },
];

export function PublicDocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.campus?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || doc.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryConfig = (categoryId: string) => 
    categories.find(c => c.id === categoryId);

  return (
    <div className="min-h-screen pt-20 pb-20 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#001731] via-[#002147] to-[#001731] -z-10" />
      
      {/* Floating Orbs */}
      <motion.div
        className="absolute top-20 right-20 w-96 h-96 bg-[#3DA9E0] rounded-full blur-[120px] opacity-20"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-40 left-20 w-80 h-80 bg-[#3DA9E0] rounded-full blur-[100px] opacity-15"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-[#3DA9E0]/30 mb-6">
            <FileText className="w-4 h-4 text-[#3DA9E0]" />
            <span className="text-[#3DA9E0] text-sm tracking-wide">OFFICIAL DOCUMENTATION</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            BISO Documents
          </h1>
          
          <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
            Access important organizational documents, bylaws, and guidelines that govern 
            the BI Student Organisation across all campuses.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-12"
        >
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-6 bg-white/5 backdrop-blur-md border-[#3DA9E0]/30 text-white placeholder:text-white/40 focus:border-[#3DA9E0] focus:ring-[#3DA9E0]/50 rounded-2xl"
            />
          </div>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-16"
        >
          <div className="flex flex-wrap gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(null)}
              className={`px-6 py-3 rounded-xl transition-all duration-300 ${
                selectedCategory === null
                  ? 'bg-gradient-to-r from-[#3DA9E0] to-[#2d8bc0] text-white shadow-lg shadow-[#3DA9E0]/50'
                  : 'bg-white/5 backdrop-blur-sm border border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              All Documents
            </motion.button>
            
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-6 py-3 rounded-xl transition-all duration-300 flex items-center gap-2 ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-[#3DA9E0] to-[#2d8bc0] text-white shadow-lg shadow-[#3DA9E0]/50'
                      : 'bg-white/5 backdrop-blur-sm border border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{category.name}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Documents Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="space-y-6"
        >
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/50 text-lg">No documents found matching your search.</p>
            </div>
          ) : (
            filteredDocuments.map((doc, index) => {
              const categoryConfig = getCategoryConfig(doc.category);
              const Icon = categoryConfig?.icon || FileText;
              
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  onHoverStart={() => setHoveredDoc(doc.id)}
                  onHoverEnd={() => setHoveredDoc(null)}
                  className="group relative"
                >
                  <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 overflow-hidden">
                    {/* Hover Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${categoryConfig?.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    
                    <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br ${categoryConfig?.color} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-white group-hover:text-[#3DA9E0] transition-colors duration-300">
                            {doc.title}
                          </h3>
                          {doc.campus && (
                            <Badge className="bg-[#3DA9E0]/20 text-[#3DA9E0] border-[#3DA9E0]/30">
                              <Building2 className="w-3 h-3 mr-1" />
                              {doc.campus}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-white/60 mb-3 leading-relaxed">
                          {doc.description}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-white/40">
                          <span className="flex items-center gap-1">
                            <Globe className="w-4 h-4" />
                            Updated {doc.lastUpdated}
                          </span>
                          <span>•</span>
                          <span>{doc.fileSize}</span>
                          <span>•</span>
                          <span className="capitalize">{categoryConfig?.name}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-[#3DA9E0]/50 transition-all duration-300 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">View</span>
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#3DA9E0] to-[#2d8bc0] text-white shadow-lg shadow-[#3DA9E0]/30 hover:shadow-[#3DA9E0]/50 transition-all duration-300 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </motion.button>
                      </div>
                    </div>
                    
                    {/* Animated Border */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${hoveredDoc === doc.id ? '#3DA9E0' : 'transparent'}, transparent)`,
                        opacity: hoveredDoc === doc.id ? 0.3 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 bg-gradient-to-r from-[#3DA9E0]/10 to-transparent backdrop-blur-md border border-[#3DA9E0]/30 rounded-2xl p-8"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#3DA9E0]/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-[#3DA9E0]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Document Updates
              </h3>
              <p className="text-white/60 leading-relaxed">
                These documents are regularly reviewed and updated to ensure they reflect current policies and regulations. 
                In the future, all documents will be synchronized directly from our SharePoint repository to ensure you always 
                have access to the latest versions.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
