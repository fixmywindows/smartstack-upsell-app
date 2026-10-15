import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  // The initial app stores only catalogue snapshots and merchant configuration,
  // not customer/order PII. Future attribution must implement customer erasure.
  if (topic === "SHOP_REDACT") {
    await db.$transaction([
      db.session.deleteMany({ where: { shop } }),
      db.merchantShop.deleteMany({ where: { domain: shop } }),
    ]);
  }
  return new Response(null, { status: 200 });
};
