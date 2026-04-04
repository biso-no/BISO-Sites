import { getDepartments } from "@/app/actions/admin";
import { getCampuses } from "../actions";
import PostEditor from "../post-editor";

export default async function NewPostPage() {
  const [departments, campuses] = await Promise.all([
    getDepartments(),
    getCampuses(),
  ]);

  return <PostEditor campuses={campuses} departments={departments} />;
}
