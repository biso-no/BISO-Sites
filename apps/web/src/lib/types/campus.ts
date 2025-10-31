import { User } from "./user";
import { Models } from "@repo/api/server";
export type Campus = Models.Document & {
    name: string
    users: User[]
}