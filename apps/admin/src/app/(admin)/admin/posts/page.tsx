import { PostTable } from "./posts-table";
import { getPosts } from "@/app/actions/admin";



export default async function AdminPostsPage() {
  const posts = await getPosts()


  return (
    <PostTable posts={posts} />
  )
}