import type { LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const kinds = [
  { id: "similar", label: "Similar products" },
  { id: "complement", label: "Complementary products" },
  { id: "bought_together", label: "Bought together" },
  { id: "bundle", label: "Complete the set" },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const kindValue = url.searchParams.get("kind") || "similar";
  const kind = (kinds.some((option) => option.id === kindValue) ? kindValue : "similar") as typeof kinds[number]["id"];
  const [products, blocks, ruleSets] = await Promise.all([
    db.productSnapshot.findMany({
      where: { shopDomain: session.shop },
      orderBy: { title: "asc" },
      take: 300,
      select: { productId: true, title: true, category: true, imageUrl: true, available: true, published: true },
    }),
    db.recommendationBlock.findMany({
      where: { shopDomain: session.shop },
      select: { kind: true, enabled: true, mode: true, maxItems: true },
    }),
    db.recommendationRuleSet.findMany({
      where: { shopDomain: session.shop, kind, archived: false },
      orderBy: [{priority:"asc"},{createdAt:"asc"}],
      select: { id: true, name: true, enabled: true, archived: true, selectionMode: true, maxItems: true, priority: true },
    }),
  ]);

  const sourceIdParam = url.searchParams.get("product");
  const sourceId = products.find((product) => product.productId === sourceIdParam)?.productId || products[0]?.productId || "";
  const currentBlock = blocks.find((block) => block.kind === kind);
  const selectedSetId = url.searchParams.get("set") || "";
  const selectedSet = ruleSets.find(set => set.id === selectedSetId);
  const hasActiveSets = ruleSets.some(set => set.enabled && !set.archived);
  const blockEnabled = Boolean(selectedSet) || (ruleSets.length > 0 ? hasActiveSets : Boolean(currentBlock?.enabled));
  let result: Awaited<ReturnType<typeof import("../services/recommendations.server")["getRecommendations"]>> | null = null;
  let error = "";
  if (sourceId && blockEnabled) {
    try {
      // This import must remain inside the server-only loader, never in the UI.
      const { getRecommendations } = await import("../services/recommendations.server");
      result = await getRecommendations(session.shop, sourceId, kind, 12, {
        diagnostics: true, previewSetId: selectedSet?.id || null,
      });
    } catch (cause) {
      console.error("SmartStack merchant preview", cause);
      error = "Couldn't load recommendations. Please try again.";
    }
  }
  return {
    products, kind, sourceId, result, error, ruleSets, selectedSetId: selectedSet?.id || "",
    blockEnabled,
    mode: ruleSets.find(set=>set.id===result?.matchedSet?.id)?.selectionMode || currentBlock?.mode || "hybrid",
  };
};

const container: React.CSSProperties = {
  border: "1px solid #e0e3e8", borderRadius: 14, background: "#fff", padding: 24,
};
const textSmall: React.CSSProperties = { color: "#646b78", fontSize: 13, lineHeight: 1.5 };

export default function RecommendationPreview() {
  const data = useLoaderData<typeof loader>();
  const source = data.products.find((p) => p.productId === data.sourceId);
  return <s-page heading="Preview recommendations">
    <s-section heading="Test before publishing">
      <p style={{ ...textSmall, maxWidth: 730 }}>
        Preview the products SmartStack would recommend for a specific source product.
        This uses the same matching engine as your storefront and helps you catch unsuitable
        combinations before customers see them.
      </p>
      <Form method="get" style={{ ...container, marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <label style={{ display: "grid", gap: 7, fontWeight: 600 }}>
            Source product
            <select name="product" defaultValue={data.sourceId} style={{ padding: 10, border: "1px solid #cbd0d9", borderRadius: 7 }}>
              {data.products.map((product) => <option key={product.productId} value={product.productId}>{product.title}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 7, fontWeight: 600 }}>
            Recommendation type
            <select name="kind" defaultValue={data.kind} style={{ padding: 10, border: "1px solid #cbd0d9", borderRadius: 7 }}>
              {kinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 7, fontWeight: 600 }}>
            Recommendation set
            <select name="set" defaultValue={data.selectedSetId}
              style={{ padding: 10, border: "1px solid #cbd0d9", borderRadius: 7 }}>
              <option value="">Automatic priority order</option>
              {data.ruleSets.map(set => <option key={set.id} value={set.id}>
                {set.name} · Priority {set.priority}{set.enabled ? "" : " · Draft"}
              </option>)}
            </select>
          </label>
        </div>
        <button type="submit" style={{ marginTop: 16, border: 0, background: "#202225", color: "white", padding: "12px 18px", borderRadius: 8, cursor: "pointer" }}>
          Show recommendations
        </button>
        <Link to="/app/blocks" style={{ marginLeft: 16 }}>Edit matching rules</Link>
      </Form>
    </s-section>

    <s-section heading="Results">
      {!source ? <p style={textSmall}>No products have been synced. Visit Catalogue and import products first.</p> :
        <div style={{ ...container, marginTop: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
            <div>
              <div style={textSmall}>Selected source product</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 5 }}>
                {source.imageUrl && <img src={source.imageUrl} alt="" style={{ width: 66, height: 66,
                  objectFit: "contain", borderRadius: 8, background: "#f5f5f7" }}/>}
                <h2 style={{ margin: "4px 0", fontSize: 20 }}>{source.title}</h2>
              </div>
              <div style={textSmall}>{source.category} · {source.published ? "Published" : "Not published"} · {source.available ? "Available" : "Unavailable"}</div>
            </div>
            <div style={{ ...textSmall, background: "#f4f4f7", padding: "7px 12px", borderRadius: 30, alignSelf: "start" }}>
              {data.mode === "ai" ? "Automatic" : data.mode === "manual" ? "Manual" : "Hybrid"} matching
            </div>
          </div>
          <hr style={{ border: 0, borderTop: "1px solid #e6e6ea", margin: "20px 0" }} />
          {!data.blockEnabled ? <p>That block is not enabled. <Link to="/app/blocks">Enable it in Recommendation blocks</Link> to preview its results.</p> :
            data.error ? <p role="alert">{data.error}</p> :
              data.result?.items.length ? <>
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>{data.result.heading}</h3>
                {data.result.matchedSet && <p style={{...textSmall,
                  background:"#eff6f2",color:"#17603b",display:"inline-block",padding:"7px 10px",borderRadius:7}}>
                  Matched set: {data.result.matchedSet.name} · Priority {data.result.matchedSet.priority}
                </p>}
                <p style={textSmall}>{data.result.items.length} recommendation(s) · {data.result.basis === "cold_start" ? "Inferred pairings — no verified purchase history" : data.result.basis === "merchant" ? "Merchant selections" : data.result.basis === "order_history" ? "Observed co-purchases" : "Catalogue attribute matching"}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: 12, marginTop: 16 }}>
                  {data.result.items.map((item) => <div key={item.id} style={{ border: "1px solid #e6e8ec", borderRadius: 10, padding: 12, minWidth: 0 }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: 140, objectFit: "contain", background: "#f7f7f9", borderRadius: 6 }} /> : <div style={{ height: 140, background: "#f7f7f9", display: "grid", placeItems: "center" }}>No image</div>}
                    <div style={{ fontWeight: 600, marginTop: 10 }}>{item.title}</div>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{item.priceFormatted}</div>
                    <div style={{ ...textSmall, marginTop: 6 }}>{item.reason}</div>
                  </div>)}
                </div>
                {data.kind === "bundle" && <p style={{ ...textSmall, marginTop: 16 }}>The storefront will include the source product and up to three add-ons, with a selectable set total. Bundle discounts are still disabled.</p>}
              </> : <p role="status">No eligible recommendations for this source product. Try another product, review manual pins, or loosen your exclusions.</p>}
        </div>}
    </s-section>
    <s-section heading="Why these products were selected">
      <div style={{ ...container, marginTop: 12 }}>
        <p style={textSmall}>
          Only store administrators can see this explanation. The public product
          widget never exposes priority rules or internal condition decisions.
        </p>
        {!data.result?.trace?.length ? <p style={textSmall}>
          Choose a source product or a saved set to see the matching decisions.
        </p> :
          <div style={{ display: "grid", gap: 9 }}>
            {data.result.trace.map(row => <div key={row.id} style={{
              display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
              border: "1px solid #e5e7ec", borderRadius: 9, padding: 12,
              background: row.decision === "selected" ? "#eff7f1" : "#fff"
            }}>
              <div style={{ flex: 1, minWidth: 190 }}>
                <strong>{row.name}</strong>
                <div style={textSmall}>{row.reason}</div>
              </div>
              <div style={{ ...textSmall, textAlign: "right" }}>
                <div>Priority {row.priority}</div>
                <div>{row.productCount} eligible products</div>
                <div>{row.decision.replaceAll("_", " ")}</div>
              </div>
            </div>)}
          </div>}
      </div>
    </s-section>
  </s-page>;
}
