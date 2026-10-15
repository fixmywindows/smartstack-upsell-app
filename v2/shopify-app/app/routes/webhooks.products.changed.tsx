import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

// Fail closed: remove the stale snapshot until the merchant runs the next sync.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  const product = payload as { id?: number | string; admin_graphql_api_id?: string };
  const id = product.admin_graphql_api_id || (product.id ? "gid://shopify/Product/" + product.id : null);
  if (id) {
    await db.productSnapshot.deleteMany({ where: { shopDomain: shop, productId: id } });
    await db.merchantShop.updateMany({
      where: { domain: shop },
      data: { syncFinished: true, cursor: null },
    });
  }
  return new Response();
};
