import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop, syncCataloguePage } from "../services/catalogue.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const products = await db.productSnapshot.findMany({
    where: { shopDomain: session.shop }, orderBy: { title: "asc" }, take: 30,
    select: { productId: true, title: true, category: true, priceMinor: true, currencyCode: true, published: true, available: true },
  });
  return { count: shop.productCount, finished: shop.syncFinished, products };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    return Response.json(await syncCataloguePage(admin, session.shop));
  } catch (err) {
    console.error("SmartStack catalogue sync failed", err);
    return Response.json({ error: "Couldn't sync this page. Check the Shopify API connection and try again." }, { status: 502 });
  }
};

export default function Catalogue() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const pending = fetcher.state !== "idle";
  return <s-page heading="Product catalogue">
    <s-section heading="Shopify catalogue connection">
      <p>Synced: <strong>{data.count} products</strong>. {data.finished ? "The last scan is complete; start again to refresh." : "More pages may be available."}</p>
      <p>To avoid long-running server requests, each sync imports up to 25 products. Continue until Shopify reports the catalogue is complete.</p>
      <fetcher.Form method="post">
        <button type="submit" disabled={pending} style={{ background: "#222", color: "#fff", border: 0, borderRadius: 8, padding: "12px 18px", cursor: "pointer" }}>
          {pending ? "Syncing…" : data.finished ? "Refresh catalogue" : "Sync next 25 products"}
        </button>
      </fetcher.Form>
      {fetcher.data && "error" in fetcher.data && <p role="alert" style={{ color: "#b42318" }}>{fetcher.data.error}</p>}
      {fetcher.data && "addedOrUpdated" in fetcher.data && <p role="status">Updated {fetcher.data.addedOrUpdated} products. {fetcher.data.hasMore ? "More products remain." : "Scan complete."}</p>}
    </s-section>
    <s-section heading="Product preview">
      {data.products.length === 0 ? <p>No catalogue data yet. Click Sync above.</p> :
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left" }}><th>Product</th><th>Category</th><th>Price</th><th>Available</th></tr></thead>
          <tbody>{data.products.map((p) => <tr key={p.productId} style={{ borderTop: "1px solid #eee" }}>
            <td style={{ padding: "12px 4px" }}>{p.title}</td>
            <td>{p.category}</td>
            <td>{new Intl.NumberFormat("en-GB", { style: "currency", currency: p.currencyCode }).format(p.priceMinor / 100)}</td>
            <td>{p.published && p.available ? "Yes" : "No"}</td>
          </tr>)}</tbody>
        </table></div>}
    </s-section>
  </s-page>;
}
