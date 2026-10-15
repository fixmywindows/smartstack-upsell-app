import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";
// Public block metadata is safe in the browser; do not import .server modules into rendered components.
const BLOCK_KINDS = ["similar", "complement", "bought_together", "bundle"] as const;
type BlockKind = (typeof BLOCK_KINDS)[number];
const BLOCK_TITLES: Record<BlockKind, string> = {
  similar: "Similar products",
  complement: "Pairs perfectly with",
  bought_together: "Frequently bought together",
  bundle: "Complete the set",
};

const MODE_OPTIONS = ["ai", "manual", "hybrid"] as const;
const FIELD_OPTIONS = ["tags", "title", "category", "product_type", "vendor", "collections", "price"] as const;
const OPERATORS = ["equals", "contains", "any_of", "gte", "lte"] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);
  const [blocks, products] = await Promise.all([
    db.recommendationBlock.findMany({ where: { shopDomain: session.shop } }),
    db.productSnapshot.findMany({ where: { shopDomain: session.shop }, take: 150, orderBy: { title: "asc" },
      select: { productId: true, title: true } }),
  ]);
  return { blocks, products };
};

const splitCsv = (value: string) => value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const textArray = (value: unknown) => Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (request.method !== "POST") return Response.json({ error: "Invalid method" }, { status: 405 });
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const mode = String(form.get("mode") ?? "");
  if (!BLOCK_KINDS.includes(kind as BlockKind) || !MODE_OPTIONS.includes(mode as typeof MODE_OPTIONS[number])) {
    return Response.json({ error: "Invalid block type or matching mode." }, { status: 400 });
  }
  const heading = String(form.get("heading") ?? "").trim().slice(0, 110) || BLOCK_TITLES[kind as BlockKind];
  const maxItems = Math.min(kind === "bundle" ? 3 : 12, Math.max(1, Number.parseInt(String(form.get("maxItems") ?? 4), 10) || 4));
  const pinInputs = form.getAll("pinnedIds").map(String);
  const selected = await db.productSnapshot.findMany({
    where: { shopDomain: session.shop, productId: { in: pinInputs } }, select: { productId: true },
  });
  const pinnedIds = selected.map((p) => p.productId);
  const excludedTags = splitCsv(String(form.get("excludedTags") ?? "")).slice(0, 60);
  const field = String(form.get("ruleField") ?? "").trim().slice(0, 120);
  const op = String(form.get("ruleOp") ?? "");
  const value = String(form.get("ruleValue") ?? "").trim().slice(0, 160);
  const safeField = FIELD_OPTIONS.includes(field as typeof FIELD_OPTIONS[number]) || /^metafield:[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(field);
  const ruleGroups = field && value && safeField && OPERATORS.includes(op as typeof OPERATORS[number])
    ? [{ logic: "AND", rules: [{ field, op, value }] }] : [];
  const enabled = form.get("enabled") === "on";
  await ensureShop(session.shop);
  await db.recommendationBlock.upsert({
    where: { shopDomain_kind: { shopDomain: session.shop, kind } },
    create: { shopDomain: session.shop, kind, mode, heading, maxItems, enabled, pinnedIds, excludedTags, ruleGroups },
    update: { mode, heading, maxItems, enabled, pinnedIds, excludedTags, ruleGroups },
  });
  return Response.json({ saved: kind, enabled });
};

const labelStyle: React.CSSProperties = { display: "block", fontWeight: 600, margin: "14px 0 5px" };
const controlStyle: React.CSSProperties = { width: "100%", minHeight: 38, border: "1px solid #cbd0d9", borderRadius: 7, padding: "7px 10px", background: "white" };
const cardStyle: React.CSSProperties = { border: "1px solid #e2e5e9", borderRadius: 13, padding: 22, marginTop: 20, background: "#fff" };

export default function Blocks() {
  const { blocks, products } = useLoaderData<typeof loader>();
  const saved = useActionData<{saved?: string;enabled?: boolean;error?: string}>();
  const lookup = (kind: string) => blocks.find((b) => b.kind === kind);
  return <s-page heading="Recommendation blocks">
    <s-section heading="Configure all four types">
      <p style={{ maxWidth: 700 }}>Choose how each recommendation type works. Manual selections outrank automatic matching, but availability and exclusions always apply. The automatic option currently uses catalogue rules, not a connected AI service.</p>
      <p style={{ marginTop: 12 }}><Link to="/app/preview">Preview recommendations for any synced product →</Link></p>
      {saved?.saved && <p role="status" style={{ color: "#17694a" }}>Saved {saved.saved}. {saved.enabled ? "Block enabled." : "Block is disabled."}</p>}
      {saved?.error && <p role="alert" style={{ color: "#b42318" }}>{saved.error}</p>}
      {BLOCK_KINDS.map((kind) => {
        const b = lookup(kind);
        const rules = Array.isArray(b?.ruleGroups) ? b.ruleGroups as Array<{ rules?: Array<{ field?: string; op?: string; value?: string }> }> : [];
        const rule = rules[0]?.rules?.[0];
        return <div key={kind} style={cardStyle}>
          <h2 style={{ fontSize: 19, margin: 0 }}>{BLOCK_TITLES[kind]}</h2>
          {kind === "bought_together" && <p style={{ color: "#69707c" }}>Real purchase associations will be added in phase 2. Until then, inferred suggestions display as “Pairs well with”.</p>}
          {kind === "bundle" && <p style={{ color: "#69707c" }}>Bundles can display 1–3 recommended add-ons. Discounted checkout is not enabled in this pilot.</p>}
          <Form method="post">
            <input type="hidden" name="kind" value={kind} />
            <label style={labelStyle}><input type="checkbox" name="enabled" defaultChecked={Boolean(b?.enabled)} /> Enable this block type</label>
            <label style={labelStyle}>Heading</label>
            <input style={controlStyle} type="text" name="heading" defaultValue={b?.heading ?? BLOCK_TITLES[kind]} maxLength={110} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
              <div><label style={labelStyle}>Matching mode</label>
                <select style={controlStyle} name="mode" defaultValue={b?.mode || "hybrid"}>
                  <option value="ai">Automatic</option><option value="manual">Manual only</option><option value="hybrid">Hybrid (recommended)</option>
                </select></div>
              <div><label style={labelStyle}>Maximum add-ons</label>
                <input style={controlStyle} type="number" name="maxItems" defaultValue={b?.maxItems ?? (kind === "bundle" ? 3 : 4)} min="1" max={kind === "bundle" ? 3 : 12} /></div>
            </div>
            <label style={labelStyle}>Pinned products (hold Ctrl/Cmd to choose multiple)</label>
            <select style={{ ...controlStyle, height: 130 }} name="pinnedIds" multiple defaultValue={textArray(b?.pinnedIds)}>
              {products.map((p) => <option key={p.productId} value={p.productId}>{p.title}</option>)}
            </select>
            <label style={labelStyle}>Excluded product tags (comma-separated)</label>
            <input style={controlStyle} name="excludedTags" defaultValue={textArray(b?.excludedTags).join(", ")} placeholder="clearance, out-of-season" />
            <label style={labelStyle}>Additional matching rule (optional)</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
              <select style={controlStyle} name="ruleField" defaultValue={rule?.field || ""}>
                <option value="">No rule</option>
                {FIELD_OPTIONS.map((field) => <option key={field} value={field}>{field}</option>)}
                {rule?.field?.startsWith("metafield:") && <option value={rule.field}>{rule.field}</option>}
              </select>
              <select style={controlStyle} name="ruleOp" defaultValue={rule?.op || "contains"}>
                {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <input style={controlStyle} type="text" name="ruleValue" defaultValue={rule?.value || ""} placeholder="Value" />
            </div>
            <p style={{ color: "#69707c", fontSize: 12 }}>For a metafield use the exact key format metafield:namespace.key. Advanced AND/OR editing will follow.</p>
            <button type="submit" style={{ marginTop: 12, padding: "12px 18px", background: "#222", border: 0, color: "#fff", borderRadius: 8, cursor: "pointer" }}>Save {BLOCK_TITLES[kind]}</button>
          </Form>
        </div>;
      })}
    </s-section>
  </s-page>;
}
