/**
 * Webhooks Handler
 * Processes Shopify webhooks
 */
import { json } from "@remix-run/node";
import { verifyWebhookSignature } from "~/utils/auth.server";
import { prisma } from "~/db.server";
export async function action({ request }) {
    if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
    }
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");
    const signature = request.headers.get("X-Shopify-Hmac-SHA256") || "";
    if (!topic || !shop) {
        return json({ error: "Missing headers" }, { status: 400 });
    }
    const body = await request.text();
    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = JSON.parse(body);
    try {
        switch (topic) {
            case "app/uninstalled":
                await handleAppUninstalled(shop);
                break;
            case "products/update":
                await handleProductUpdate(shop, data);
                break;
            case "orders/create":
                await handleOrderCreated(shop, data);
                break;
        }
        return json({ success: true });
    }
    catch (error) {
        console.error("Webhook error:", error);
        return json({ error: "Processing failed" }, { status: 500 });
    }
}
async function handleAppUninstalled(shop) {
    // Disable the shop instead of deleting
    await prisma.shop.update({
        where: { shopifyDomain: shop },
        data: { isActive: false },
    });
}
async function handleProductUpdate(shop, data) {
    // Product was updated - could invalidate cache here
    console.log(`Product updated for ${shop}:`, data.id);
}
async function handleOrderCreated(shop, data) {
    // Order created - could track attribution here
    console.log(`Order created for ${shop}:`, data.id);
}
