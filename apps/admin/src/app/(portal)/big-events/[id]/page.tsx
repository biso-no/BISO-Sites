import { redirect } from "next/navigation";

interface BigEventPageProps {
  params: Promise<{ id: string }>;
}

export default async function BigEventPage({ params }: BigEventPageProps) {
  const { id } = await params;
  redirect(`/big-events/${id}/participants`);
}
