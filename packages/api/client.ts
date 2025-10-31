import { Client, Account, ID, Databases, Storage, Functions } from "appwrite";

const APPWRITE_PROJECT = "biso";
const NEXT_PUBLIC_APPWRITE_ENDPOINT = "https://appwrite.biso.no/v1";

export const clientSideClient = new Client()
        .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT)


export const clientDatabase = new Databases(clientSideClient);
export const clientStorage = new Storage(clientSideClient);
export const clientAccount = new Account(clientSideClient);
export const clientFunctions = new Functions(clientSideClient);