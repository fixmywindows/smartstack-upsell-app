/**
 * Browser-safe SmartStack Design Studio configuration.
 * Never accepts arbitrary CSS, URLs, selectors, or JavaScript from merchants.
 * Public storefront responses contain only these safe presentation values.
 */
export const DESIGN_KINDS = ["similar","complement","bought_together","bundle"] as const;
export type DesignKind = typeof DESIGN_KINDS[number];
export type DesignPreset = "theme"|"minimal"|"editorial"|"bold";
export type DesignSettings = {
  preset: DesignPreset;
  layout: "grid"|"carousel"|"compact";
  cardStyle: "minimal"|"bordered"|"soft";
  imageFit: "contain"|"cover";
  imageRatio: "square"|"portrait"|"landscape";
  desktopColumns: 2|3|4;
  mobileColumns: 1|2;
  cardGap: number;
  cardRadius: number;
  showPrice: boolean;
  showTitle: boolean;
  showImage: boolean;
  showVendor: boolean;
  showQuickAdd: boolean;
  buttonStyle: "match"|"solid"|"outline"|"text";
  headingAlign: "left"|"center";
  showHeading: boolean;
  bundleLayout: "list"|"cards";
  buttonColor: string; // empty means automatic theme matching
  borderColor: string;
  headingColor: string;
  titleColor: string;
  priceColor: string;
  cardBackground: string;
  cardPadding: number;
  borderWidth: number;
  imageMaxHeight: number;
  shadow: "none"|"subtle"|"raised";
  hoverEffect: "none"|"lift"|"zoom";
  textAlign: "left"|"center";
  buttonFullWidth: boolean;
  headingFontSize: number; // 0 = inherit theme
  titleFontSize: number;
  priceFontSize: number;
  headingFontWeight: number; // 0 = inherit theme
  titleFontWeight: number;
  priceFontWeight: number;
  headingItalic: boolean;
  titleItalic: boolean;
  priceItalic: boolean;
  customCss: string;
};

const PRESET_DEFAULTS: Record<DesignPreset,Partial<DesignSettings>> = {
  theme: {
    cardStyle:"minimal", imageFit:"contain", imageRatio:"square",
    showQuickAdd:false, buttonStyle:"match", cardGap:16, cardRadius:8,
    headingAlign:"left", showPrice:true, showVendor:false,
  },
  minimal: {
    cardStyle:"minimal", imageFit:"contain", imageRatio:"square",
    showQuickAdd:false, buttonStyle:"text", cardGap:12, cardRadius:0,
    headingAlign:"left", showPrice:true, showVendor:false,
  },
  editorial: {
    cardStyle:"minimal", imageFit:"cover", imageRatio:"portrait",
    showQuickAdd:false, buttonStyle:"outline", cardGap:20, cardRadius:0,
    headingAlign:"left", showPrice:true, showVendor:true,
  },
  bold: {
    cardStyle:"bordered", imageFit:"contain", imageRatio:"square",
    showQuickAdd:true, buttonStyle:"solid", cardGap:16, cardRadius:14,
    headingAlign:"left", showPrice:true, showVendor:false,
  },
};

export const presets = [
  {id:"theme",title:"Match my store",description:"Inherit typography and button styling from the active theme."},
  {id:"minimal",title:"Minimal",description:"Borderless product cards with understated text links."},
  {id:"editorial",title:"Editorial",description:"Image-first product merchandising with taller photography."},
  {id:"bold",title:"Bold",description:"Stronger product cards and visible shopping actions."},
] as const;

const perKind = (kind:DesignKind) => ({
  layout:kind==="bought_together" ? "compact" as const : "grid" as const,
  bundleLayout:"list" as const,
  desktopColumns:3 as const,
  mobileColumns:2 as const,
  showHeading:true,
  buttonColor:"",
  showTitle:true,showImage:true,
  borderColor:"",headingColor:"",titleColor:"",priceColor:"",cardBackground:"",
  cardPadding:0,borderWidth:1,imageMaxHeight:440,
  shadow:"none" as const,hoverEffect:"none" as const,textAlign:"left" as const,buttonFullWidth:true,
  headingFontSize:0,titleFontSize:0,priceFontSize:0,
  headingFontWeight:0,titleFontWeight:0,priceFontWeight:0,
  headingItalic:false,titleItalic:false,priceItalic:false,customCss:"",
});

export function defaultDesign(kind:DesignKind, preset:DesignPreset="theme"):DesignSettings {
  return {
    preset,
    ...perKind(kind),
    ...PRESET_DEFAULTS[preset],
  } as DesignSettings;
}

function isChoice<T extends string>(value:unknown,choices:readonly T[],fallback:T):T {
  return typeof value==="string" && choices.includes(value as T) ? value as T : fallback;
}
function integer(value:unknown,min:number,max:number,fallback:number):number {
  const parsed=typeof value==="number"?value:Number(value);
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,Math.round(parsed))):fallback;
}
function isHex(value:unknown):value is string {
  return typeof value==="string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Deterministically whitelist every property before saving or exposing publicly. */
export function normaliseDesign(kind:DesignKind,raw:unknown):DesignSettings {
  const input=raw && typeof raw==="object" && !Array.isArray(raw)
    ? raw as Record<string,unknown> : {};
  const preset=isChoice(input.preset,["theme","minimal","editorial","bold"] as const,"theme");
  const base=defaultDesign(kind,preset);
  return {
    preset,
    layout:isChoice(input.layout,["grid","carousel","compact"] as const,base.layout),
    cardStyle:isChoice(input.cardStyle,["minimal","bordered","soft"] as const,base.cardStyle),
    imageFit:isChoice(input.imageFit,["contain","cover"] as const,base.imageFit),
    imageRatio:isChoice(input.imageRatio,["square","portrait","landscape"] as const,base.imageRatio),
    desktopColumns:integer(input.desktopColumns,2,4,base.desktopColumns) as 2|3|4,
    mobileColumns:integer(input.mobileColumns,1,2,base.mobileColumns) as 1|2,
    cardGap:integer(input.cardGap,8,32,base.cardGap),
    cardRadius:integer(input.cardRadius,0,24,base.cardRadius),
    showPrice:typeof input.showPrice==="boolean"?input.showPrice:base.showPrice,
    showTitle:typeof input.showTitle==="boolean"?input.showTitle:base.showTitle,
    showImage:typeof input.showImage==="boolean"?input.showImage:base.showImage,
    showVendor:typeof input.showVendor==="boolean"?input.showVendor:base.showVendor,
    showQuickAdd:typeof input.showQuickAdd==="boolean"?input.showQuickAdd:base.showQuickAdd,
    buttonStyle:isChoice(input.buttonStyle,["match","solid","outline","text"] as const,base.buttonStyle),
    headingAlign:isChoice(input.headingAlign,["left","center"] as const,base.headingAlign),
    showHeading:typeof input.showHeading==="boolean"?input.showHeading:base.showHeading,
    bundleLayout:isChoice(input.bundleLayout,["list","cards"] as const,base.bundleLayout),
    buttonColor:isHex(input.buttonColor)?input.buttonColor:"",
    borderColor:isHex(input.borderColor)?input.borderColor:"",
    headingColor:isHex(input.headingColor)?input.headingColor:"",
    titleColor:isHex(input.titleColor)?input.titleColor:"",
    priceColor:isHex(input.priceColor)?input.priceColor:"",
    cardBackground:isHex(input.cardBackground)?input.cardBackground:"",
    cardPadding:integer(input.cardPadding,0,32,base.cardPadding),
    borderWidth:integer(input.borderWidth,0,3,base.borderWidth),
    imageMaxHeight:integer(input.imageMaxHeight,80,600,base.imageMaxHeight),
    shadow:isChoice(input.shadow,["none","subtle","raised"] as const,base.shadow),
    hoverEffect:isChoice(input.hoverEffect,["none","lift","zoom"] as const,base.hoverEffect),
    textAlign:isChoice(input.textAlign,["left","center"] as const,base.textAlign),
    buttonFullWidth:typeof input.buttonFullWidth==="boolean"?input.buttonFullWidth:base.buttonFullWidth,
    headingFontSize:integer(input.headingFontSize,0,40,0),
    titleFontSize:integer(input.titleFontSize,0,24,0),
    priceFontSize:integer(input.priceFontSize,0,24,0),
    headingFontWeight:integer(input.headingFontWeight,0,800,0),
    titleFontWeight:integer(input.titleFontWeight,0,800,0),
    priceFontWeight:integer(input.priceFontWeight,0,800,0),
    headingItalic:typeof input.headingItalic==="boolean"?input.headingItalic:false,
    titleItalic:typeof input.titleItalic==="boolean"?input.titleItalic:false,
    priceItalic:typeof input.priceItalic==="boolean"?input.priceItalic:false,
    customCss:typeof input.customCss==="string"?input.customCss.slice(0,2400):"",
  };
}

export function isAdvancedDesign(design:DesignSettings,kind:DesignKind):boolean {
  // Free: theme-matching and minimal design, plus useful on/off display controls.
  // Growth/Insights: all layouts, card dimensions, custom colours and editorial presets.
  if (design.preset!=="theme" && design.preset!=="minimal") return true;
  const base=defaultDesign(kind,design.preset);
  return (design.cardStyle!==base.cardStyle && design.cardStyle!=="bordered") ||
    design.imageFit!==base.imageFit || design.imageRatio!==base.imageRatio ||
    design.desktopColumns!==base.desktopColumns || design.mobileColumns!==base.mobileColumns ||
    design.cardGap!==base.cardGap || design.cardRadius!==base.cardRadius ||
    design.buttonStyle!==base.buttonStyle || design.headingAlign!==base.headingAlign ||
    design.bundleLayout!==base.bundleLayout ||
    [design.buttonColor,design.borderColor,design.headingColor,design.titleColor,
      design.priceColor,design.cardBackground,design.customCss].some(Boolean) ||
    design.cardPadding!==base.cardPadding || design.borderWidth!==base.borderWidth ||
    design.imageMaxHeight!==base.imageMaxHeight ||
    design.shadow!==base.shadow || design.hoverEffect!==base.hoverEffect ||
    design.textAlign!==base.textAlign || design.buttonFullWidth!==base.buttonFullWidth ||
    design.headingFontSize!==0 || design.titleFontSize!==0 || design.priceFontSize!==0 ||
    design.headingFontWeight!==0 || design.titleFontWeight!==0 || design.priceFontWeight!==0 ||
    design.headingItalic || design.titleItalic || design.priceItalic;
}

export function canSaveDesign(plan:string,settings:DesignSettings,kind:DesignKind):boolean {
  return plan==="growth" || plan==="insights" || !isAdvancedDesign(settings,kind);
}


/**
 * Paid CSS is not arbitrary storefront CSS. Merchants can style only the
 * documented aliases below. The compiler scopes all rules to one SmartStack
 * block type; outside selectors, @rules, URL/exfiltration and animations are
 * rejected. This never applies to Shopify's global theme styles.
 */
const CSS_ALIASES:Record<string,string>={
  ".ss-card":".smartstack-recommendations__item",
  ".ss-image":".smartstack-recommendations__photo",
  ".ss-title":".smartstack-recommendations__product-name",
  ".ss-price":".smartstack-recommendations__price",
  ".ss-button":".smartstack-recommendations__button",
  ".ss-heading":".smartstack-recommendations__title",
  ".ss-vendor":".smartstack-recommendations__vendor",
  ".ss-detail":".smartstack-recommendations__detail",
};
const CSS_PROPERTIES=new Set([
  "color","background-color","border-color","border-width","border-radius",
  "font-size","font-weight","font-style","line-height","letter-spacing",
  "text-align","text-decoration","text-transform","padding","margin",
  "opacity","max-width","max-height","object-fit","box-shadow"
]);
export function compileScopedCss(kind:DesignKind,input:string):string{
  if(!input.trim())return "";
  if(input.length>2400 || /@|\/\*|\*\/|url\s*\(|expression\s*\(|var\s*\(/i.test(input)){
    throw Error("Custom CSS allows simple component declarations only. Imports, URLs and variables are blocked.");
  }
  const regex=/([^{}]+)\{([^{}]*)\}/g;
  const blocks=[...input.matchAll(regex)];
  if(!blocks.length||blocks.length>12||input.replace(regex,"").trim()){
    throw Error("CSS must use component aliases such as .ss-title { color: #333333; }");
  }
  const result=[];
  for(const [,rawSelector,rawBody] of blocks){
    const selector=rawSelector.trim(),mapped=CSS_ALIASES[selector];
    if(!mapped)throw Error("Unsupported CSS selector: "+selector);
    const declarations=rawBody.split(";").map(x=>x.trim()).filter(Boolean);
    if(!declarations.length||declarations.length>18)throw Error("Each CSS rule needs 1–18 declarations.");
    const clean=[];
    for(const declaration of declarations){
      const idx=declaration.indexOf(":");
      if(idx<1)throw Error("Invalid CSS property.");
      const property=declaration.slice(0,idx).trim().toLowerCase();
      const value=declaration.slice(idx+1).trim();
      if(!CSS_PROPERTIES.has(property)||!value||value.length>90||
        /[{}<>\\@]|!important|url|expression|javascript|behavior|filter/i.test(value)||
        !/^[\w\d\s#.,()%/+*-]+$/.test(value)){
        throw Error("Unsupported or unsafe CSS declaration: "+property);
      }
      clean.push(property+":"+value);
    }
    result.push('.smartstack-recommendations[data-block-kind="'+kind+'"] '+mapped+
      '{'+clean.join(';')+'}');
  }
  return result.join("\n");
}
