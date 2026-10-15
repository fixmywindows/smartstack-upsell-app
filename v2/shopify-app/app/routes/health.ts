export const loader = () => Response.json({ service: "SmartStack v2 Shopify app", status: "ok", billing: "disabled" }, {
  headers: { "Cache-Control": "no-store" },
});
