import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);
  const [products, activeSets] = await Promise.all([
    db.productSnapshot.count({ where: { shopDomain: session.shop } }),
    db.recommendationRuleSet.count({ where: { shopDomain: session.shop, enabled: true, archived: false } }),
  ]);
  return { shop: session.shop, products, activeSets };
};

const card: React.CSSProperties = {
  border: "1px solid #e2e5e9", borderRadius: 14, padding: 24, background: "#fff",
};

export default function Dashboard() {
  const { shop, products, activeSets } = useLoaderData<typeof loader>();
  return <s-page heading="SmartStack">
    <s-section heading="Recommendations that make sense">
      <p style={{ maxWidth: 650, color: "#565b63", lineHeight: 1.65 }}>Configure product recommendations with merchant-first rules. During this development pilot, AI uses our tested attribute-based scorer, while billing and discounts remain disabled.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginTop: 20 }}>
        <div style={card}><div style={{ color: "#666" }}>Synced products</div><strong style={{ fontSize: 32 }}>{products}</strong></div>
        <div style={card}><div style={{ color: "#666" }}>Active recommendation sets</div><strong style={{ fontSize: 32 }}>{activeSets}</strong></div>
        <div style={card}><div style={{ color: "#666" }}>Billing</div><strong style={{ fontSize: 22 }}>Disabled</strong></div>
      </div>
    </s-section>
    <s-section heading="Getting started">
      <ol style={{ lineHeight: 2 }}>
        <li><Link to="/app/catalogue">Sync your catalogue</Link> — 25 products per batch, including tags and metafields.</li>
        <li><Link to="/app/blocks">Manage recommendation sets</Link> — Similar, Complementary, Bought together, or Bundle.</li>
        <li><Link to="/app/preview">Preview product matches</Link> before editing the storefront.</li>
        <li>In a <strong>draft development theme</strong>, add the SmartStack app block and preview on a product page.</li>
      </ol>
      <p style={{ color: "#626775" }}>Connected store: {shop}. No live checkout discounts, commission collection or personalisation is active.</p>
    </s-section>
  </s-page>;
}
