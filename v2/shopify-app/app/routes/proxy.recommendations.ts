import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { BLOCK_KINDS, getRecommendations, type BlockKind } from "../services/recommendations.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  // Tenant identity must come from Shopify's verified app-proxy session.
  if (!session?.shop) return Response.json({ error: "App is not installed" }, { status: 403 });
  const url = new URL(request.url);
  const numericId = url.searchParams.get("product_id");
  const kind = url.searchParams.get("kind");
  if (!numericId || !/^\d{1,20}$/.test(numericId) || !BLOCK_KINDS.includes(kind as BlockKind)) {
    return Response.json({ error: "Invalid product or block type" }, { status: 400 });
  }
  const max = Math.max(1, Math.min(12, Number(url.searchParams.get("max")) || 4));
  const sourceId = "gid://shopify/Product/" + numericId;
  try {
    const result = await getRecommendations(session.shop, sourceId, kind as BlockKind, max);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Source product does not exist")) {
      return Response.json({ heading: "Recommendations", items: [] });
    }
    console.error("SmartStack recommendation error", error);
    return Response.json({ error: "Recommendations temporarily unavailable" }, { status: 503 });
  }
};
