/**
 * 24SevenOffice Products Service
 *
 * Fetches products from the 24SO Logistics/Product API.
 * Used to sync membership products to Appwrite.
 */

import { createAuthenticatedClient } from "./client";
import { getValidSession } from "./auth";
import type { Product, GetProductsResult } from "./types";

/**
 * Get all products from 24SevenOffice
 */
export async function getProducts(): Promise<Product[]> {
    const session = await getValidSession();
    const client = await createAuthenticatedClient("product", session);

    try {
        const [result]: [GetProductsResult] = await client.GetProductsAsync({
            searchParams: {},
            returnProperties: {
                string: ["Id", "Name", "No", "Price", "Description", "CategoryId"],
            },
        });

        const products = result.GetProductsResult?.Product;

        if (!products) {
            console.log("[24SO Products] No products found");
            return [];
        }

        // Handle single or multiple results
        const productList = Array.isArray(products) ? products : [products];
        console.log(`[24SO Products] Found ${productList.length} products`);

        return productList;
    } catch (error) {
        console.error("[24SO Products] Failed to get products:", error);
        throw error;
    }
}

/**
 * Get only BISO Membership products from 24SevenOffice
 */
export async function getMembershipProducts(): Promise<Product[]> {
    const allProducts = await getProducts();

    const membershipProducts = allProducts.filter(
        (p) => p.Name?.includes("BISO Membership")
    );

    console.log(`[24SO Products] Found ${membershipProducts.length} membership products`);
    return membershipProducts;
}
