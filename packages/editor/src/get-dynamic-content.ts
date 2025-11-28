"use server";

export type DynamicContentItem = {
  title: string;
  subtitle?: string;
  image?: string;
  href?: string;
  value?: string;
  label?: string;
};

export async function getDynamicContent(
  source: { table?: string; filters?: any[]; operation?: string; limit?: number }
): Promise<DynamicContentItem[]> {
  // In a real app, this would query Appwrite using the table and filters
  // For now, we return mock data based on the table name
  
  if (!source?.table) return [];

  const table = source.table;

  if (table === "events") {
    return [
      {
        title: "Annual Gala 2025",
        subtitle: "Join us for an evening of celebration.",
        image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80",
        href: "/events/gala-2025",
        value: "25",
        label: "Events This Month"
      },
      {
        title: "Tech Summit",
        subtitle: "The future of technology is here.",
        image: "https://images.unsplash.com/photo-1540575467063-178a50935339?w=800&q=80",
        href: "/events/tech-summit",
        value: "12",
        label: "Speakers"
      },
      {
        title: "Summer Workshop",
        subtitle: "Learn new skills in the sun.",
        image: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&q=80",
        href: "/events/workshop",
        value: "50+",
        label: "Attendees"
      }
    ];
  }

  if (table === "news") {
    return [
      {
        title: "New Partnership Announced",
        subtitle: "We are thrilled to partner with...",
        image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80",
        href: "/news/partnership",
        value: "Latest",
        label: "Breaking News"
      },
      {
        title: "Quarterly Report",
        subtitle: "Growth exceeds expectations.",
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
        href: "/news/report",
        value: "Q3",
        label: "Financials"
      }
    ];
  }
  
  if (table === "jobs") {
     return [
         { title: "Frontend Developer", subtitle: "Remote - Full Time", href: "/jobs/frontend", label: "Open Position" },
         { title: "Product Manager", subtitle: "Oslo - Hybrid", href: "/jobs/pm", label: "Open Position" }
     ];
  }

  return [];
}
