// app/api/products/route.ts
import { type NextRequest, NextResponse } from "next/server";

type WooCommerceProduct = {
  id: number;
  name: string;
  permalink: string;
  description: string;
  price: string;
  sale_price: string;
  images: {
    id: number;
    src: string;
  }[];
  acf: {
    campus: {
      value: string;
      label: string;
    } | null;
    department_oslo: {
      value: string;
      label: string;
    } | null;
    department_bergen: {
      value: string;
      label: string;
    } | null;
    department_stavanger: {
      value: string;
      label: string;
    } | null;
    department_trondheim: {
      value: string;
      label: string;
    } | null;
    department_national: {
      value: string;
      label: string;
    } | null;
  };
};

type ProductResponse = {
  id: number;
  name: string;
  campus: { value: string; label: string } | null;
  department: { value: string; label: string } | null;
  images: string[];
  price: string;
  sale_price: string;
  description: string;
  url: string;
};

type PaginationInfo = {
  current_page: number;
  per_page: number;
  total_products: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
};

type ApiResponse = {
  success: boolean;
  products: ProductResponse[];
  pagination: PaginationInfo;
  filters: {
    campus?: string;
    department?: string;
  };
};

type ValidatedRequestBody = {
  campus?: string | null;
  campusId?: string | null;
  departmentId?: string | null;
  page: number;
  perPage: number;
};

const CONFIG = {
  MAX_PER_PAGE: 100,
  MIN_PER_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  TIMEOUT_MS: 10_000,
};

const campusMapping = {
  oslo: "1",
  bergen: "2",
  trondheim: "3",
  stavanger: "4",
  national: "5",
} as const;

const campusKeyMapping = {
  "1": "oslo",
  "2": "bergen",
  "3": "trondheim",
  "4": "stavanger",
  "5": "national",
} as const;

class ProductsError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "ProductsError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validateRequestBody(body: any): ValidatedRequestBody {
  if (!body || typeof body !== "object") {
    return {
      page: 1,
      perPage: CONFIG.DEFAULT_PER_PAGE,
    };
  }

  const { campus, campusId, departmentId, page, perPage } = body;

  // Validate page
  let validatedPage = 1;
  if (page !== undefined) {
    if (!Number.isInteger(page) || page < 1) {
      throw new ProductsError(
        "page must be a positive integer",
        400,
        "INVALID_PAGE"
      );
    }
    validatedPage = page;
  }

  // Validate perPage
  let validatedPerPage = CONFIG.DEFAULT_PER_PAGE;
  if (perPage !== undefined) {
    if (
      !Number.isInteger(perPage) ||
      perPage < CONFIG.MIN_PER_PAGE ||
      perPage > CONFIG.MAX_PER_PAGE
    ) {
      throw new ProductsError(
        `perPage must be an integer between ${CONFIG.MIN_PER_PAGE} and ${CONFIG.MAX_PER_PAGE}`,
        400,
        "INVALID_PER_PAGE"
      );
    }
    validatedPerPage = perPage;
  }

  const finalCampusId = campus || campusId;

  return {
    campus: finalCampusId,
    campusId: finalCampusId,
    departmentId,
    page: validatedPage,
    perPage: validatedPerPage,
  };
}

function buildWooCommerceUrl(params: ValidatedRequestBody): URL {
  const baseUrl = new URL("https://biso.no/wp-json/wc/v3/products");

  if (!(process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET)) {
    throw new ProductsError(
      "Missing WooCommerce API credentials",
      500,
      "MISSING_CREDENTIALS"
    );
  }

  baseUrl.searchParams.append("consumer_key", process.env.WC_CONSUMER_KEY);
  baseUrl.searchParams.append(
    "consumer_secret",
    process.env.WC_CONSUMER_SECRET
  );
  baseUrl.searchParams.append("status", "publish");
  baseUrl.searchParams.append("orderby", "date");
  baseUrl.searchParams.append("order", "desc");
  baseUrl.searchParams.append("per_page", params.perPage.toString());
  baseUrl.searchParams.append("page", params.page.toString());

  // Exclude products with catalog visibility set to 'hidden'
  baseUrl.searchParams.append("catalog_visibility", "visible,catalog,search");

  const metaQueries: any[] = [];

  if (params.campusId) {
    const campusIdToUse =
      campusMapping[
        params.campusId.toLowerCase() as keyof typeof campusMapping
      ] || params.campusId;
    metaQueries.push({
      key: "campus",
      value: campusIdToUse,
      compare: "=",
    });
  }

  if (params.departmentId && params.campusId) {
    const campusMapped =
      campusMapping[
        params.campusId.toLowerCase() as keyof typeof campusMapping
      ] || params.campusId;
    const campusKey =
      campusKeyMapping[campusMapped as keyof typeof campusKeyMapping];

    if (campusKey) {
      metaQueries.push({
        key: `department_${campusKey}`,
        value: params.departmentId,
        compare: "=",
      });
    }
  }

  if (metaQueries.length > 0) {
    const metaQuery =
      metaQueries.length > 1
        ? { relation: "AND", ...metaQueries }
        : metaQueries[0];
    baseUrl.searchParams.append("meta_query", JSON.stringify(metaQuery));
  }

  return baseUrl;
}

async function fetchProductsFromWooCommerce(
  params: ValidatedRequestBody,
  log: (msg: string, ...args: any[]) => void
): Promise<{
  products: WooCommerceProduct[];
  totalPages: number;
  totalProducts: number;
}> {
  const url = buildWooCommerceUrl(params);

  log(`Fetching products from: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "BisoApp/1.0",
      },
      signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new ProductsError(
        `WooCommerce API error: ${response.status} ${response.statusText}`,
        502,
        "WOOCOMMERCE_API_ERROR"
      );
    }

    const products: WooCommerceProduct[] = await response.json();

    const totalProducts = Number.parseInt(
      response.headers.get("x-wp-total") || "0",
      10
    );
    const totalPages = Number.parseInt(
      response.headers.get("x-wp-totalpages") || "1",
      10
    );

    log(
      `Fetched ${products.length} products, total: ${totalProducts}, pages: ${totalPages}`
    );

    return { products, totalPages, totalProducts };
  } catch (error: any) {
    if (error.name === "TimeoutError") {
      throw new ProductsError(
        "Request timeout while fetching products",
        408,
        "REQUEST_TIMEOUT"
      );
    }

    if (error instanceof ProductsError) {
      throw error;
    }

    throw new ProductsError(
      `Failed to fetch products: ${error.message}`,
      502,
      "FETCH_FAILED"
    );
  }
}

function processProducts(
  products: WooCommerceProduct[],
  campusId?: string | null
): ProductResponse[] {
  const shouldPrioritizeFeatured =
    campusId &&
    campusMapping[campusId.toLowerCase() as keyof typeof campusMapping] === "1";

  const sortedProducts = [...products];
  if (shouldPrioritizeFeatured) {
    sortedProducts.sort((a, b) => {
      if (a.id === 37_313) {
        return -1;
      }
      if (b.id === 37_313) {
        return 1;
      }
      return 0;
    });
  }

  return sortedProducts.map((product) => {
    let department = null as ProductResponse["department"];

    if (campusId) {
      const campusMapped =
        campusMapping[campusId.toLowerCase() as keyof typeof campusMapping] ||
        campusId;
      const campusKey =
        campusKeyMapping[campusMapped as keyof typeof campusKeyMapping];
      if (campusKey) {
        const departmentKey =
          `department_${campusKey}` as keyof typeof product.acf;
        department = product.acf[departmentKey] as any;
      }
    }

    return {
      id: product.id,
      name: product.name,
      campus: product.acf.campus,
      department,
      images: product.images.map((image) => image.src),
      price: product.price,
      sale_price: product.sale_price,
      description: product.description,
      url: product.permalink,
    };
  });
}

function generateRequestId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const logWithId = (message: string, ...args: any[]) => {
    console.log(`[${requestId}] ${message}`, ...args);
  };

  const errorLog = (message: string, ...args: any[]) => {
    console.error(message, ...args);
  };

  try {
    logWithId("WooCommerce products request started");

    if (!(process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET)) {
      throw new ProductsError(
        "Missing WooCommerce API credentials",
        500,
        "MISSING_CREDENTIALS"
      );
    }

    const rawBody = await req.text();
    const requestBody = rawBody ? JSON.parse(rawBody) : {};
    const validatedParams = validateRequestBody(requestBody);

    logWithId("Request validated:", JSON.stringify(validatedParams));

    const { products, totalPages, totalProducts } =
      await fetchProductsFromWooCommerce(validatedParams, logWithId);

    const processedProducts = processProducts(
      products,
      validatedParams.campusId
    );

    const paginationInfo: PaginationInfo = {
      current_page: validatedParams.page,
      per_page: validatedParams.perPage,
      total_products: totalProducts,
      total_pages: totalPages,
      has_next: validatedParams.page < totalPages,
      has_previous: validatedParams.page > 1,
    };

    const executionTime = Date.now() - startTime;
    logWithId(`Function completed successfully in ${executionTime}ms`);
    logWithId(`Returning ${processedProducts.length} products`);

    const response: ApiResponse = {
      success: true,
      products: processedProducts,
      pagination: paginationInfo,
      filters: {
        campus: validatedParams.campusId || undefined,
        department: validatedParams.departmentId || undefined,
      },
    };

    return NextResponse.json(response);
  } catch (err: any) {
    const executionTime = Date.now() - startTime;

    if (err instanceof ProductsError) {
      logWithId(`Business error [${err.code}]:`, err.message);

      const status = err.statusCode >= 500 ? err.statusCode : 200;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
          },
          metadata: {
            requestId,
            executionTime,
            timestamp: new Date().toISOString(),
          },
        },
        { status }
      );
    }

    errorLog(`[${requestId}] Unexpected error:`, err);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          statusCode: 500,
        },
        metadata: {
          requestId,
          executionTime,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
