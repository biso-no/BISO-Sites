import { Models } from "@repo/api";
import { Campus } from "./campus";
export interface Department extends Models.Row {
    Name: string,
    campus: Campus
}
