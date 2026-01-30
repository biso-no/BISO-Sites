import { UserCreateForm } from "../components/user-create-form";

export default function CreateUserPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-bold text-2xl">Create New User</h1>
        <p className="text-muted-foreground">
          Provision a new M365 user and assign them to a campus and department.
        </p>
      </div>
      <UserCreateForm />
    </div>
  );
}
