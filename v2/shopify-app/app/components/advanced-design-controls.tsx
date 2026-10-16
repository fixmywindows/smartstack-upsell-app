import type { DesignSettings } from "../utils/design-settings";
type Props={design:DesignSettings;onChange:(key:keyof DesignSettings,value:any)=>void};
const field:React.CSSProperties={display:"grid",gap:5,fontSize:12,fontWeight:600};
const input:React.CSSProperties={padding:"8px",minHeight:36,border:"1px solid #d4d4df",
 borderRadius:8,width:"100%",background:"white"};
export function AdvancedDesignControls({design,onChange}:Props){
  const number=(key:keyof DesignSettings,name:string,min:number,max:number)=>
    <label style={field}>{name}<input style={input} type="number"
      min={min} max={max} value={Number(design[key])}
      onChange={e=>onChange(key,Number(e.target.value))}/></label>;
  const select=(key:keyof DesignSettings,name:string,choices:string[])=>
    <label style={field}>{name}<select style={input} value={String(design[key])}
      onChange={e=>onChange(key,e.target.value)}>
      {choices.map(x=><option key={x} value={x}>{x}</option>)}
    </select></label>;
  return <div style={{display:"grid",gap:15,marginTop:18}}>
    <strong>Product cards and images</strong>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
      {number("borderWidth","Border thickness (px)",0,3)}
      {number("cardPadding","Card padding (px)",0,32)}
      {number("imageMaxHeight","Maximum image height (px)",80,600)}
      {select("shadow","Shadow",["none","subtle","raised"])}
      {select("hoverEffect","Hover effect",["none","lift","zoom"])}
      {select("textAlign","Product text alignment",["left","center"])}
    </div>
    <strong>Typography</strong>
    <p style={{fontSize:12,margin:0}}>Font families always come from the Shopify theme. Set size or weight to 0 to inherit the theme style.</p>
    {(["heading","title","price"] as const).map(prefix=>{
      const sizeKey=(prefix+"FontSize") as keyof DesignSettings;
      const weightKey=(prefix+"FontWeight") as keyof DesignSettings;
      const italicKey=(prefix+"Italic") as keyof DesignSettings;
      return <div key={prefix} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 60px",gap:7,alignItems:"end"}}>
        <strong style={{fontSize:12,paddingBottom:10}}>{prefix}</strong>
        {number(sizeKey,"Size (px)",0,prefix==="heading"?40:24)}
        <label style={field}>Weight
          <select style={input} value={Number(design[weightKey])}
            onChange={e=>onChange(weightKey,Number(e.target.value))}>
            {[0,400,500,600,700,800].map(v=><option key={v} value={v}>{v||"Theme"}</option>)}
          </select>
        </label>
        <label style={{fontSize:11,paddingBottom:8}}>
          <input type="checkbox" checked={Boolean(design[italicKey])}
            onChange={e=>onChange(italicKey,e.target.checked)}/> Italic
        </label>
      </div>;
    })}
    <strong>Colours (leave blank for theme defaults)</strong>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
      {(["headingColor","titleColor","priceColor","borderColor","cardBackground","buttonColor"] as const)
        .map(key=><label key={key} style={field}>{key}
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <input type="color" value={design[key]||"#292539"}
              onChange={e=>onChange(key,e.target.value)} aria-label={key}/>
            <button type="button" onClick={()=>onChange(key,"")}
              style={{...input,width:"auto",cursor:"pointer",fontSize:11}}>Use theme</button>
          </div>
        </label>)}
    </div>
    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
      <input type="checkbox" checked={design.buttonFullWidth}
        onChange={e=>onChange("buttonFullWidth",e.target.checked)}/>
      Full-width Add to Basket button
    </label>
    <details style={{background:"#f6f2ff",borderRadius:10,padding:12}}>
      <summary style={{fontSize:13,fontWeight:700,cursor:"pointer"}}>
        Advanced custom CSS — Growth / Insights
      </summary>
      <p style={{fontSize:12,lineHeight:1.55}}>
        Supported selectors: .ss-card, .ss-image, .ss-title, .ss-price,
        .ss-button, .ss-heading, .ss-vendor and .ss-detail.
        Only visual declarations are accepted. Styles apply only to this SmartStack block type.
      </p>
      <textarea rows={6} maxLength={2400} value={design.customCss}
        onChange={e=>onChange("customCss",e.target.value)}
        aria-label="Custom CSS" placeholder={".ss-title { font-size: 18px; }"}
        style={{...input,fontFamily:"monospace",fontSize:12,minHeight:115}}/>
      <p style={{fontSize:11,marginBottom:0}}>
        Example: <code>.ss-card {"{"} border-radius: 12px; {"}"}</code>
      </p>
    </details>
  </div>;
}
