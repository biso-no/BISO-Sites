import { Models } from "@repo/api";
import {Campus} from "./campus"


export interface User extends Models.Row {
    email: string
    name: string
    campus: Campus
    isActive: boolean
    roles: string[]
}