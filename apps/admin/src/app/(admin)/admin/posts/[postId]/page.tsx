import { notFound } from "next/navigation"
import { getPost, getPosts } from "@/app/actions/admin"
import PostEditor from "../post-editor"
import { getDepartments } from "@/app/actions/admin"
import { getCampuses } from "../actions"

export default async function AdminPostPage({ params }: { params: { postId: string } }) {
  const posts = await getPosts()
  
  const departments = await getDepartments()

  const campuses = await getCampuses();

  let post = null
  if (params.postId !== "new") {
    post = await getPost(params.postId)
    if (!post) {
      notFound()
    }
  }

  console.log("POST: ", JSON.stringify(post))

  return (
    <PostEditor
      post={post}
      departments={departments}
      campuses={campuses}
    />
  )
}