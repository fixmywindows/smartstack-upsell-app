import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Searchable image-backed product picker, always isolated to the authenticated shop.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
  const rows = await db.productSnapshot.findMany({
    where: {
      shopDomain: session.shop,
      ...(query ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { vendor: { contains: query, mode: "insensitive" as const } },
          { category: { contains: query, mode: "insensitive" as const } },
          { productType: { contains: query, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    orderBy: { title: "asc" },
    take: 60,
    select: {
      productId: true, title: true, imageUrl: true, category: true,
      priceMinor: true, currencyCode: true, available: true, published: true,
    },
  });
  return Response.json({ products: rows }, { headers: { "Cache-Control": "private, no-store" } });
};
