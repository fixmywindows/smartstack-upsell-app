/**
 * Authentication Service
 * Handles OAuth flow and session management
 */
import crypto from "crypto";
const OAUTH_SCOPES = [
    "write_products",
    "read_products",
    "write_orders",
    "read_orders",
    "write_customers",
    "read_customers",
];
/**
 * Generate OAuth authorization URL
 */
export function getOAuthUrl(shop) {
    const clientId = process.env.SHOPIFY_API_KEY;
    const redirectUri = `${process.env.APP_URL}/auth/callback`;
    const nonce = crypto.randomBytes(16).toString("hex");
    const params = new URLSearchParams({
        client_id: clientId,
        scope: OAUTH_SCOPES.join(","),
        redirect_uri: redirectUri,
        state: nonce,
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}
/**
 * Exchange OAuth code for access token
 */
export async function getAccessToken(shop, code) {
    const clientId = process.env.SHOPIFY_API_KEY;
    const clientSecret = process.env.SHOPIFY_API_SECRET;
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to exchange OAuth code: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.access_token;
}
/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(body, signature) {
    const hmac = crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(body, "utf8")
        .digest("base64");
    return hmac === signature;
}
/**
 * Parse shop domain from URL
 */
export function parseShopDomain(shop) {
    if (!shop)
        return null;
    // Handle both "example.myshopify.com" and "example" formats
    if (shop.includes(".myshopify.com")) {
        return shop;
    }
    return `${shop}.myshopify.com`;
}
