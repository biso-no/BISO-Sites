import { IVectorStore } from './vector-store.types';
import { PineconeVectorStore } from './pinecone';

let instance: IVectorStore | null = null;

export async function getVectorStore(): Promise<IVectorStore> {
	if (instance) return instance;

	// Create Pinecone instance - the recommended vector store for Vercel deployments
	instance = new PineconeVectorStore();
	await instance.initialize();
	
	return instance;
}