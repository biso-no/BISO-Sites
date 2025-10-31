import { Models } from "@repo/api/server";

export interface Department extends Models.Row{
    Name:string
}

export interface Campus extends Models.Row{
    name:string
}

export interface Post extends Models.Row{
    title: string;
    url: string;
    content: string;
    status: string;
    image:string;
    department: Department;
    campus_id: Campus
}