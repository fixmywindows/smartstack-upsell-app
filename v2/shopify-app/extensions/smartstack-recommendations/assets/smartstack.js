/* SmartStack v2 storefront renderer. Backend app proxy is provided by the Shopify React Router development server.
   Server MUST validate Shopify signed proxy request, store installation, and
   eligibility. A cart-line token is supporting evidence only; never bill based
   solely on an unverified cart property. */
(()=>{
  const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  function safeInternalUrl(value){try{const u=new URL(value,location.origin);return u.origin===location.origin?u.href:null;}catch{return null;}}
  async function render(block){
    if(block.dataset.smartstackLoaded)return;
    block.dataset.smartstackLoaded='1';
    const productId=block.dataset.productId;
    if(!/^\d+$/.test(String(productId)))return;
    try{
      const proxy=block.dataset.proxyPath||'/apps/smartstack';
      if(!proxy.startsWith('/')||proxy.startsWith('//'))return;
      const url=new URL(proxy.replace(/\/$/,'')+'/recommendations',location.origin);
      url.searchParams.set('product_id',productId);url.searchParams.set('kind',block.dataset.blockKind||'complement');url.searchParams.set('max',block.dataset.maxItems||'3');
      const response=await fetch(url,{credentials:'same-origin',headers:{'Accept':'application/json','ngrok-skip-browser-warning':'1'}});
      if(!response.ok)throw new Error('Recommendation endpoint returned HTTP '+response.status);
      const data=await response.json();
      if(!data||!Array.isArray(data.items)||!data.items.length)return;
      const heading=block.querySelector('.smartstack-recommendations__title');
      heading.textContent=block.dataset.heading||data.heading||'Recommended for you';
      const grid=block.querySelector('.smartstack-recommendations__grid');
      const max=Math.max(1,Math.min(8,Number(block.dataset.maxItems)||3));
      for(const item of data.items.slice(0,max)){
        if(!item.available)continue;
        const href=safeInternalUrl(item.url);
        if(!href)continue;
        const article=create('article','smartstack-recommendations__item');
        const link=create('a');link.href=href;
        if(item.imageUrl){const img=create('img','smartstack-recommendations__photo');img.loading='lazy';img.alt=String(item.title||'Product');img.src=String(item.imageUrl);link.append(img);}
        const detail=create('div','smartstack-recommendations__detail');
        detail.append(create('h3','smartstack-recommendations__product-name',item.title||'Product'));
        detail.append(create('p','smartstack-recommendations__price',item.priceFormatted||''));
        link.append(detail);article.append(link);
        const variantId=String(item.variantId||'');
        if(/^\d+$/.test(variantId)){
          const button=create('button','smartstack-recommendations__button','Add to basket');
          button.type='button';
          button.addEventListener('click',async()=>{
            button.disabled=true;
            try{
              // Token must be signed, minted server-side, and reconciled to line ID later.
              const props={}; // Commission tracking is intentionally disabled in the development pilot.
              const res=await fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items:[{id:Number(variantId),quantity:1,properties:props}]})});
              if(!res.ok)throw new Error('Unable to add item');
              button.textContent='Added to basket ✓';
              document.dispatchEvent(new CustomEvent('smartstack:cart-updated',{bubbles:true}));
            }catch{button.textContent='Try again';button.disabled=false;}
          });
          detail.append(button);
        }
        grid.append(article);
      }
      if(grid.childElementCount)block.hidden=false;
    }catch(error){
      // Fail closed: a network issue should never break the merchant's storefront.
      if(window.Shopify?.designMode){const msg=block.querySelector('.smartstack-recommendations__error');msg.textContent='SmartStack preview unavailable — '+(error instanceof Error ? error.message : 'check app proxy connection.');block.hidden=false;msg.hidden=false;}
    }
  }
  function initialise(){document.querySelectorAll('[data-smartstack-block]').forEach(render);}
  document.addEventListener('DOMContentLoaded',initialise);
  document.addEventListener('shopify:section:load',initialise);
  if(document.readyState!=='loading')initialise();
})();
