import { User } from "./user";
import { Models } from "@repo/api";
export type Campus = Models.Document & {
    name: string
    users: User[]
}