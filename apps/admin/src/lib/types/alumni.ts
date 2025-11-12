/**
 * TypeScript interfaces for Alumni Website data models with proper relationships
 */

import { Models } from '@repo/api';

// Base interface for all Appwrite documents
export interface AppwriteDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  $collectionId: string;
  $databaseId: string;
}

// ============================================================
// USER PROFILE INTERFACES
// ============================================================

export interface UserProfile extends AppwriteDocument {
  name: string;
  avatarUrl?: string;
  email: string;
  phone?: string;
  location?: string;
  title?: string;
  company?: string;
  graduationYear?: string;
  department?: string;
  degree?: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  profileCompletion?: number;
  userId: string;
  available?: boolean;
  
  // Relationship references (populated at runtime)
  experiences?: Experience[];
  education?: Education[];
  certifications?: Certification[];
  languages?: Language[];
  socialLinks?: SocialLink[];
  privacySettings?: PrivacySettings;
}

export interface Experience extends AppwriteDocument {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
  userId: string;
  
  // Relationship reference (populated at runtime)
  userProfile?: UserProfile;
}

export interface Education extends AppwriteDocument {
  degree: string;
  institution: string;
  location?: string;
  startYear: string;
  endYear: string;
  description?: string;
  fieldOfStudy?: string;
  userId: string;
  
  // Relationship reference (populated at runtime)
  userProfile?: UserProfile;
}

export interface Certification extends AppwriteDocument {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  description?: string;
  userId: string;
  
  // Relationship reference (populated at runtime)
  userProfile?: UserProfile;
}

export interface Language extends AppwriteDocument {
  language: string;
  proficiency: string;
  userId: string;
  
  // Relationship reference (populated at runtime)
  userProfile?: UserProfile;
}

export interface SocialLink extends AppwriteDocument {
  platform: string;
  url: string;
  userId: string;
  
  // Relationship reference (populated at runtime)
  userProfile?: UserProfile;
}

export interface PrivacySettings extends AppwriteDocument {
  profileVisibility: 'all_alumni' | 'connections' | 'limited';
  showEmail: boolean;
  showPhone: boolean;
  showSocial: boolean;
  showEducation: boolean;
  showWork: boolean;
  showLocation: boolean;
  allowMessages: boolean;
  allowConnections: boolean;
  allowMentoring: boolean;
  userId: string;
  
  // Relationship reference (populated at runtime)
  userProfile?: UserProfile;
}

// ============================================================
// TESTIMONIAL INTERFACE
// ============================================================

export interface Testimonial extends AppwriteDocument {
  name: string;
  role: string;
  graduationYear: string;
  quote: string;
  avatarUrl?: string;
  featured: boolean;
  userId?: string;
}

// ============================================================
// EVENT INTERFACES
// ============================================================

export interface Event extends AppwriteDocument {
  title: string;
  description: string;
  longDescription?: string; // More detailed description
  category: string;
  date: string; // ISO date string
  endDate?: string; // ISO date string
  location: string;
  address?: string; // Physical address details
  attendees: number;
  maxAttendees: number;
  online: boolean;
  registrationRequired: boolean;
  registrationDeadline: string; // ISO date string
  featured: boolean;
  image?: string;
  organizer: string;
  organizerContact?: string; // Organizer contact info
  price?: string; // Event price/cost
  schedule?: { time: string; activity: string }[]; // Event agenda
  speakers?: { name: string; title: string; bio: string; image?: string }[]; // Event speakers
  
  // Relationship references (populated at runtime)
  registrations?: EventRegistration[];
}

export interface EventRegistration extends AppwriteDocument {
  eventId: string;
  userId: string;
  status: 'registered' | 'attended' | 'canceled';
  registrationDate: string;
  
  // Relationship references (populated at runtime)
  event?: Event;
  user?: UserProfile;
}

// ============================================================
// JOB INTERFACES
// ============================================================

export interface Job extends AppwriteDocument {
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  type: string; // Full-time, Part-time, Contract, etc.
  workMode: string; // Remote, On-site, Hybrid
  salary?: string;
  experience: string;
  category: string;
  description: string;
  responsibilities: string[];
  qualifications: string[];
  postedDate: string; // ISO date string
  applicationDeadline: string; // ISO date string
  featured: boolean;
  alumni: boolean;
  
  // Relationship references (populated at runtime)
  applications?: JobApplication[];
}

export interface JobApplication extends AppwriteDocument {
  jobId: string;
  userId: string;
  status: 'applied' | 'reviewed' | 'interviewed' | 'offered' | 'rejected';
  applicationDate: string;
  resume?: string; // File ID or URL
  coverLetter?: string;
  
  // Relationship references (populated at runtime)
  job?: Job;
  user?: UserProfile;
}

// ============================================================
// MENTOR INTERFACES
// ============================================================

export interface Mentor extends AppwriteDocument {
  name: string;
  avatarUrl?: string;
  title: string;
  company: string;
  expertise: string[];
  industry: string;
  experience: number;
  education: string;
  location: string;
  availability: string;
  rating?: number;
  reviewCount?: number;
  bio: string;
  featured: boolean;
  graduationYear: string;
  languages?: string[];
  menteeCount?: number;
  maxMentees?: number;
  industries?: string[];
  meetingPreference?: string[];
  userId: string;
  available?: boolean;
  status: 'pending' | 'approved' | 'rejected'; // Status field for admin approval
  applicationDate: string; // Date when the application was submitted
  
  // Relationship references (populated at runtime)
  userProfile?: UserProfile;
  mentorships?: Mentorship[];
  reviews?: MentorReview[];
}

export interface Mentorship extends AppwriteDocument {
  mentorId: string;
  menteeId: string;
  status: 'requested' | 'active' | 'completed' | 'canceled';
  startDate?: string;
  endDate?: string;
  goals?: string;
  notes?: string;
  
  // Relationship references (populated at runtime)
  mentor?: Mentor;
  mentee?: UserProfile;
}

export interface MentorReview extends AppwriteDocument {
  mentorId: string;
  userId: string;
  rating: number;
  comment?: string;
  date: string;
  
  // Relationship references (populated at runtime)
  mentor?: Mentor;
  user?: UserProfile;
}

// ============================================================
// MESSAGING INTERFACES
// ============================================================

export interface Conversation extends AppwriteDocument {
  participants: string[]; // Array of user IDs
  unreadCount: number;
  lastMessageId?: string; // Reference to the last message
  
  // Relationship references (populated at runtime)
  messages?: Message[];
  lastMessage?: Message;
  participantProfiles?: UserProfile[]; // Populated UserProfile objects
}

export interface Message extends AppwriteDocument {
  content: string;
  sender: string; // User ID of sender
  read: boolean;
  conversationId: string; // Foreign key to Conversation
  
  // Relationship references (populated at runtime)
  conversation?: Conversation;
  senderProfile?: UserProfile;
}

// Enhanced conversation with participant details
export interface EnrichedConversation extends Omit<Conversation, 'participants'> {
  participants: UserProfile[];
  lastMessage?: Message;
}

// ============================================================
// RESOURCE INTERFACES
// ============================================================

export interface Resource extends AppwriteDocument {
  title: string;
  description: string;
  category: string;
  type: string; // Guide, Report, Webinar, etc.
  format: string; // PDF, Video, Audio, etc.
  author: string;
  publishedDate: string;
  fileSize?: string;
  duration?: string;
  thumbnail?: string;
  featured: boolean;
  downloadUrl?: string;
  watchUrl?: string;
  listenUrl?: string;
  tags?: string[];
  
  // Relationship references (populated at runtime)
  downloads?: ResourceDownload[];
}

export interface ResourceDownload extends AppwriteDocument {
  resourceId: string;
  userId: string;
  downloadDate: string;
  
  // Relationship references (populated at runtime)
  resource?: Resource;
  user?: UserProfile;
}

// ============================================================
// AUTH INTERFACES
// ============================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface PasswordResetData {
  userId: string;
  secret: string;
  password: string;
}

// Add this to your appwrite-models.ts file

// ============================================================
// MENTORING PROGRAM INTERFACES
// ============================================================

export interface MentoringProgram extends AppwriteDocument {
  title: string;
  description: string;
  category: string;
  duration: string;
  commitment: string;
  startDate: string;
  applicationDeadline: string;
  spots: number;
  spotsRemaining: number;
  featured: boolean;
  image?: string;
}

export interface ProgramApplication extends AppwriteDocument {
  programId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  applicationDate: string;
  motivationStatement?: string;
  
  // Relationship references (populated at runtime)
  program?: MentoringProgram;
  user?: UserProfile;
}

// ============================================================
// NEWS INTERFACE
// ============================================================

export interface NewsItem extends AppwriteDocument {
  title: string;
  summary: string;
  content: string;
  date: string; // ISO date string
  author: string;
  category?: string;
  image: string;
  tags?: string[];
  featured: boolean;
  views?: number;
}