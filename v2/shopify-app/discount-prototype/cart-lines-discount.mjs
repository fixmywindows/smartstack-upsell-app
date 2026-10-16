/**
 * SmartStack Shopify Discount Function CORE — prototype only, NOT registered.
 *
 * Activation requires a separately generated Shopify Function extension,
 * app-owned discount configuration and merchant-approved write_discounts.
 * Do not trust cart attributes or browser-provided discount configuration.
 * Config MUST come only from discount.metafield(namespace:"$app",
 * key:"function-configuration").jsonValue.
 */
const isVariant=id=>typeof id==='string'&&/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id);
export function runBundleDiscount(input) {
  const conf=input?.discount?.metafield?.jsonValue;
  if(!conf || conf.active!==true || !Array.isArray(input?.cart?.lines) ||
    !input.discount?.discountClasses?.includes("PRODUCT"))return {operations:[]};
  const percentage=Number(conf.percentage);
  const required=conf.requiredVariantIds;
  const targets=conf.targetVariantIds;
  if(!Number.isFinite(percentage)||percentage<=0||percentage>30||
    !Array.isArray(required)||required.length<2||required.length>8||
    !Array.isArray(targets)||targets.length<1||targets.length>7 ||
    new Set(required).size!==required.length ||
    !required.every(isVariant)||!targets.every(isVariant) ||
    !targets.every(id=>required.includes(id)))return {operations:[]};
  const lines=input.cart.lines.filter(line=>line?.merchandise?.__typename==="ProductVariant"
    && isVariant(line.merchandise.id) && Number(line.quantity)>0);
  const present=new Set(lines.map(line=>line.merchandise.id));
  if(!required.every(id=>present.has(id)))return {operations:[]};
  const targetSet=new Set(targets);
  const candidates=lines.filter(line=>targetSet.has(line.merchandise.id))
    .map(line=>({
      message:String(conf.message||"SmartStack bundle saving").slice(0,60),
      targets:[{cartLine:{id:line.id}}],
      value:{percentage:{value:percentage.toFixed(1)}}
    }));
  if(!candidates.length)return {operations:[]};
  return {operations:[{productDiscountsAdd:{
    candidates,selectionStrategy:"ALL"
  }}]};
}
