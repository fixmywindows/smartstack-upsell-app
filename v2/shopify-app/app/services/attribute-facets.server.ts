import { Prisma } from "@prisma/client";
import db from "../db.server";

/** Search choices from the Shopify-synced catalogue, not browser-supplied data. */
export const FACET_KINDS = [
  "tags", "collections", "metafields", "values", "category", "vendor", "product_type",
] as const;
export type FacetKind = typeof FACET_KINDS[number];
export type FacetOption = { value: string; label: string; count: number };
const LIMIT = 65;
const validKey = (value:string)=>/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(value);

type Row = { value: string; matches: bigint | number };
const humanise = (value:string) =>
  value.replace(/[-_]/g," ").replace(/\b[a-z]/g,c=>c.toUpperCase());

export async function listAttributeChoices(
  shopDomain:string,kind:FacetKind,search:string,metafieldKey?:string
):Promise<FacetOption[]> {
  const q=search.trim().slice(0,80);
  let sql:Prisma.Sql;
  if(kind==="tags"||kind==="collections") {
    const column=kind==="tags"?Prisma.raw('p."tags"'):Prisma.raw('p."collections"');
    sql=Prisma.sql`
      SELECT v.value::text AS "value", COUNT(*)::bigint AS "matches"
      FROM "ProductSnapshot" p
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(${column})='array'
          THEN ${column} ELSE '[]'::jsonb END
      ) AS v(value)
      WHERE p."shopDomain"=${shopDomain}
        AND STRPOS(LOWER(v.value),LOWER(${q}))>0
      GROUP BY v.value ORDER BY COUNT(*) DESC,v.value ASC LIMIT ${LIMIT}
    `;
  } else if(kind==="metafields") {
    sql=Prisma.sql`
      SELECT m.key::text AS "value", COUNT(*)::bigint AS "matches"
      FROM "ProductSnapshot" p
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(p."metafields")='object'
          THEN p."metafields" ELSE '{}'::jsonb END
      ) AS m(key,val)
      WHERE p."shopDomain"=${shopDomain}
        AND STRPOS(LOWER(m.key),LOWER(${q}))>0
      GROUP BY m.key ORDER BY COUNT(*) DESC,m.key ASC LIMIT ${LIMIT}
    `;
  } else if(kind==="values") {
    if(!metafieldKey||!validKey(metafieldKey))return [];
    sql=Prisma.sql`
      SELECT choice.value::text AS "value", COUNT(*)::bigint AS "matches"
      FROM "ProductSnapshot" p
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(p."metafields" -> ${metafieldKey})='array'
          THEN p."metafields" -> ${metafieldKey}
          WHEN jsonb_typeof(p."metafields" -> ${metafieldKey}) IN ('string','number','boolean')
          THEN jsonb_build_array(p."metafields" -> ${metafieldKey})
          ELSE '[]'::jsonb END
      ) AS choice(value)
      WHERE p."shopDomain"=${shopDomain}
        AND STRPOS(LOWER(choice.value),LOWER(${q}))>0
      GROUP BY choice.value ORDER BY COUNT(*) DESC,choice.value ASC LIMIT ${LIMIT}
    `;
  } else {
    const column=kind==="category"?Prisma.raw('p."category"'):
      kind==="vendor"?Prisma.raw('p."vendor"'):Prisma.raw('p."productType"');
    sql=Prisma.sql`
      SELECT ${column}::text AS "value", COUNT(*)::bigint AS "matches"
      FROM "ProductSnapshot" p
      WHERE p."shopDomain"=${shopDomain}
        AND STRPOS(LOWER(${column}),LOWER(${q}))>0
        AND ${column} <> ''
      GROUP BY ${column} ORDER BY COUNT(*) DESC,${column} ASC LIMIT ${LIMIT}
    `;
  }
  const rows=await db.$queryRaw<Row[]>(sql);
  return rows.filter(row=>typeof row.value==="string"&&row.value.length>0).map(row=>({
    value:row.value,
    label:kind==="collections"?humanise(row.value):row.value,
    count:Number(row.matches)||0,
  }));
}
