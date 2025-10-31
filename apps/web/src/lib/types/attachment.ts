
import { Models } from "@repo/api/server";
export interface Attachment extends Models.Row {
    amount: number;
    date: Date;
    description: string;
    image: File | null;
    url: string
    $id: string
}