import { getPosts } from "@/app/actions/admin";
import { PostTable } from "./posts-table";

export default async function AdminPostsPage() {
  const posts = await getPosts();

  return <PostTable posts={posts} />;
}
