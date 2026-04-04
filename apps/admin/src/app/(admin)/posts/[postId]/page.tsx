import { notFound } from "next/navigation";
import { getDepartments, getPost } from "@/app/actions/admin";
import { getCampuses } from "../actions";
import PostEditor from "../post-editor";

export default async function AdminPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  const departmentsPromise = getDepartments();
  const campusesPromise = getCampuses();
  const postPromise =
    postId === "new" ? Promise.resolve(null) : getPost(postId);

  const [departments, campuses, post] = await Promise.all([
    departmentsPromise,
    campusesPromise,
    postPromise,
  ]);

  if (postId !== "new" && !post) {
    notFound();
  }

  return (
    <PostEditor campuses={campuses} departments={departments} post={post} />
  );
}
