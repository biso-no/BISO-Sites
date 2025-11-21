"use client";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  DeleteIcon,
  Edit,
  Grid,
  List,
  PlusCircle,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { deletePost } from "@/app/actions/admin";
import type { Campus, Department, Post } from "@/lib/types/post";

const getUniqueDepartments = (posts: Post[]): Department[] => {
  const uniqueMap = new Map<string, Department>();

  posts.forEach((post) => {
    const department = post.department;

    // Check if the department has a valid 'id' and add to the map if it's not already present
    if (department?.Name && !uniqueMap.has(department.Name)) {
      uniqueMap.set(department.Name, department);
    }
  });

  return Array.from(uniqueMap.values());
};

const getUniqueCampuses = (posts: Post[]): Campus[] => {
  const uniqueMap = new Map<string, Campus>();

  posts.forEach((post) => {
    const campus = post.campus;

    // Check if the department has a valid 'id' and add to the map if it's not already present
    if (campus?.name && !uniqueMap.has(campus.name)) {
      uniqueMap.set(campus.name, campus);
    }
  });

  return Array.from(uniqueMap.values());
};

export function PostTable({ posts }: { posts: Post[] }) {
  const t = useTranslations("adminPosts");
  const [uniqueCampuses, setUniqueCampuses] = useState<Campus[]>([]);
  const [uniqueDepartments, setUniqueDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [viewType, setViewType] = useState<"list" | "grid">("list");

  //search filters
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [campus, setCampus] = useState("all");

  //form
  const [formData, setFormData] = useState({
    search: "",
    campus: "all",
    department: "all",
  });

  const router = useRouter();

  // Extract unique campuses and departments when the component loads
  useEffect(() => {
    const uniqueDepartments = getUniqueDepartments(posts);
    const uniqueCampuses = getUniqueCampuses(posts);
    setUniqueCampuses(uniqueCampuses);
    setUniqueDepartments(uniqueDepartments);
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          (search === "" ||
            post.title.toLowerCase().includes(search.toLowerCase())) &&
          (department === "Department" ||
            department === "all" ||
            post.department.Name === department) &&
          (campus === "Campus" ||
            campus === "all" ||
            post.campus.name === campus)
      ),
    [posts, search, department, campus]
  );

  // dummy comment
  //pagination
  const paginatedPosts = useMemo(() => {
    const startIndex = (page - 1) * 3;
    return filteredPosts.slice(startIndex, startIndex + 3);
  }, [filteredPosts, page]);
  const totalPages = Math.ceil(filteredPosts.length / 3);

  //for the form for filter and view electin
  const handleChange = (eOrField) => {
    if (typeof eOrField === "string") {
      // This is for the Select components
      return (value) => {
        setFormData({
          ...formData,
          [eOrField]: value,
        });
      };
    }
    // This is for the Input fields
    const { name, value } = eOrField.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(formData.search);
    setCampus(formData.campus);
    setDepartment(formData.department);
    setPage(1); // Reset to first page when searching
  };

  //list view gried view
  const toggleViewType = () => {
    setViewType(viewType === "list" ? "grid" : "list");
  };

  const handleRowClick = (postId: string) => {
    router.push(`/admin/posts/${postId}`);
  };
  const _handleRowCreate = () => {
    router.push("/admin/posts/createPost");
  };
  const handleRowDelete = (postId: string) => {
    deletePost(postId);
    router.refresh();
  };

  const getStatusLabel = (status: Post["status"]) => {
    switch (status) {
      case "publish":
        return t("status.published");
      case "draft":
        return t("status.draft");
      default:
        return status;
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="mb-5 font-bold text-2xl">{t("title")}</h1>
      <div className="container mx-auto py-10">
        <h1 className="mb-5 font-bold text-2xl">{t("title")}</h1>

        <form className="mb-5 flex gap-4" onSubmit={handleSearch}>
          <Input
            className="grow"
            name="search"
            onChange={handleChange}
            placeholder={t("search")}
            type="text"
            value={formData.search}
          />
          <Select
            name="department"
            onValueChange={handleChange("department")}
            value={formData.department}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("filters.allDepartments")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allDepartments")}</SelectItem>
              {uniqueDepartments.map((dep: Department) => (
                <SelectItem key={dep.Name} value={dep.Name}>
                  {dep.Name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            name="campus"
            onValueChange={handleChange("campus")}
            value={formData.campus}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("filters.allCampuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allCampuses")}</SelectItem>
              {uniqueCampuses.map((camp: Campus) => (
                <SelectItem key={camp.name} value={camp.name}>
                  {camp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="submit">
            <Search className="mr-2 h-4 w-4" />
            {t("search")}
          </Button>

          <Button onClick={toggleViewType} type="button" variant="outline">
            {viewType === "list" ? (
              <Grid className="mr-2 h-4 w-4" />
            ) : (
              <List className="mr-2 h-4 w-4" />
            )}
            {viewType === "list" ? t("view.grid") : t("view.list")}
          </Button>
        </form>
        <Button
          className="w-full"
          onClick={() => router.push("/admin/posts/new")}
        >
          <PlusCircle />
          {t("create")}
        </Button>

        {viewType === "list" ? (
          // list view
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.title")}</TableHead>
                <TableHead>{t("table.department")}</TableHead>
                <TableHead>{t("table.campus")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.createdAt")}</TableHead>
                <TableHead>{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.map((post: Post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    {post.isSticky ? "📌 " : ""}
                    {post.title}
                  </TableCell>
                  <TableCell>{post.department?.Name}</TableCell>
                  <TableCell>{post.campus?.name}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        post.status === "publish"
                          ? "bg-green-200 text-green-800"
                          : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {getStatusLabel(post.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {format(new Date(post.$createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-between">
                      <Button onClick={() => handleRowClick(post.$id)}>
                        <Edit /> {t("edit")}
                      </Button>
                      <Button onClick={() => handleRowDelete(post.$id)}>
                        <DeleteIcon /> {t("delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          //grid view
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedPosts.map((post: Post) => (
              <Card key={post.id}>
                <CardHeader>
                  <CardTitle>
                    {post.isSticky ? "📌 " : ""}
                    {post.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Image
                    alt={t("imageAlt")}
                    height={400}
                    src={post.image}
                    width={300}
                  />
                  <p>
                    <strong>{t("table.department")}:</strong>{" "}
                    {post.department.Name}
                  </p>
                  <p>
                    <strong>{t("table.campus")}:</strong> {post.campus.name}
                  </p>
                  <p>
                    <strong>{t("table.status")}:</strong>
                    <span
                      className={`ml-2 rounded-full px-2 py-1 text-xs ${
                        post.status === "publish"
                          ? "bg-green-200 text-green-800"
                          : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {getStatusLabel(post.status)}
                    </span>
                  </p>
                  <p>
                    <strong>{t("table.createdAt")}:</strong>{" "}
                    {format(new Date(post.$createdAt), "MMM d, yyyy")}
                  </p>
                </CardContent>
                <CardFooter>
                  <Link
                    className="text-blue-600 hover:underline"
                    href={`/posts/${post.id}`}
                  >
                    {t("table.viewEdit")}
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/*Pagination*/}
        <div className="mt-4 flex items-center justify-between">
          <Button
            disabled={page === 1}
            onClick={() => setPage((old) => Math.max(old - 1, 1))}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t("pagination.previous")}
          </Button>
          <span>{t("pagination.label", { page, total: totalPages })}</span>
          <Button
            disabled={page === totalPages}
            onClick={() => setPage((old) => (old < totalPages ? old + 1 : old))}
          >
            {t("pagination.next")}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
