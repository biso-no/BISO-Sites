import type { News } from "@repo/api/types/appwrite";
import { notFound } from "next/navigation";
import { getDepartments, getPost, getPosts } from "@/app/actions/admin";
import { getCampuses } from "../actions";
import PostEditor from "../post-editor";

export default async function AdminPostPage({
  params,
}: {
  params: { postId: string };
}) {
  const _posts = await getPosts();

  const departments = await getDepartments();

  const campuses = await getCampuses();

  let post: News | null = null;
  if (params.postId !== "new") {
    post = await getPost(params.postId);
    if (!post) {
      notFound();
    }
  }

  console.log("POST: ", JSON.stringify(post));

  return (
    <PostEditor campuses={campuses} departments={departments} post={post} />
  );
}
