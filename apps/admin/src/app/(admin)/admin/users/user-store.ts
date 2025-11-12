import { create } from 'zustand'
import { User } from '@/lib/types/user'

interface UserTableState {
  users: User[]
  filteredUsers: User[]
  searchTerm: string
  filterRole: string
  currentPage: number
  totalPages: number
  usersPerPage: number
  selectedUsers: string[]
  sortField: keyof User | null
  sortDirection: 'asc' | 'desc'
  isLoading: boolean
  
  // Actions
  setUsers: (users: User[]) => void
  setSearchTerm: (term: string) => void
  setFilterRole: (role: string) => void
  setCurrentPage: (page: number) => void
  toggleUserSelection: (userId: string) => void
  selectAllUsers: (select: boolean) => void
  setSorting: (field: keyof User | null, direction: 'asc' | 'desc') => void
  setIsLoading: (loading: boolean) => void
}

export const useUserStore = create<UserTableState>((set) => ({
  users: [],
  filteredUsers: [],
  searchTerm: '',
  filterRole: 'all',
  currentPage: 1,
  totalPages: 1,
  usersPerPage: 10,
  selectedUsers: [],
  sortField: null,
  sortDirection: 'asc',
  isLoading: false,
  
  setUsers: (users) => {
    set((state) => {
      const filtered = filterUsers(users, state.searchTerm, state.filterRole)
      const sortedUsers = state.sortField 
        ? sortUsers(filtered, state.sortField, state.sortDirection) 
        : filtered
      
      return {
        users,
        filteredUsers: sortedUsers,
        totalPages: Math.ceil(sortedUsers.length / state.usersPerPage),
        currentPage: 1,
      }
    })
  },
  
  setSearchTerm: (term) => {
    set((state) => {
      const filtered = filterUsers(state.users, term, state.filterRole)
      const sortedUsers = state.sortField 
        ? sortUsers(filtered, state.sortField, state.sortDirection) 
        : filtered
      
      return {
        searchTerm: term,
        filteredUsers: sortedUsers,
        totalPages: Math.ceil(sortedUsers.length / state.usersPerPage),
        currentPage: 1,
      }
    })
  },
  
  setFilterRole: (role) => {
    set((state) => {
      const filtered = filterUsers(state.users, state.searchTerm, role)
      const sortedUsers = state.sortField 
        ? sortUsers(filtered, state.sortField, state.sortDirection) 
        : filtered
      
      return {
        filterRole: role,
        filteredUsers: sortedUsers,
        totalPages: Math.ceil(sortedUsers.length / state.usersPerPage),
        currentPage: 1,
      }
    })
  },
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  toggleUserSelection: (userId) => {
    set((state) => {
      const isSelected = state.selectedUsers.includes(userId)
      const selectedUsers = isSelected
        ? state.selectedUsers.filter(id => id !== userId)
        : [...state.selectedUsers, userId]
      
      return { selectedUsers }
    })
  },
  
  selectAllUsers: (select) => {
    set((state) => {
      const selectedUsers = select 
        ? state.filteredUsers.map(user => user.$id) 
        : []
      
      return { selectedUsers }
    })
  },
  
  setSorting: (field, direction) => {
    set((state) => {
      const sortedUsers = field 
        ? sortUsers(state.filteredUsers, field, direction) 
        : state.filteredUsers
      
      return {
        sortField: field,
        sortDirection: direction,
        filteredUsers: sortedUsers,
      }
    })
  },
  
  setIsLoading: (loading) => set({ isLoading: loading }),
}))

// Helper functions
function filterUsers(users: User[], searchTerm: string, filterRole: string): User[] {
  return users.filter(
    (user) =>
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterRole === 'all' || user.roles.includes(filterRole))
  )
}

function sortUsers(users: User[], field: keyof User, direction: 'asc' | 'desc'): User[] {
  return [...users].sort((a, b) => {
    let aValue = a[field]
    let bValue = b[field]
    
    // Handle special cases
    if (field === 'roles') {
      aValue = a.roles.join(', ')
      bValue = b.roles.join(', ')
    } else if (field === 'campus') {
      aValue = a.campus?.name || ''
      bValue = b.campus?.name || ''
    }
    
    if (aValue === bValue) return 0
    
    const result = aValue < bValue ? -1 : 1
    return direction === 'asc' ? result : -result
  })
} 