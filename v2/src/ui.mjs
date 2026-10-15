import {products,pairs,defaultConfig} from './sample-data.mjs';
import {recommend,bundleTotals} from './engine.mjs';
import {PLANS,estimateMonthlyCharge,formatGBP} from './billing.mjs';
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deep=x=>JSON.parse(JSON.stringify(x));
const configs=Object.fromEntries(['similar','complement','bought_together','bundle'].map(kind=>[kind,{...deep(defaultConfig),kind,mode:kind==='bought_together'?'ai':'hybrid',maxItems:kind==='bundle'?3:3}]));
const state={kind:'complement',sourceId:'sofa-nova',view:'blocks',selected:new Set(),selectionReady:false,activePlan:'growth'};
const config=()=>configs[state.kind];
const exampleFor={similar:'sofa-nova',complement:'sofa-nova',bought_together:'sofa-nova',bundle:'sofa-nova'};
const notes={similar:'Similar products are ranked by category, product type, price and title similarity.',complement:'Only approved complementary categories are eligible; explicit compatibility mismatches are excluded.',bought_together:'When actual co-purchase records are missing, we clearly label inferred pairings as suggestions.',bundle:'A selectable set of up to four products, including the viewed product. Discounts need merchant approval.'};
let toastTimer;
function notify(t){const el=$('#toast');el.textContent=t;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2800);}
function renderSelectors(){
  $('#source-select').innerHTML=products.filter(p=>['sofas','football-goals','cameras','cat-carriers'].includes(p.category) && p.available).map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');
  $('#source-select').value=state.sourceId;
  const available=products.filter(p=>p.id!==state.sourceId&&p.available);
  $('#pin-select').innerHTML=available.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');
}
function renderControls(){
  const c=config();
  $$('[data-kind]').forEach(el=>{const active=el.dataset.kind===state.kind;el.classList.toggle('active',active);el.setAttribute('aria-selected',active?'true':'false');});
  $$('[data-mode]').forEach(el=>el.classList.toggle('active',el.dataset.mode===c.mode));
  $('#mode-help').textContent={ai:'Automatic attribute matching. Merchant-pinned items are not used in this mode.',manual:'Only manually selected eligible products will appear.',hybrid:'Manual products appear first; the engine fills remaining places.'}[c.mode];
  $('#count-select').innerHTML=(state.kind==='bundle'?[1,2,3]:[2,3,4,6,8]).map(i=>`<option value="${i}">${i} product${i===1?'':'s'}</option>`).join('');
  $('#count-select').value=String(c.maxItems);
  $('#max-hint').textContent=state.kind==='bundle'?'3 add-ons + source':'Up to 12';
  $('#bundle-controls').classList.toggle('hidden',state.kind!=='bundle');
  $('#discount-type').value=c.bundleDiscount.type;
  $('#discount-value').value=String(c.bundleDiscount.value);
  $('#exclude-tags').value=(c.excludeTags||[]).join(', ');
  const lookup=new Map(products.map(p=>[p.id,p]));
  $('#pins').innerHTML=c.pinnedIds.map(id=>`<span class="chip">${esc(lookup.get(id)?.title??id)} <button type="button" data-unpin="${esc(id)}" title="Remove pinned product">×</button></span>`).join('');
  const rules=c.ruleGroups[0]?.rules??[];
  $('#rule-list').innerHTML=rules.map((r,i)=>`<div class="rule-item"><b>AND</b> ${esc(r.field)} ${esc(r.op)} ${esc(r.value)}<button data-remove-rule="${i}" aria-label="Remove rule">×</button></div>`).join('');
  renderPreview();
}
function renderPreview(){
  const source=products.find(p=>p.id===state.sourceId);
  const c=config();const r=recommend({sourceId:source.id,products,pairs,config:c});
  $('#source-visual').textContent=source.emoji;
  $('#source-title').textContent=source.title;
  $('#source-price').textContent=formatGBP(source.priceCents);
  $('#preview-heading').textContent=r.heading;
  $('#preview-count').textContent=`${r.items.length} recommendation${r.items.length===1?'':'s'}`;
  $('#why').textContent=notes[state.kind];
  const itemIds=r.items.map(x=>x.product.id);
  if(state.kind==='bundle'){
    const validIds=new Set([source.id,...itemIds]);
    state.selected=new Set([...state.selected].filter(x=>validIds.has(x)));
    if(!state.selectionReady){state.selected=new Set(validIds);state.selectionReady=true;}
  } else {state.selected=new Set();state.selectionReady=false;}
  const cap=state.kind==='bundle';
  $('#recommendations').innerHTML=r.items.length?r.items.map(({product,evidence,count})=>{
    const label=evidence==='merchant'?'Hand-picked':evidence==='observed'?`${count} paired orders`:'Smart match';
    const selected=state.selected.has(product.id);
    return `<article class="reco-card ${selected?'selected':''}" ${cap?`data-toggle-item="${esc(product.id)}" role="checkbox" aria-checked="${selected}" tabindex="0"`:''}><div class="reco-image"><span>${esc(product.emoji)}</span>${cap?`<span class="checkmark">${selected?'✓':'+'}</span>`:''}</div><div class="reco-card-info"><span class="match-label">${esc(label)}</span><div class="reco-name">${esc(product.title)}</div><div class="reco-price">${formatGBP(product.priceCents)}</div></div></article>`;
  }).join(''):`<div class="empty-state">No suitable products found. Try removing an exclusion or adding a product manually.</div>`;
  $('#engine-warning').classList.toggle('hidden',!r.warning);
  $('#engine-warning').textContent=r.warning??'';
  if(cap){const items=[source,...r.items.map(x=>x.product)];const t=bundleTotals({items,selectedIds:[...state.selected],discount:c.bundleDiscount});
    $('#bundle-summary').classList.remove('hidden');
    $('#bundle-summary').innerHTML=`<div><small>Bundle subtotal</small><strong>${formatGBP(t.subtotalCents)}</strong>${t.savingCents?`<span class="saving">Save ${formatGBP(t.savingCents)}</span>`:''}</div><div><b>${formatGBP(t.totalCents)}</b><button class="btn btn-primary" id="demo-add-cart" ${t.numberOfItems<2?'disabled':''}>Add selected items →</button></div>${c.bundleDiscount.type!=='none' && !t.qualifies?`<p class="bundle-note">Select every product to unlock the bundle saving.</p>`:''}`;
  } else $('#bundle-summary').classList.add('hidden');
}
function changeKind(kind){state.kind=kind;state.sourceId=exampleFor[kind];state.selected=new Set();state.selectionReady=false;renderSelectors();renderControls();}
function switchView(view){state.view=view;$$('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$$('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${view}`));const titles={overview:'Overview',blocks:'Recommendation blocks',rules:'Matching rules',bundles:'Bundle settings',analytics:'Analytics',pricing:'Plans & billing'};$('#crumb').textContent=titles[view];renderOtherView();}
const pageTitle=(eyebrow,title,description)=>`<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div></div>`;
function renderOtherView(){
  const page=state.view;
  if(page==='overview'){$('#view-overview').innerHTML=`${pageTitle('YOUR WORKSPACE','Better product decisions start here.','Build smart recommendations, control the experience and measure what matters.')}<div class="stats-grid"><div class="stat"><span>Block types</span><b>4</b><small>Available on all plans</small></div><div class="stat"><span>Matching modes</span><b>3</b><small>Automatic, manual, hybrid</small></div><div class="stat"><span>Catalogue size</span><b>${products.length}</b><small>Sample products</small></div><div class="stat"><span>Engine tests</span><b>18</b><small>Passing at build time</small></div></div><div class="panel section-card"><h2>Ready to build your first block?</h2><p>Choose products and see how recommendations change. Real Shopify data sync and publishing are not connected in this demo.</p><button class="btn btn-primary" data-jump="blocks">Open Recommendation Studio →</button></div>`;}
  if(page==='rules'){$('#view-rules').innerHTML=`${pageTitle('RULES ENGINE','You decide what belongs together.','Create attribute filters and merchant overrides. The engine always respects compatibility, availability and exclusions.')}<div class="panel section-card"><h2>Supported matching fields</h2><div class="feature-list">${[['Tags','Contains, exact, any/all'],['Product title','Keywords and exclusions'],['Categories & product type','Same or specified'],['Metafields','Namespace/key/value'],['Vendor','Exact and exclusion'],['Price','Minimum and maximum'],['Stock','Available products only'],['Manual product IDs','Pinned recommendations']].map(([a,b])=>`<div><strong>${a}</strong><span>${b}</span></div>`).join('')}</div><button class="btn btn-primary" data-jump="blocks">Edit a block’s rules →</button></div>`;}
  if(page==='bundles'){$('#view-bundles').innerHTML=`${pageTitle('BUNDLE BUILDER','Sets that sell together.','Up to four products including the source, with an optional merchant-approved discount.')}<div class="panel section-card"><h2>Bundle pricing modes</h2><div class="feature-list"><div><strong>No discount</strong><span>Curated set, full prices</span></div><div><strong>Percentage</strong><span>e.g. 10% off the full set</span></div><div><strong>Fixed saving</strong><span>e.g. £15 off</span></div><div><strong>Fixed bundle price</strong><span>e.g. all items for £99</span></div></div><p class="muted">The prototype calculates previews, but publishing a real checkout discount needs Shopify Functions integration.</p><button class="btn btn-primary" data-jump="bundle">Try bundle preview →</button></div>`;}
  if(page==='analytics'){$('#view-analytics').innerHTML=`${pageTitle('INSIGHTS PLAN','Know what is working.','An example of the £45 dashboard. The values below are fictitious placeholders.')}<div class="notice">Demonstration only · No customer tracking or live Shopify revenue connected</div><div class="stats-grid"><div class="stat"><span>Attributed revenue</span><b>£4,820</b><small>Sample only</small></div><div class="stat"><span>Purchased add-ons</span><b>142</b><small>Sample only</small></div><div class="stat"><span>Product clicks</span><b>731</b><small>Sample only</small></div><div class="stat"><span>Attributed conversion</span><b>3.8%</b><small>Sample only</small></div></div><div class="panel section-card"><h2>Coming in the full Insights dashboard</h2><div class="feature-list"><div><strong>Sales attribution</strong><span>Order- and line-level visibility</span></div><div><strong>Product pairing performance</strong><span>Best and worst recommendations</span></div><div><strong>Block comparison</strong><span>Revenue and interaction metrics</span></div><div><strong>Historical trends</strong><span>Date, product and block filters</span></div></div></div>`;}
  if(page==='pricing'){
    $('#view-pricing').innerHTML=`${pageTitle('PLANS & BILLING','Grow without guesswork.','Every plan includes all four recommendation blocks, with lower commissions on paid tiers.')}<div class="pricing-grid">${Object.entries(PLANS).map(([id,p])=>`<div class="price-card ${id==='growth'?'featured':''}"><span>${p.name}</span><div class="price-large">${formatGBP(p.monthlyCents)}<small>/mo</small></div><div class="rate">${p.rate*100}% <small>qualifying add-on sales</small></div><p>${id==='free'?'Essential widgets and matching':id==='growth'?'Full design controls and advanced rules':'Advanced analytics and lowest commission'}</p></div>`).join('')}</div><div class="panel section-card"><h2>Monthly pricing calculator</h2><p>Estimate total costs at different attributed add-on sales volumes.</p><label for="sales-slider">Monthly qualifying add-on sales: <b id="sales-label">£3,000.00</b></label><input id="sales-slider" type="range" min="0" max="15000" step="250" value="3000"><div class="price-results" id="price-results"></div><p class="muted">Demo estimate only; final merchant billing will use verified line-level sales and Shopify's billing system.</p></div>`;renderPrices(3000);
  }
}
function renderPrices(pounds){$('#sales-label').textContent=formatGBP(pounds*100);$('#price-results').innerHTML=Object.keys(PLANS).map(id=>{const t=estimateMonthlyCharge(id,pounds*100);return `<div><span>${PLANS[id].name}</span><strong>${formatGBP(t.totalCents)}</strong></div>`;}).join('');}
$$('[data-kind]').forEach(b=>b.addEventListener('click',()=>changeKind(b.dataset.kind)));
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{config().mode=b.dataset.mode;renderControls();}));
$('#source-select').addEventListener('change',e=>{state.sourceId=e.target.value;state.selectionReady=false;renderSelectors();renderPreview();});
$('#count-select').addEventListener('change',e=>{config().maxItems=Number(e.target.value);renderPreview();});
$('#add-pin').addEventListener('click',()=>{const id=$('#pin-select').value;if(id&&!config().pinnedIds.includes(id)){config().pinnedIds.push(id);if(config().mode==='ai')config().mode='hybrid';renderControls();}});
$('#pins').addEventListener('click',e=>{const id=e.target.closest('[data-unpin]')?.dataset.unpin;if(!id)return;config().pinnedIds=config().pinnedIds.filter(x=>x!==id);renderControls();});
$('#exclude-tags').addEventListener('input',e=>{config().excludeTags=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);renderPreview();});
$('#add-rule').addEventListener('click',()=>{const value=$('#rule-value').value.trim();if(!value){notify('Enter a rule value');return;}const c=config();c.ruleGroups[0]??={logic:'AND',rules:[]};c.ruleGroups[0].rules.push({field:$('#rule-field').value,op:$('#rule-op').value,value});$('#rule-value').value='';renderControls();});
$('#rule-list').addEventListener('click',e=>{const i=e.target.closest('[data-remove-rule]')?.dataset.removeRule;if(i===undefined)return;config().ruleGroups[0].rules.splice(Number(i),1);renderControls();});
$('#discount-type').addEventListener('change',e=>{config().bundleDiscount.type=e.target.value;renderPreview();});
$('#discount-value').addEventListener('input',e=>{config().bundleDiscount.value=Number(e.target.value);renderPreview();});
$('#reset-config').addEventListener('click',()=>{const kind=state.kind;configs[kind]={...deep(defaultConfig),kind,mode:'hybrid',maxItems:3};renderControls();notify('Block settings reset');});
$('#preview-button').addEventListener('click',()=>{renderPreview();notify('Preview updated with current rules');});
$('#recommendations').addEventListener('click',e=>{const card=e.target.closest('[data-toggle-item]');if(!card)return;const id=card.dataset.toggleItem;if(state.selected.has(id))state.selected.delete(id);else state.selected.add(id);renderPreview();});
$('#recommendations').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const card=e.target.closest('[data-toggle-item]');if(card){e.preventDefault();card.click();}}});
$('#export-config').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:2,configs},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='smartstack-block-config.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),200);});
document.addEventListener('click',e=>{const j=e.target.closest('[data-jump]');if(j){if(j.dataset.jump==='bundle'){switchView('blocks');changeKind('bundle');}else switchView('blocks');}if(e.target.closest('#demo-add-cart'))notify('Demo only — no live cart was changed');});
document.addEventListener('input',e=>{if(e.target.id==='sales-slider')renderPrices(Number(e.target.value));});
renderSelectors();renderControls();
