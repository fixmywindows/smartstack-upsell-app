/**
 * OAuth Callback Route
 * Handles Shopify OAuth token exchange and session creation
 */
import { json, redirect } from "@remix-run/node";
import { getAccessToken, parseShopDomain } from "~/utils/auth.server";
import { prisma } from "~/db.server";
/**
 * Handle OAuth callback from Shopify
 */
export async function loader({ request }) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const shop = url.searchParams.get("shop");
    const state = url.searchParams.get("state");
    const hmac = url.searchParams.get("hmac");
    // Validate required parameters
    if (!code || !shop) {
        return json({ error: "Missing code or shop parameter" }, { status: 400 });
    }
    try {
        const shopDomain = parseShopDomain(shop);
        if (!shopDomain) {
            return json({ error: "Invalid shop domain" }, { status: 400 });
        }
        // Exchange authorization code for access token
        const accessToken = await getAccessToken(shopDomain, code);
        if (!accessToken) {
            return json({ error: "Failed to get access token" }, { status: 400 });
        }
        // Save or update shop in database
        const savedShop = await prisma.shop.upsert({
            where: { shopifyDomain: shopDomain },
            create: {
                shopifyDomain: shopDomain,
                accessToken: accessToken,
                scope: process.env.SHOPIFY_API_SCOPES || "",
                isActive: true,
            },
            update: {
                accessToken: accessToken,
                isActive: true,
            },
        });
        // TODO: Create session cookie here
        // For now, redirect to dashboard with shop domain as query param
        return redirect(`/dashboard?shop=${encodeURIComponent(shopDomain)}&session=${savedShop.id}`);
    }
    catch (error) {
        console.error("OAuth callback error:", error);
        return json({ error: "Authorization failed. Please try again." }, { status: 500 });
    }
}
/**
 * Handle POST requests if needed
 */
export async function action({ request }) {
    if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
    }
    // Additional POST handling can be added here
    return json({ error: "Not implemented" }, { status: 501 });
}
