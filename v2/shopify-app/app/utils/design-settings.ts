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
  showVendor: boolean;
  showQuickAdd: boolean;
  buttonStyle: "match"|"solid"|"outline"|"text";
  headingAlign: "left"|"center";
  showHeading: boolean;
  bundleLayout: "list"|"cards";
  buttonColor: string; // empty means automatic theme matching
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
    showVendor:typeof input.showVendor==="boolean"?input.showVendor:base.showVendor,
    showQuickAdd:typeof input.showQuickAdd==="boolean"?input.showQuickAdd:base.showQuickAdd,
    buttonStyle:isChoice(input.buttonStyle,["match","solid","outline","text"] as const,base.buttonStyle),
    headingAlign:isChoice(input.headingAlign,["left","center"] as const,base.headingAlign),
    showHeading:typeof input.showHeading==="boolean"?input.showHeading:base.showHeading,
    bundleLayout:isChoice(input.bundleLayout,["list","cards"] as const,base.bundleLayout),
    buttonColor:isHex(input.buttonColor)?input.buttonColor:"",
  };
}

export function isAdvancedDesign(design:DesignSettings,kind:DesignKind):boolean {
  // Free: theme-matching and minimal design, plus useful on/off display controls.
  // Growth/Insights: all layouts, card dimensions, custom colours and editorial presets.
  if (design.preset!=="theme" && design.preset!=="minimal") return true;
  const base=defaultDesign(kind,design.preset);
  return design.cardStyle!==base.cardStyle ||
    design.imageFit!==base.imageFit || design.imageRatio!==base.imageRatio ||
    design.desktopColumns!==base.desktopColumns || design.mobileColumns!==base.mobileColumns ||
    design.cardGap!==base.cardGap || design.cardRadius!==base.cardRadius ||
    design.buttonStyle!==base.buttonStyle || design.headingAlign!==base.headingAlign ||
    design.bundleLayout!==base.bundleLayout ||
    design.buttonColor!=="";
}

export function canSaveDesign(plan:string,settings:DesignSettings,kind:DesignKind):boolean {
  return plan==="growth" || plan==="insights" || !isAdvancedDesign(settings,kind);
}
