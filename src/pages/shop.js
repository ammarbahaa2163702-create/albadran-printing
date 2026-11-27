import { t, localize } from '../i18n/index.js';
import { formatCurrency, formatNumber, escapeHtml } from '../lib/format.js';
import { addToCart, showToast } from '../lib/store.js';
import { renderProductMedia } from '../components/productThumb.js';

const shopState = {
  search: '',
  categoryId: 'all',
  detailProductId: null,
  detailQty: 1,
};

function stockBadge(stock) {
  const n = Number(stock) || 0;
  if (n <= 0) return `<span class="stock-badge stock-out">${t('shop.outOfStock')}</span>`;
  if (n <= 5) return `<span class="stock-badge stock-low">${t('shop.lowStock', { n: formatNumber(n) })}</span>`;
  return `<span class="stock-badge stock-in">${t('shop.inStock')}</span>`;
}

export function renderShopPage(state) {
  const currency = state.shopInfo?.currency || 'EGP';
  const q = shopState.search.trim().toLowerCase();

  const filtered = (state.products || []).filter((p) => {
    if (shopState.categoryId !== 'all' && p.category_id !== shopState.categoryId) return false;
    if (!q) return true;
    return (
      (p.name_en || '').toLowerCase().includes(q) ||
      (p.name_ar || '').toLowerCase().includes(q) ||
      (p.description_en || '').toLowerCase().includes(q) ||
      (p.description_ar || '').toLowerCase().includes(q)
    );
  });

  const detailProd = shopState.detailProductId
    ? state.products.find((p) => p.id === shopState.detailProductId)
    : null;

  return `
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">${t('shop.title')}</h1>
        <p class="page-sub">${t('shop.subtitle')}</p>
      </div>

      <div class="shop-toolbar">
        <div class="search-box">
          <input id="shop-search-input" type="search" class="input" placeholder="${escapeHtml(t('shop.searchPlaceholder'))}" value="${escapeHtml(shopState.search)}" aria-label="${t('shop.searchPlaceholder')}" />
        </div>
        <div class="cat-pills" role="group" aria-label="Categories">
          <button type="button" class="pill-btn js-cat-btn ${shopState.categoryId === 'all' ? 'active' : ''}" data-id="all">${t('common.all')}</button>
          ${(state.categories || []).map((c) => `
            <button type="button" class="pill-btn js-cat-btn ${shopState.categoryId === c.id ? 'active' : ''}" data-id="${escapeHtml(c.id)}">
              ${escapeHtml(localize(c, 'name'))}
            </button>
          `).join('')}
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="card" style="text-align:center;padding:42px 20px;">
          <p class="section-sub">${t('shop.noResults')}</p>
        </div>
      ` : `
        <div class="grid-3">
          ${filtered.map((p) => {
            const name = localize(p, 'name');
            const out = Number(p.stock) <= 0;
            return `
              <article class="card product-card">
                <div>
                  <div class="product-img-wrap">${renderProductMedia(p, name)}</div>
                  ${stockBadge(p.stock)}
                  <h2 class="product-title">${escapeHtml(name)}</h2>
                  <div class="product-price">${formatCurrency(p.price, currency)}</div>
                </div>
                <div class="product-actions">
                  <button type="button" class="btn btn-primary btn-sm js-add-cart" data-id="${escapeHtml(p.id)}" style="flex:1;" ${out ? 'disabled' : ''}>
                    ${out ? t('shop.outOfStock') : t('shop.addToCart')}
                  </button>
                  <button type="button" class="btn btn-outline btn-sm js-open-detail" data-id="${escapeHtml(p.id)}">
                    ${t('shop.viewDetails')}
                  </button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `}
    </div>

    ${detailProd ? renderProductModal(detailProd, currency) : ''}
  `;
}

function renderProductModal(p, currency) {
  const name = localize(p, 'name');
  const desc = localize(p, 'description');
  const stock = Number(p.stock) || 0;
  const out = stock <= 0;

  return `
    <div class="modal-backdrop" id="product-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-prod-title">
      <div class="modal-card">
        <div class="modal-head">
          <h2 id="modal-prod-title" style="margin:0;font-size:1.2rem;">${escapeHtml(name)}</h2>
          <button type="button" class="btn btn-outline btn-sm" id="close-prod-modal" aria-label="${t('common.close')}">✕</button>
        </div>
        <div class="product-img-wrap" style="margin-bottom:14px;">${renderProductMedia(p, name)}</div>
        ${stockBadge(stock)}
        ${desc ? `<p class="section-sub" style="margin-bottom:14px;">${escapeHtml(desc)}</p>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div class="product-price" style="margin:0;">${formatCurrency(p.price, currency)}</div>
          <span class="section-sub">${t('shop.stockAvailable', { n: formatNumber(stock) })}</span>
        </div>
        ${!out ? `
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <div class="stepper">
              <button type="button" id="modal-qty-minus" aria-label="Decrease">−</button>
              <input id="modal-qty-input" type="number" min="1" max="${stock}" value="${shopState.detailQty}" aria-label="${t('shop.qty')}" />
              <button type="button" id="modal-qty-plus" aria-label="Increase">+</button>
            </div>
            <button type="button" class="btn btn-primary" style="flex:1;" id="modal-add-btn" data-id="${escapeHtml(p.id)}">
              ${t('shop.addToCart')}
            </button>
          </div>
        ` : `<button type="button" class="btn btn-outline btn-block" disabled>${t('shop.outOfStock')}</button>`}
      </div>
    </div>
  `;
}

export function bindShopEvents(state, rerender) {
  const searchInput = document.getElementById('shop-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      shopState.search = e.target.value;
      rerender({ preserveFocusId: 'shop-search-input' });
    });
  }

  document.querySelectorAll('.js-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      shopState.categoryId = btn.dataset.id;
      rerender();
    });
  });

  document.querySelectorAll('.js-add-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = state.products.find((p) => p.id === btn.dataset.id);
      if (!prod) return;
      addToCart(prod, 1);
      showToast(t('shop.added'), 'success');
    });
  });

  document.querySelectorAll('.js-open-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      shopState.detailProductId = btn.dataset.id;
      shopState.detailQty = 1;
      rerender();
    });
  });

  const backdrop = document.getElementById('product-modal-backdrop');
  const closeBtn = document.getElementById('close-prod-modal');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        shopState.detailProductId = null;
        rerender();
      }
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      shopState.detailProductId = null;
      rerender();
    });
  }

  const minus = document.getElementById('modal-qty-minus');
  const plus = document.getElementById('modal-qty-plus');
  const qtyInput = document.getElementById('modal-qty-input');
  const modalAdd = document.getElementById('modal-add-btn');
  const prod = shopState.detailProductId
    ? state.products.find((p) => p.id === shopState.detailProductId)
    : null;
  const maxStock = prod ? Number(prod.stock) : 1;

  if (minus) {
    minus.addEventListener('click', () => {
      shopState.detailQty = Math.max(1, shopState.detailQty - 1);
      rerender();
    });
  }
  if (plus) {
    plus.addEventListener('click', () => {
      shopState.detailQty = Math.min(maxStock, shopState.detailQty + 1);
      rerender();
    });
  }
  if (qtyInput) {
    qtyInput.addEventListener('input', (e) => {
      shopState.detailQty = Math.max(1, Math.min(maxStock, Math.floor(Number(e.target.value) || 1)));
    });
  }
  if (modalAdd && prod) {
    modalAdd.addEventListener('click', () => {
      addToCart(prod, shopState.detailQty);
      shopState.detailProductId = null;
      showToast(t('shop.added'), 'success');
      rerender();
    });
  }
}
