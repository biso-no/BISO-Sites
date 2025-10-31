import type { MetadataRoute } from 'next'
import { listNews } from '@/app/actions/news'
import { listEvents } from '@/app/actions/events'
import { listJobs } from '@/app/actions/jobs'
import { listLargeEvents } from '@/app/actions/large-events'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://biso.no'

  const staticPaths: MetadataRoute.Sitemap = [
    '',
    '/about',
    '/campus',
    '/students',
    '/membership',
    '/partner',
    '/projects',
    '/news',
    '/events',
    '/jobs',
    '/shop',
    '/privacy',
    '/cookies',
    '/terms',
    '/policies/drugs-policy',
    '/contact',
  ].map((p) => ({ url: `${base}${p || '/'}` }))

  const [news, events, jobs, projects] = await Promise.all([
    listNews({ limit: 200, status: 'published' }),
    listEvents({ limit: 200, status: 'published' }),
    listJobs({ limit: 200, status: 'published' }),
    listLargeEvents({ activeOnly: false, limit: 100 }),
  ])

  const dynamicPaths: MetadataRoute.Sitemap = [
    ...news.map((n) => ({ url: `${base}/news/${(n as any).$id}`, lastModified: new Date(n.$updatedAt || n.$createdAt) })),
    ...events.map((e) => ({ url: `${base}/events/${(e as any).$id}`, lastModified: new Date(e.$updatedAt || e.$createdAt) })),
    ...jobs.map((j) => ({ url: `${base}/jobs/${(j as any).slug || (j as any).$id}`, lastModified: new Date(j.$updatedAt || j.$createdAt) })),
    ...projects.map((p) => ({ url: `${base}/projects/${p.slug}`, lastModified: p.$updatedAt ? new Date(p.$updatedAt) : undefined })),
  ]

  return [...staticPaths, ...dynamicPaths]
}

