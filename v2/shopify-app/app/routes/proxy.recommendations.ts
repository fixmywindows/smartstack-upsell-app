import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { normaliseDesign, defaultDesign, canSaveDesign, compileScopedCss } from "../utils/design-settings";
import { validPlan } from "../utils/plan-limits";
import { BLOCK_KINDS, getRecommendations, type BlockKind } from "../services/recommendations.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  // Tenant identity must come from Shopify's verified app-proxy session.
  if (!session?.shop) return Response.json({ error: "App is not installed" }, { status: 403 });
  const url = new URL(request.url);
  const numericId = url.searchParams.get("product_id");
  const kind = url.searchParams.get("kind");
  if (!numericId || !/^\d{1,20}$/.test(numericId) || !BLOCK_KINDS.includes(kind as BlockKind)) {
    return Response.json({ error: "Invalid product or block type" }, { status: 400 });
  }
  const max = Math.max(1, Math.min(8, Number(url.searchParams.get("max")) || 8));
  const sourceId = "gid://shopify/Product/" + numericId;
  try {
    const [result, savedDesign, merchant] = await Promise.all([
      getRecommendations(session.shop, sourceId, kind as BlockKind, max),
      db.recommendationDesign.findUnique({
        where: { shopDomain_kind: { shopDomain: session.shop, kind: kind as BlockKind } },
        select: { settings: true },
      }),
      db.merchantShop.findUnique({where:{domain:session.shop},select:{plan:true}}),
    ]);
    // Only presentation values are returned; never expose merchant rules, costs or tokens.
    const proposed=normaliseDesign(kind as BlockKind,savedDesign?.settings);
    const plan=validPlan(merchant?.plan||"free");
    const design=canSaveDesign(plan,proposed,kind as BlockKind)
      ?proposed:defaultDesign(kind as BlockKind);
    let customCss="";
    if(plan!=="free"){
      try{customCss=compileScopedCss(kind as BlockKind,design.customCss);}
      catch{console.warn("Ignoring invalid SmartStack custom CSS");}
    }
    // The storefront never receives raw merchant-entered CSS or private rules.
    const {customCss:unused,...safeDesign}=design;
    return Response.json({ ...result, design:safeDesign, customCss },
      {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    if (error instanceof Error && error.message.includes("Source product does not exist")) {
      return Response.json({ heading: "Recommendations", items: [] });
    }
    console.error("SmartStack recommendation error", error);
    return Response.json({ error: "Recommendations temporarily unavailable" }, { status: 503 });
  }
};
