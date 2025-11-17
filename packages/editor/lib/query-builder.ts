import { Query, type Databases } from "node-appwrite";
import type { QueryConfig, QueryCondition, QueryOperator } from "../types";

/**
 * Convert our QueryCondition to Appwrite Query
 */
function buildQueryCondition(condition: QueryCondition): string {
  const { field, operator, value, values } = condition;

  switch (operator) {
    case "equal":
      return Query.equal(field, value as string | number | boolean | string[]);
    case "notEqual":
      return Query.notEqual(field, value as string | number | boolean | string[]);
    case "lessThan":
      return Query.lessThan(field, value as string | number);
    case "lessThanEqual":
      return Query.lessThanEqual(field, value as string | number);
    case "greaterThan":
      return Query.greaterThan(field, value as string | number);
    case "greaterThanEqual":
      return Query.greaterThanEqual(field, value as string | number);
    case "search":
      return Query.search(field, value as string);
    case "contains":
      return Query.contains(field, value as string | string[]);
    case "isNull":
      return Query.isNull(field);
    case "isNotNull":
      return Query.isNotNull(field);
    case "between":
      if (values && values.length === 2) {
        return Query.between(field, values[0], values[1]);
      }
      throw new Error("Between operator requires two values");
    case "startsWith":
      return Query.startsWith(field, value as string);
    case "endsWith":
      return Query.endsWith(field, value as string);
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

/**
 * Build Appwrite query array from QueryConfig
 */
export function buildAppwriteQuery(config: QueryConfig): string[] {
  const queries: string[] = [];

  // Add filter conditions
  if (config.conditions && config.conditions.length > 0) {
    // Appwrite supports AND by default when you pass multiple queries
    // For OR logic, we need to use Query.or()
    if (config.logic === "or" && config.conditions.length > 1) {
      const conditionQueries = config.conditions.map((c) =>
        buildQueryCondition(c)
      );
      queries.push(Query.or(conditionQueries));
    } else {
      // AND logic (default)
      config.conditions.forEach((condition) => {
        queries.push(buildQueryCondition(condition));
      });
    }
  }

  // Add sorting
  if (config.sort && config.sort.length > 0) {
    config.sort.forEach((sort) => {
      if (sort.direction === "asc") {
        queries.push(Query.orderAsc(sort.field));
      } else {
        queries.push(Query.orderDesc(sort.field));
      }
    });
  }

  // Add limit
  if (config.limit) {
    queries.push(Query.limit(config.limit));
  }

  // Add offset
  if (config.offset) {
    queries.push(Query.offset(config.offset));
  }

  return queries;
}

/**
 * Execute a query against Appwrite database
 * Note: This is a utility function, not a server action.
 * Call this from within your own "use server" functions.
 * @param databaseId - The Appwrite database ID
 * @param collectionId - The collection to query
 * @param queryConfig - Query configuration
 * @param databases - Appwrite Databases client (from createSessionClient)
 */
export async function executeQuery(
  databaseId: string,
  collectionId: string,
  queryConfig: QueryConfig,
  databases: Databases
): Promise<any[]> {
  try {
    const queries = buildAppwriteQuery(queryConfig);

    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      queries
    );

    return response.documents;
  } catch (error) {
    console.error("Query execution failed:", error);
    throw error;
  }
}

/**
 * Get collection attributes/schema
 * Note: This is a utility function, not a server action.
 * Call this from within your own "use server" functions.
 */
export async function getCollectionSchema(
  databaseId: string,
  collectionId: string,
  databases: Databases
): Promise<any> {
  try {
    const collection = await databases.getCollection(databaseId, collectionId);
    return collection;
  } catch (error) {
    console.error("Failed to fetch collection schema:", error);
    throw error;
  }
}

/**
 * List all collections in a database
 * Note: This is a utility function, not a server action.
 * Call this from within your own "use server" functions.
 */
export async function listCollections(
  databaseId: string,
  databases: Databases
): Promise<any[]> {
  try {
    const response = await databases.listCollections(databaseId);
    return response.collections;
  } catch (error) {
    console.error("Failed to list collections:", error);
    throw error;
  }
}

/**
 * Helper to validate query configuration
 */
export function validateQueryConfig(config: QueryConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.conditions || config.conditions.length === 0) {
    // Empty conditions is valid - means no filters
  } else {
    config.conditions.forEach((condition, index) => {
      if (!condition.field) {
        errors.push(`Condition ${index}: field is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index}: operator is required`);
      }
      if (
        condition.operator === "between" &&
        (!condition.values || condition.values.length !== 2)
      ) {
        errors.push(`Condition ${index}: between requires exactly 2 values`);
      }
      if (
        condition.operator !== "isNull" &&
        condition.operator !== "isNotNull" &&
        condition.operator !== "between" &&
        condition.value === undefined &&
        condition.value === null
      ) {
        errors.push(`Condition ${index}: value is required for operator ${condition.operator}`);
      }
    });
  }

  if (config.limit !== undefined && (config.limit < 0 || config.limit > 5000)) {
    errors.push("Limit must be between 0 and 5000");
  }

  if (config.offset !== undefined && config.offset < 0) {
    errors.push("Offset must be non-negative");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

