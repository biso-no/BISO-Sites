"use server"
import { createSessionClient } from "@repo/api/server"
import { Campus } from "@repo/api/types/appwrite"
import { Query } from "@repo/api"

interface GetCampusesParams {
    departments?: {
        include?: boolean
        fieldsToInclude?: string[]
        filters?: {
            active?: boolean
            type?: string
            search?: string
        }
    },
    sortOrder?: string
    sortField?: string
    limit?: number
    offset?: number
}

export async function getCampuses({ departments, sortOrder, sortField, limit, offset }: GetCampusesParams = {}) {
    const { db } = await createSessionClient()

    const query: string[] = [
        Query.select(['name', '$id'])
    ]

    if (departments?.include) {
        const fields = departments.fieldsToInclude || ['departments.$id', 'departments.Name', 'departments.active', 'departments.type', 'departments.logo', 'departments.description', 'departments.campus_id']
        query.push(Query.select(fields))
        
        // Apply department filters
        if (departments.filters) {
            if (departments.filters.active !== undefined) {
                query.push(Query.equal('departments.active', departments.filters.active))
            }
            if (departments.filters.type && departments.filters.type !== 'all') {
                query.push(Query.equal('departments.type', departments.filters.type))
            }
            if (departments.filters.search) {
                query.push(Query.search('departments.Name', departments.filters.search))
            }
        }
    }

    // Sorting - only sort by campus fields, not department fields (Appwrite limitation)
    if (sortOrder && sortField && !sortField.startsWith('departments.')) {
        const isDesc = sortOrder === 'desc'
        query.push(isDesc ? Query.orderDesc(sortField) : Query.orderAsc(sortField))
    } else {
        // Default sort by campus name
        query.push(Query.orderAsc('name'))
    }

    if (limit) {
        query.push(Query.limit(limit))
    }

    if (offset) {
        query.push(Query.offset(offset))
    }

    const response = await db.listRows<Campus>('app', 'campus', query)
    return response.rows
}