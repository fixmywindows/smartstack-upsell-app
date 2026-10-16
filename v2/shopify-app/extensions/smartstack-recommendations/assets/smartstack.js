/* SmartStack storefront recommendations — independent OS 2.0 theme blocks.
 * The Shopify app proxy authenticates requests. Tracking and checkout discounts are disabled.
 * Each block initialises independently, including re-rendered theme-editor blocks.
 */
(() => {
  const PREVIEW_VERSION = '0.3.0';
  const previous = window.__smartstackRenderer;
  if (previous?.version === PREVIEW_VERSION) { previous.scan(); return; }
  previous?.dispose?.();

  const states = new WeakMap();
  const isEditor = () => Boolean(window.Shopify?.designMode);
  const create = (tag, cls, value) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (value !== undefined && value !== null) element.textContent = String(value);
    return element;
  };
  const onlyDigits = value => /^\d+$/.test(String(value ?? ''));
  const validVariantId = value => {
    if (!onlyDigits(value)) return false;
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0;
  };
  const safePath = value => {
    try {
      const url = new URL(String(value ?? ''), location.origin);
      return url.origin === location.origin && /^https?:$/.test(url.protocol) ? url.pathname + url.search : null;
    } catch { return null; }
  };
  const money = (minor, currency) => {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en-GB', {
        style: 'currency', currency: currency || 'GBP'
      }).format((Number(minor) || 0) / 100);
    } catch { return ((Number(minor) || 0) / 100).toFixed(2); }
  };
  const cartRoot = () => {
    const configured = window.Shopify?.routes?.root;
    return typeof configured === 'string' && configured.startsWith('/') ? configured.replace(/\/?$/, '/') : '/';
  };
  const viewCart = () => cartRoot() + 'cart';

  const presets = {
    theme: {cardStyle:'minimal',imageFit:'contain',imageRatio:'square',showQuickAdd:false,buttonStyle:'match'},
    minimal: {cardStyle:'minimal',imageFit:'contain',imageRatio:'square',showQuickAdd:false,buttonStyle:'text'},
  };
  const validEnum = (candidate,choices,fallback) => choices.includes(candidate) ? candidate : fallback;
  const clamp = (value,min,max,fallback) => {
    const num=Number(value);
    return Number.isFinite(num)?Math.min(max,Math.max(min,Math.round(num))):fallback;
  };
  const cssHex = value => typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value.trim());

  function themeButtons() {
    const selectors=[
      'product-form button[type="submit"]',
      '.product-form__submit',
      'form[action*="/cart/add"] button[type="submit"]',
      'button[name="add"]',
      '.product__info-container .button'
    ];
    for(const selector of selectors){
      const node=document.querySelector(selector);
      if(node && !node.closest('[data-smartstack-block]')) return node;
    }
    return null;
  }
  const isOpaqueColor = value => typeof value==='string' &&
    (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgb\(/.test(value) || /^hsl\(/.test(value)) &&
    !/rgba\([^)]+,\s*0(?:\.0+)?\)/.test(value) && value!=='transparent';

  function getDesign(block,studio) {
    const kind=block.dataset.blockKind || 'complement';
    const source=block.dataset.styleSource === 'block' ? 'block' : 'studio';
    const defaults=kind==='bought_together'?{layout:'compact'}:{layout:'grid'};
    const base={...defaults,...presets.theme,
      showHeading:true,showPrice:true,showVendor:false,desktopColumns:3,mobileColumns:2,
      cardGap:16,cardRadius:8,bundleLayout:'list',headingAlign:'left',buttonColor:''};
    const design=source==='studio' && studio && typeof studio==='object' ? {...base,...studio} : {
      ...base,
      layout:block.dataset.layout||'grid',
      cardStyle:block.classList.contains('smartstack-recommendations--minimal')?'minimal':
        block.classList.contains('smartstack-recommendations--soft')?'soft':'bordered',
      imageRatio:block.dataset.imageRatio||'square',
      imageFit:block.dataset.imageFit||'contain',
      showQuickAdd:block.dataset.showQuickAdd!=='false',
      showPrice:block.dataset.showPrice!=='false',
      showVendor:block.dataset.showVendor==='true',
      buttonStyle:block.dataset.buttonStyle||'match',
      desktopColumns:block.style.getPropertyValue('--ss-cols').trim()||3,
      mobileColumns:block.style.getPropertyValue('--ss-mobile-cols').trim()||2,
      cardGap:parseFloat(block.style.getPropertyValue('--ss-gap'))||16,
      cardRadius:parseFloat(block.style.getPropertyValue('--ss-radius'))||8,
      buttonColor:block.style.getPropertyValue('--ss-accent').trim(),
    };
    const quick=block.dataset.quickAddOverride;
    if(quick==='show') design.showQuickAdd=true;
    if(quick==='hide') design.showQuickAdd=false;
    const price=block.dataset.priceOverride;
    if(price==='show') design.showPrice=true;
    if(price==='hide') design.showPrice=false;
    design.layout=validEnum(design.layout,['grid','carousel','compact'],base.layout);
    design.cardStyle=validEnum(design.cardStyle,['minimal','bordered','soft'],'minimal');
    design.imageFit=validEnum(design.imageFit,['contain','cover'],'contain');
    design.imageRatio=validEnum(design.imageRatio,['square','portrait','landscape'],'square');
    design.buttonStyle=validEnum(design.buttonStyle,['match','solid','outline','text'],'match');
    design.bundleLayout=validEnum(design.bundleLayout,['list','cards'],'list');
    design.headingAlign=validEnum(design.headingAlign,['left','center'],'left');
    design.cardGap=clamp(design.cardGap,8,32,16);
    design.cardRadius=clamp(design.cardRadius,0,24,8);
    design.desktopColumns=clamp(design.desktopColumns,2,4,3);
    design.mobileColumns=clamp(design.mobileColumns,1,2,2);
    return design;
  }

  function applyDesign(block,design) {
    block.__ssDesign=design;
    block.dataset.ssCardStyle=design.cardStyle;
    block.dataset.ssButtonStyle=design.buttonStyle;
    block.dataset.ssPreset=design.preset||'theme';
    block.style.setProperty('--ss-gap',design.cardGap+'px');
    block.style.setProperty('--ss-radius',design.cardRadius+'px');
    block.style.setProperty('--ss-cols',String(design.desktopColumns));
    block.style.setProperty('--ss-mobile-cols',String(design.mobileColumns));
    block.style.setProperty('--ss-image-ratio',
      design.imageRatio==='portrait'?'4 / 5':design.imageRatio==='landscape'?'4 / 3':'1 / 1');
    block.style.setProperty('--ss-image-fit',design.imageFit);

    let bg='#24252a',fg='#fff',radius=design.cardRadius+'px',size='.875rem',border='transparent';
    const buyButton=themeButtons();
    if(buyButton){
      const style=getComputedStyle(buyButton);
      if(isOpaqueColor(style.backgroundColor)) bg=style.backgroundColor;
      if(isOpaqueColor(style.color)) fg=style.color;
      if(style.borderRadius && style.borderRadius!=='0px') radius=style.borderRadius;
      if(style.fontSize) size=style.fontSize;
      if(isOpaqueColor(style.borderTopColor) && style.borderTopWidth!=='0px')border=style.borderTopColor;
    }
    if(cssHex(design.buttonColor)) bg=design.buttonColor;
    block.style.setProperty('--ss-button-bg',bg);
    block.style.setProperty('--ss-button-fg',fg);
    block.style.setProperty('--ss-button-border',border);
    block.style.setProperty('--ss-button-radius',radius);
    block.style.setProperty('--ss-button-size',size);
    const header=block.querySelector('.smartstack-recommendations__head');
    if(header)header.dataset.align=design.headingAlign;
  }


  function showStatus(block, message) {
    const status = block.querySelector('.smartstack-recommendations__status');
    const content = block.querySelector('.smartstack-recommendations__content');
    if (content) content.hidden = true;
    if (!isEditor()) {
      block.hidden = true;
      if (status) status.hidden = true;
      return;
    }
    block.hidden = false;
    if (status) { status.textContent = message; status.hidden = false; }
  }

  async function addToCart(items) {
    const valid = items.every(item => validVariantId(item.id) && Number(item.quantity) > 0);
    if (!valid) throw new Error('One of the products needs a variant selection');
    const response = await fetch(cartRoot() + 'cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({items: items.map(item => ({
        id: Number(item.id), quantity: Math.max(1, Math.floor(Number(item.quantity)))
      }))})
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(typeof payload.description === 'string'
        ? payload.description.slice(0, 160)
        : 'Could not add the selected products');
    }
    document.dispatchEvent(new CustomEvent('smartstack:cart-updated', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
  }

  function feedback(container, text, withCartLink = false) {
    container.replaceChildren();
    const status = create('p', 'smartstack-recommendations__cart-feedback', text);
    status.setAttribute('role', 'status');
    if (withCartLink) {
      status.append(' ');
      const link = create('a', '', 'View basket');
      link.href = viewCart();
      status.append(link);
    }
    container.append(status);
  }

  function makeCard(item, block) {
    const href = safePath(item.url);
    if (!href) return null;
    const article = create('article', 'smartstack-recommendations__item');
    const media = create('a', 'smartstack-recommendations__media');
    media.href = href;
    media.setAttribute('aria-label', 'View ' + (item.title || 'product'));
    if (item.imageUrl) {
      const image = create('img', 'smartstack-recommendations__photo');
      image.src = String(item.imageUrl);
      image.alt = item.title || 'Product';
      image.loading = 'lazy';
      image.decoding = 'async';
      media.append(image);
    } else {
      media.append(create('div', 'smartstack-recommendations__image-fallback', 'Image coming soon'));
    }
    article.append(media);

    const detail = create('div', 'smartstack-recommendations__detail');
    const link = create('a', 'smartstack-recommendations__product-link');
    link.href = href;
    link.append(create('h3', 'smartstack-recommendations__product-name', item.title || 'Product'));
    detail.append(link);
    const design=block.__ssDesign||{};
    if (design.showVendor && item.vendor) detail.prepend(create('span','smartstack-recommendations__vendor',item.vendor));
    if (design.showPrice !== false && item.priceFormatted) {
      detail.append(create('p', 'smartstack-recommendations__price', item.priceFormatted));
    }
    if (design.showQuickAdd) {
      const button = create('button', 'smartstack-recommendations__button',
        validVariantId(item.variantId) ? 'Add to basket' : 'View options');
      button.type = 'button';
      if (validVariantId(item.variantId)) {
        const note = create('div', '');
        button.addEventListener('click', async () => {
          button.disabled = true;
          button.textContent = 'Adding…';
          try {
            await addToCart([{id:item.variantId, quantity:1}]);
            button.textContent = 'Added ✓';
            feedback(note, 'Added to your basket.', true);
          } catch (error) {
            button.textContent = 'Try again';
            button.disabled = false;
            feedback(note, error instanceof Error ? error.message : 'Please try again');
          }
        });
        detail.append(button, note);
      } else {
        button.addEventListener('click', () => { location.href = href; });
        detail.append(button);
      }
    }
    article.append(detail);
    return article;
  }

  function makeCardCollection(block, items) {
    const grid = create('div', 'smartstack-recommendations__products');
    const layout = block.__ssDesign?.layout || 'grid';
    grid.dataset.layout = layout;
    for (const item of items) {
      if (!item.available) continue;
      const card = makeCard(item, block);
      if (card) grid.append(card);
    }
    return grid;
  }

  function selectedVariant(block, fallback) {
    // Merchants' themes generally update their product form variant input.
    // Read it at click time so bundle add-to-cart does not use a stale source variant.
    const form = document.querySelector('form[action*="/cart/add"] input[name="id"]');
    if (form && validVariantId(form.value)) return form.value;
    const liquidVariant = block.dataset.sourceVariantId;
    return validVariantId(liquidVariant) ? liquidVariant : fallback;
  }

  function makeBundle(block, data) {
    const source = data.source;
    if (!source || !validVariantId(source.variantId)) return null;
    const candidates = data.items.filter(item => item.available && validVariantId(item.variantId)).slice(0, 3);
    if (!candidates.length) return null;
    const wrap = create('div', 'smartstack-recommendations__bundle');
    wrap.dataset.layout=block.__ssDesign?.bundleLayout==='cards'?'cards':'list';
    const list = create('div', 'smartstack-recommendations__bundle-list');
    const selected = new Set(candidates.map(item => String(item.id)));

    const makeRow = (item, original) => {
      const row = create('div', 'smartstack-recommendations__bundle-row');
      const tick = create('input');
      tick.type = 'checkbox';
      tick.checked = true;
      if (original) {
        tick.disabled = true;
        tick.setAttribute('aria-label','Current product included in the set');
      } else {
        tick.setAttribute('aria-label', 'Include ' + item.title);
        tick.addEventListener('change', () => {
          if (tick.checked) selected.add(String(item.id));
          else selected.delete(String(item.id));
          update();
        });
      }
      row.append(tick);
      if (item.imageUrl) {
        const picture = create('img');
        picture.src = String(item.imageUrl);
        picture.alt = item.title || 'Product';
        picture.loading = 'lazy';
        row.append(picture);
      } else {
        const fallback = create('span', 'smartstack-recommendations__image-fallback', 'No image');
        row.append(fallback);
      }
      const info = create('div', 'smartstack-recommendations__bundle-info');
      const title = create('a', '', item.title || 'Product');
      title.href = safePath(item.url) || '#';
      info.append(title);
      if (original) info.append(create('small', '', 'Current product'));
      row.append(info);
      row.append(create('strong', 'smartstack-recommendations__bundle-price', money(item.priceMinor, item.currencyCode || source.currencyCode)));
      return row;
    };

    list.append(makeRow(source, true));
    candidates.forEach(item => list.append(makeRow(item, false)));
    wrap.append(list);
    const summary = create('div', 'smartstack-recommendations__bundle-summary');
    const totalLabel = create('span', '', 'Set total');
    const totalValue = create('strong','smartstack-recommendations__bundle-total');
    summary.append(totalLabel,totalValue);
    wrap.append(summary);

    const add = create('button','smartstack-recommendations__button','Add selected set to basket');
    add.type = 'button';
    const note = create('div', '');
    const discountNote = create('p','smartstack-recommendations__bundle-note',
      'No bundle discount is applied yet. Final prices are confirmed in your basket.');
    wrap.append(add, discountNote, note);

    function update() {
      const chosen = candidates.filter(item => selected.has(String(item.id)));
      totalValue.textContent = money(
        (Number(source.priceMinor) || 0) + chosen.reduce((sum,item) => sum + (Number(item.priceMinor)||0),0),
        source.currencyCode
      );
      add.disabled = chosen.length === 0;
      add.textContent = chosen.length ? 'Add ' + (chosen.length+1) + ' items to basket' : 'Select at least one add-on';
    }
    add.addEventListener('click', async () => {
      const items = [{id:selectedVariant(block,source.variantId),quantity:1},
        ...candidates.filter(item => selected.has(String(item.id))).map(item => ({id:item.variantId,quantity:1}))];
      if (items.length < 2) return;
      add.disabled = true;
      add.textContent = 'Adding set…';
      try {
        await addToCart(items);
        add.textContent = 'Added to basket ✓';
        feedback(note, 'Your selected set has been added.', true);
      } catch (error) {
        feedback(note, error instanceof Error ? error.message : 'Unable to add set');
        update();
      }
    });
    update();
    return wrap;
  }

  async function render(block, force = false) {
    const id = block.dataset.productId;
    if (!onlyDigits(id)) return;
    const kind = block.dataset.blockKind || 'complement';
    const signature = [
      id,kind,block.dataset.maxItems,block.dataset.heading,block.dataset.layout,
      block.dataset.showQuickAdd,block.dataset.sourceVariantId,
      block.dataset.styleSource,block.dataset.quickAddOverride,block.dataset.priceOverride,
      block.dataset.imageRatio,block.dataset.imageFit,block.dataset.buttonStyle
    ].join('|');
    if (!force && states.get(block) === signature) return;
    states.set(block,signature);
    showStatus(block,'Loading recommendation preview…');
    try {
      const root = block.dataset.proxyPath || '/apps/smartstack';
      if (!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(root)) throw new Error('Invalid app proxy path');
      const url = new URL(root.replace(/\/$/, '') + '/recommendations',location.origin);
      url.searchParams.set('product_id',id);
      url.searchParams.set('kind',kind);
      url.searchParams.set('max',block.dataset.maxItems || '3');
      const response = await fetch(url,{
        credentials:'same-origin',
        headers:{'Accept':'application/json','ngrok-skip-browser-warning':'1'}
      });
      if (!response.ok) throw new Error('App proxy returned HTTP ' + response.status);
      const type = response.headers.get('content-type') || '';
      if (!type.includes('json')) throw new Error('App proxy returned HTML instead of recommendations');
      const data = await response.json();
      if (states.get(block) !== signature) return;
      if (!data || !Array.isArray(data.items)) throw new Error('Unexpected recommendation response');
      const design=getDesign(block,data.design);
      applyDesign(block,design);

      const valid = data.items.filter(item => item.available && safePath(item.url));
      const body = block.querySelector('.smartstack-recommendations__body');
      const content = block.querySelector('.smartstack-recommendations__content');
      const status = block.querySelector('.smartstack-recommendations__status');
      const heading = block.querySelector('.smartstack-recommendations__title');
      if (!body || !content || !heading) return;

      const chosen = kind === 'bundle' ? makeBundle(block,data) : makeCardCollection(block,valid);
      if (!chosen || (kind !== 'bundle' && !chosen.children.length)) {
        showStatus(block, (data.warning || 'No eligible recommendations for this product.') +
          ' Try another preview product or adjust your SmartStack matching rules.');
        return;
      }
      const customHeading = String(block.dataset.heading || '').trim();
      // Legacy app blocks were saved with "Pairs perfectly with" regardless of type.
      const legacyDefault = customHeading === 'Pairs perfectly with' && kind !== 'complement';
      heading.textContent = customHeading && !legacyDefault ? customHeading : (data.heading || 'Recommended products');
      const head=block.querySelector('.smartstack-recommendations__head');
      if(head)head.hidden=design.showHeading===false;
      body.replaceChildren(chosen);
      content.hidden = false;
      if (status) status.hidden = true;
      block.hidden = false;
    } catch (error) {
      if (states.get(block) !== signature) return;
      showStatus(block, 'SmartStack preview unavailable: ' +
        (error instanceof Error ? error.message : 'check app proxy connection'));
    }
  }

  function scan(root, force=false) {
    if (root?.matches?.('[data-smartstack-block]')) render(root,force);
    root?.querySelectorAll?.('[data-smartstack-block]').forEach(block => render(block,force));
  }
  const onSectionLoad = event => scan(event.target);
  const onBlockSelect = event => scan(event.target,true);
  const onReady = () => scan(document);

  document.addEventListener('shopify:section:load',onSectionLoad);
  document.addEventListener('shopify:block:select',onBlockSelect);
  document.addEventListener('DOMContentLoaded',onReady);
  let observer = null;
  if (isEditor() && window.MutationObserver) {
    observer = new MutationObserver(changes => {
      changes.forEach(change => change.addedNodes.forEach(node => {
        if (node.nodeType === 1) scan(node);
      }));
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  if (document.readyState !== 'loading') onReady();

  window.__smartstackRenderer = {
    version: PREVIEW_VERSION,
    scan: () => scan(document,true),
    dispose() {
      observer?.disconnect();
      document.removeEventListener('shopify:section:load',onSectionLoad);
      document.removeEventListener('shopify:block:select',onBlockSelect);
      document.removeEventListener('DOMContentLoaded',onReady);
    }
  };
})();
