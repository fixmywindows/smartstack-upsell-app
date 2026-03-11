/**
 * Shopify API Client Service
 * Handles all interactions with Shopify API
 */

const SHOPIFY_API_VERSION = "2024-01";

interface ShopifyRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
}

export async function shopifyRequest(
  path: string,
  accessToken: string,
  shopifyDomain: string,
  options: ShopifyRequestOptions = {}
) {
  const url = `https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;

  const headers: Record<string, string> = {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get shop information
 */
export async function getShop(
  accessToken: string,
  shopifyDomain: string
) {
  const query = `
    query {
      shop {
        id
        name
        email
        plan {
          displayName
        }
      }
    }
  `;

  return shopifyGraphQL(
    query,
    accessToken,
    shopifyDomain
  );
}

/**
 * Search products
 */
export async function searchProducts(
  accessToken: string,
  shopifyDomain: string,
  query: string
) {
  const graphqlQuery = `
    query SearchProducts($query: String!) {
      products(first: 10, query: $query) {
        edges {
          node {
            id
            title
            handle
            image {
              src
            }
          }
        }
      }
    }
  `;

  return shopifyGraphQL(
    graphqlQuery,
    accessToken,
    shopifyDomain,
    { query }
  );
}

/**
 * Get product tags
 */
export async function getProductTags(
  accessToken: string,
  shopifyDomain: string
) {
  const query = `
    query {
      productTags(first: 100) {
        edges {
          node
        }
      }
    }
  `;

  return shopifyGraphQL(
    query,
    accessToken,
    shopifyDomain
  );
}

/**
 * Generic GraphQL request
 */
export async function shopifyGraphQL(
  query: string,
  accessToken: string,
  shopifyDomain: string,
  variables?: Record<string, any>
) {
  const response = await shopifyRequest(
    `/graphql.json`,
    accessToken,
    shopifyDomain,
    {
      method: "POST",
      body: {
        query,
        variables,
      },
    }
  );

  if (response.errors) {
    throw new Error(
      `GraphQL error: ${response.errors.map((e: any) => e.message).join(", ")}`
    );
  }

  return response.data;
}
