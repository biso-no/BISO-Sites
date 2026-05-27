import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; applicationId: string }>;
}

// The standalone application detail page has been replaced by the candidate
// drawer inside the recruitment workspace. Preserve old links by redirecting
// into the workspace with the candidate drawer deep-linked open.
export default async function ApplicationDetailRedirect({ params }: PageProps) {
  const { id, applicationId } = await params;
  redirect(`/jobs/${id}/applications?candidate=${applicationId}`);
}
