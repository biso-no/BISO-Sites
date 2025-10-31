import { openai } from "@ai-sdk/openai"
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai"
import { frontendTools } from "@assistant-ui/react-ai-sdk"
import { z } from "zod"
import { createProduct, updateProductStatus } from "@/app/actions/products"
import { createEvent, updateEvent } from "@/app/actions/events"
import { createJob, updateJob } from "@/app/actions/jobs"

export const maxDuration = 50

export async function POST(req: Request) {
  const { messages, tools: clientTools }: { messages: UIMessage[]; tools?: any } = await req.json()

  const result = streamText({
    model: openai("gpt-4o"),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(12),
    tools: {
      ...(clientTools ? frontendTools(clientTools) : {}),
      create_product_from_fields: tool({
        description: "Create a webshop product directly from structured fields.",
        inputSchema: z.object({
          description: z.string(),
          slug: z.string(),
          url: z.string().optional(),
          type: z.string().default("simple"),
          status: z.string().default("draft"),
          campus_id: z.string().optional(),
          department_id: z.string().optional(),
          images: z.array(z.string()).default([]),
          price: z.number().default(0),
          sale_price: z.number().optional(),
          manage_stock: z.boolean().default(false),
          sold_individually: z.boolean().default(false),
          featured: z.boolean().default(false),
          on_sale: z.boolean().default(false),
          tags: z.array(z.string()).default([]),
        }),
        execute: async (args) => {
          const form = new FormData()
          Object.entries(args).forEach(([k, v]) => {
            if (Array.isArray(v)) form.append(k, v.join(","))
            else form.append(k, String(v ?? ""))
          })
          const res = await createProduct(form)
          return { id: (res as any).$id, slug: (res as any).slug }
        },
      }),
      update_product_status: tool({
        description: "Update a product's status",
        inputSchema: z.object({ productId: z.string(), status: z.enum(["draft", "published", "archived"]) }),
        execute: async ({ productId, status }) => {
          const res = await updateProductStatus(productId, status as any)
          return res
        },
      }),
      create_event: tool({
        description: "Create an event",
        inputSchema: z.object({
          title: z.string(),
          description: z.string().optional(),
          start_date: z.string().optional(),
          end_date: z.string().optional(),
          campus: z.string().optional(),
          status: z.string().default("draft"),
          ticket_url: z.string().url().optional(),
          image: z.string().optional(),
        }),
        execute: async (data) => {
          const res = await createEvent(data as any)
          return { id: (res as any).$id, title: (res as any).title }
        },
      }),
      update_event: tool({
        description: "Update an event",
        inputSchema: z.object({ eventId: z.string(), patch: z.record(z.any()) }),
        execute: async ({ eventId, patch }) => {
          const res = await updateEvent(eventId, patch as any)
          return { id: (res as any).$id }
        },
      }),
      create_job: tool({
        description: "Create a job",
        inputSchema: z.object({
          title: z.string(),
          slug: z.string().optional(),
          campus: z.string(),
          department_id: z.string(),
          status: z.string().default("open"),
          type: z.string(),
          duration_months: z.number(),
          description: z.string(),
          apply_url: z.string().url().optional(),
          image: z.string().optional(),
        }),
        execute: async (data) => {
          const res = await createJob(data as any)
          return { id: (res as any).$id, title: (res as any).title }
        },
      }),
      update_job: tool({
        description: "Update a job",
        inputSchema: z.object({ id: z.string(), patch: z.record(z.any()) }),
        execute: async ({ id, patch }) => {
          const res = await updateJob(id, patch as any)
          return { id: (res as any).$id }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}


