import { flag, dedupe } from 'flags/next';
import { cookies } from 'next/headers';
import { createSessionClient } from './appwrite';

interface Entities {
  user?: { 
    id: string;
    $id: string;
    roles?: string[];
    teams?: string[];
  };
}

// Fetch feature flags from Appwrite
const fetchFeatureFlags = async () => {
  try {
    const client = await createSessionClient();
    // Assuming you have a collection for feature flags in your database
    const response = await client.db.listRows(
      'app', // Your database ID
      'feature_flags' // Collection ID for feature flags
    );
    
    return response.rows.reduce((acc, flag) => {
      acc[flag.key] = flag.enabled;
      return acc;
    }, {} as Record<string, boolean>);
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return {};
  }
};

// Cache the flags to avoid making too many requests
let flagsCache: Record<string, boolean> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getFeatureFlags = async () => {
  // Disable caching entirely to ensure we always get fresh flags
  flagsCache = null;
  
  const now = Date.now();
  if (!flagsCache || now - lastFetchTime > CACHE_TTL) {
    flagsCache = await fetchFeatureFlags();
    lastFetchTime = now;
  }
  return flagsCache;
};

// Helper function to check if user is a member of a specific team
async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  try {
    const client = await createSessionClient();
    // Check if the user is a member of the team
    const memberships = await client.teams.listMemberships(teamId);
    return memberships.memberships.some(membership => membership.userId === userId);
  } catch (error) {
    console.error(`Error checking team membership for user ${userId} in team ${teamId}:`, error);
    return false;
  }
}

// Identity function to establish evaluation context
const identify = dedupe(
  async (): Promise<Entities> => {
    try {
      const client = await createSessionClient();
      const account = await client.account.get();
      
      // Get teams the user belongs to
      const userId = account.$id;
      
      // Check for admin team membership
      const isAdmin = await isTeamMember(userId, 'alumni_admins');
      
      return { 
        user: { 
          id: userId,
          $id: userId,
          roles: account.labels || [],
          teams: isAdmin ? ['alumni_admins'] : [] // We only care about the admin team for now
        } 
      };
    } catch (error) {
      return { user: undefined };
    }
  }
);

// Define feature flags for various alumni features
export const networksFeatureFlag = flag<boolean, Entities>({
  key: 'alumni-network',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    // Check if the flag exists in Appwrite
    if (flags && 'alumni-network' in flags) {
      return flags['alumni-network'];
    }
    
    // Fallback logic if the flag doesn't exist in Appwrite
    if (!entities?.user) return false;
    
    // You can implement role-based flags
    return entities.user.roles?.includes('alumni') || false;
  }
});

export const eventsFeatureFlag = flag<boolean, Entities>({
  key: 'alumni-events',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    if (flags && 'alumni-events' in flags) {
      return flags['alumni-events'];
    }
    
    if (!entities?.user) return false;
    return entities.user.roles?.includes('alumni') || false;
  }
});

export const mentoringFeatureFlag = flag<boolean, Entities>({
  key: 'alumni-mentoring',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    if (flags && 'alumni-mentoring' in flags) {
      return flags['alumni-mentoring'];
    }
    
    if (!entities?.user) return false;
    return entities.user.roles?.includes('alumni') || false;
  }
});

export const jobsFeatureFlag = flag<boolean, Entities>({
  key: 'alumni-jobs',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    if (flags && 'alumni-jobs' in flags) {
      return flags['alumni-jobs'];
    }
    
    if (!entities?.user) return false;
    return entities.user.roles?.includes('alumni') || false;
  }
});

export const resourcesFeatureFlag = flag<boolean, Entities>({
  key: 'alumni-resources',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    if (flags && 'alumni-resources' in flags) {
      return flags['alumni-resources'];
    }
    
    if (!entities?.user) return false;
    return entities.user.roles?.includes('alumni') || false;
  }
});

export const messagesFeatureFlag = flag<boolean, Entities>({
  key: 'alumni-messages',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    if (flags && 'alumni-messages' in flags) {
      return flags['alumni-messages'];
    }
    
    if (!entities?.user) return false;
    return entities.user.roles?.includes('alumni') || false;
  }
});

export const adminFeatureFlag = flag<boolean, Entities>({
  key: 'alumni-admin',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    if (flags && 'alumni-admin' in flags) {
      return flags['alumni-admin'];
    }
    
    if (!entities?.user) return false;
    
    // Directly check team membership
    try {
      const client = await createSessionClient();
      const userId = entities.user.id;
      
      // List the user's team memberships
      const teamMemberships = await client.teams.listMemberships('alumni_admins');
      
      // Check if the user is a member of the alumni_admins team
      return teamMemberships.memberships.some(membership => membership.userId === userId);
    } catch (error) {
      console.error('Error checking admin team membership:', error);
      return false;
    }
  }
});

export const autoAcceptMentorsFlag = flag<boolean, Entities>({
  key: 'alumni-auto-accept-mentors',
  identify,
  async decide({ entities }) {
    const flags = await getFeatureFlags();
    
    if (flags && 'alumni-auto-accept-mentors' in flags) {
      return flags['alumni-auto-accept-mentors'];
    }
    
    // Default to false - don't auto-accept mentors by default for safety
    return false;
  }
}); 