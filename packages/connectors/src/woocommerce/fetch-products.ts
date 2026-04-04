import { wcApi } from "./client";

export async function fetchProducts() {
  try {
    const response = await wcApi.getProducts();
    return response.data;
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}

export async function fetchProductById(productId: number) {
  try {
    const response = await wcApi.getProduct(productId);
    return response.data;
  } catch (error) {
    console.error(`Error fetching product with ID ${productId}:`, error);
    throw error;
  }
}
