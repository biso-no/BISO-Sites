import type { Models } from "@repo/api/server";

export type VotingItemType = 'statute' | 'position'

export interface Election extends Models.Row {
    description: string
    date: string;
    campus: string;
    name: string;
    status: 'upcoming' | 'ongoing' | 'past';
    sessions: ElectionSession[];
    electionUsers: Voter[];
  }
  
  export interface ElectionSession extends Models.Row {
    electionId: string
    name: string
    description: string
    startTime: string
    endTime: string
    status: 'upcoming' | 'ongoing' | 'past';
    votingItems: VotingItem[]
    election: Election
    electionVotes: Vote
  }
  
  export interface VotingItem extends Models.Row {
    votingSessionId: string
    title: string
    type: VotingItemType
    allowAbstain: boolean
    votingOptions: VotingOption[]
    session: ElectionSession
    maxSelections: number
  }
  
  export interface VotingOption extends Models.Row {
    votingItemId: string
    value: string
    description: string
    votingItem: VotingItem
  }
  
  export interface Voter extends Models.Row {
    electionId: string
    name: string
    email: string
    voter_id: string
  }
  export interface Vote extends Models.Row {
    optionId: string
    voterId: string
    electionid: string
    votingSessionId: string
    votingItemId: string
  }
  
  export interface DetailedVoteResult {
      votingItemId: string
      optionId: string
      voteCount: number
    }
    
    export interface VoterParticipation {
      electionId: string
      totalVoters: number
      participatedVoters: number
    }

export interface NonVoter {
  voterId: string;
  name: string;
  email: string
}