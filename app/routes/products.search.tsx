/**
 * Products Search API
 * Handles product search requests
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { searchProducts } from "~/services/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const shop = url.searchParams.get("shop");
  const accessToken = url.searchParams.get("token");

  if (!query || !shop || !accessToken) {
    return json(
      { error: "Missing query, shop, or token" },
      { status: 400 }
    );
  }

  try {
    const result = await searchProducts(accessToken, shop, query);
    return json(result);
  } catch (error) {
    console.error("Product search error:", error);
    return json(
      { error: "Failed to search products" },
      { status: 500 }
    );
  }
}
