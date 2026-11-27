import { t, localize } from '../i18n/index.js';
import { formatCurrency, formatNumber, escapeHtml, buildWhatsAppUrl } from '../lib/format.js';
import {
  getCartTotal,
  updateCartQty,
  removeFromCart,
  clearCart,
  refreshCatalog,
  showToast,
} from '../lib/store.js';
import { submitStoreOrder } from '../lib/supabase.js';

const checkoutState = {
  customerName: '',
  phone: '',
  deliveryType: 'pickup',
  address: '',
  notes: '',
  honeypot: '',
  submitting: false,
  error: '',
  orderResult: null,
};

function buildStoreWhatsAppMessage(state, items, total, orderCode = '') {
  const currency = state.shopInfo?.currency || 'EGP';
  const lines = [t('cart.waStoreGreeting')];
  if (orderCode) lines.push(`${t('print.waOrderCode')}: ${orderCode}`);
  for (const item of items) {
    const name = localize(item, 'name');
    const unit = item.unit_price ?? item.price;
    const lineTotal = item.line_total ?? Number(unit) * Number(item.qty);
    lines.push(`- ${name} × ${item.qty} = ${formatCurrency(lineTotal, currency)}`);
  }
  lines.push(`${t('cart.total')}: ${formatCurrency(total, currency)}`);
  if (checkoutState.customerName) lines.push(`${t('print.waCustomer')}: ${checkoutState.customerName}`);
  if (checkoutState.phone) lines.push(`${t('print.waPhone')}: ${checkoutState.phone}`);
  lines.push(
    `${t('print.waDelivery')}: ${t(`print.${checkoutState.deliveryType}`)}${
      checkoutState.deliveryType === 'delivery' && checkoutState.address ? ` (${checkoutState.address})` : ''
    }`
  );
  if (checkoutState.notes) lines.push(`${t('print.waNotes')}: ${checkoutState.notes}`);
  return lines.join('\n');
}

export function renderCartPage(state) {
  const currency = state.shopInfo?.currency || 'EGP';

  if (checkoutState.orderResult) {
    const res = checkoutState.orderResult;
    const waUrl = buildWhatsAppUrl(
      state.shopInfo?.whatsapp,
      buildStoreWhatsAppMessage(state, res.items || [], res.total, res.order_code)
    );
    return `
      <div class="container" style="max-width:640px;padding-block:36px;">
        <section class="sheet-card" style="text-align:center;">
          <div class="step-num" style="margin-inline:auto;width:48px;height:48px;font-size:1.3rem;background:var(--success-bg);color:var(--success);">✓</div>
          <h1 style="margin:6px 0 8px;">${t('cart.successTitle')}</h1>
          <p class="section-sub">${t('cart.successSub')}</p>
          <div class="total-box" style="margin-top:20px;">
            <span>${t('print.orderCode')}</span>
            <strong>${escapeHtml(res.order_code)}</strong>
          </div>
          <div class="breakdown-list" style="text-align:start;">
            ${(res.items || []).map((it) => `
              <div class="breakdown-row">
                <span>${escapeHtml(localize(it, 'name'))} × ${formatNumber(it.qty)}</span>
                <strong>${formatCurrency(it.line_total, currency)}</strong>
              </div>
            `).join('')}
            <div class="breakdown-row" style="border-top:1px solid var(--border);padding-top:8px;">
              <strong>${t('cart.total')}</strong>
              <strong>${formatCurrency(res.total, currency)}</strong>
            </div>
          </div>
          <div style="display:grid;gap:10px;margin-top:20px;">
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-block">${t('cart.sendWhatsApp')}</a>
            <a href="#/shop" class="btn btn-outline btn-block" id="cart-back-shop">${t('cart.goShop')}</a>
          </div>
        </section>
      </div>
    `;
  }

  if (!state.cart.length) {
    return `
      <div class="container" style="max-width:600px;padding-block:48px;">
        <section class="card" style="text-align:center;padding:40px 20px;">
          <h1 style="margin-top:0;">${t('cart.emptyTitle')}</h1>
          <p class="section-sub" style="margin-bottom:20px;">${t('cart.emptySub')}</p>
          <a href="#/shop" class="btn btn-primary">${t('cart.goShop')}</a>
        </section>
      </div>
    `;
  }

  const total = getCartTotal();
  const ordersEnabled = state.printConfig?.orders_enabled !== false;
  const waUrl = buildWhatsAppUrl(
    state.shopInfo?.whatsapp,
    buildStoreWhatsAppMessage(state, state.cart, total)
  );

  return `
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">${t('cart.title')}</h1>
      </div>

      <div class="calc-layout">
        <section class="card">
          <h2 style="margin-top:0;">${t('cart.items')}</h2>
          ${state.cart.map((item) => {
            const name = localize(item, 'name');
            return `
              <div class="cart-row">
                <div style="flex:1;min-width:180px;">
                  <strong>${escapeHtml(name)}</strong>
                  <div class="section-sub" style="font-size:0.88rem;">${formatCurrency(item.price, currency)}</div>
                </div>
                <div class="stepper">
                  <button type="button" class="js-cart-minus" data-id="${escapeHtml(item.id)}" aria-label="Decrease">−</button>
                  <input type="number" min="1" class="js-cart-qty" data-id="${escapeHtml(item.id)}" value="${item.qty}" aria-label="${t('shop.qty')}" />
                  <button type="button" class="js-cart-plus" data-id="${escapeHtml(item.id)}" aria-label="Increase">+</button>
                </div>
                <div style="min-width:100px;text-align:end;font-weight:800;">
                  ${formatCurrency(Number(item.price) * Number(item.qty), currency)}
                </div>
                <button type="button" class="btn btn-outline btn-sm js-cart-remove" data-id="${escapeHtml(item.id)}">${t('cart.remove')}</button>
              </div>
            `;
          }).join('')}
        </section>

        <aside class="calc-sticky">
          <section class="sheet-card">
            <h2 style="margin-top:0;">${t('cart.summary')}</h2>
            <div class="total-box">
              <span>${t('cart.total')}</span>
              <strong>${formatCurrency(total, currency)}</strong>
            </div>
            <p class="section-sub" style="font-size:0.88rem;margin-bottom:16px;">${t('cart.paymentNote')}</p>

            <form id="store-checkout-form" novalidate>
              <input type="text" name="website" id="hp-store" class="hp-field" tabindex="-1" autocomplete="off" value="${escapeHtml(checkoutState.honeypot)}" />

              <div class="field">
                <label class="field-label" for="sc-name">${t('print.customerName')} *</label>
                <input id="sc-name" class="input" type="text" required value="${escapeHtml(checkoutState.customerName)}" />
              </div>

              <div class="field">
                <label class="field-label" for="sc-phone">${t('print.customerPhone')} *</label>
                <input id="sc-phone" class="input" type="tel" required placeholder="010xxxxxxxx" value="${escapeHtml(checkoutState.phone)}" />
              </div>

              <div class="field">
                <span class="field-label">${t('print.deliveryType')}</span>
                <div class="seg-group">
                  <button type="button" class="seg-btn js-sc-delivery ${checkoutState.deliveryType === 'pickup' ? 'active' : ''}" data-val="pickup">${t('print.pickup')}</button>
                  <button type="button" class="seg-btn js-sc-delivery ${checkoutState.deliveryType === 'delivery' ? 'active' : ''}" data-val="delivery">${t('print.delivery')}</button>
                </div>
              </div>

              ${checkoutState.deliveryType === 'delivery' ? `
                <div class="field">
                  <label class="field-label" for="sc-address">${t('print.address')} *</label>
                  <input id="sc-address" class="input" type="text" required placeholder="${escapeHtml(t('print.addressPlaceholder'))}" value="${escapeHtml(checkoutState.address)}" />
                </div>
              ` : ''}

              <div class="field">
                <label class="field-label" for="sc-notes">${t('print.notes')}</label>
                <textarea id="sc-notes" class="textarea">${escapeHtml(checkoutState.notes)}</textarea>
              </div>

              ${checkoutState.error ? `<div class="alert alert-error">${escapeHtml(checkoutState.error)}</div>` : ''}

              <div style="display:grid;gap:10px;">
                <button type="submit" class="btn btn-primary btn-block" ${!ordersEnabled || checkoutState.submitting ? 'disabled' : ''}>
                  ${checkoutState.submitting ? t('cart.submitting') : t('cart.confirmOrder')}
                </button>
                <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-block">${t('cart.sendWhatsApp')}</a>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  `;
}

export function bindCartEvents(state, rerender) {
  const backShop = document.getElementById('cart-back-shop');
  if (backShop) {
    backShop.addEventListener('click', () => {
      checkoutState.orderResult = null;
    });
    return;
  }

  document.querySelectorAll('.js-cart-minus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.cart.find((i) => i.id === btn.dataset.id);
      if (item) updateCartQty(item.id, item.qty - 1);
    });
  });

  document.querySelectorAll('.js-cart-plus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.cart.find((i) => i.id === btn.dataset.id);
      if (item) updateCartQty(item.id, item.qty + 1);
    });
  });

  document.querySelectorAll('.js-cart-qty').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      updateCartQty(inp.dataset.id, e.target.value);
    });
  });

  document.querySelectorAll('.js-cart-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });

  const nameEl = document.getElementById('sc-name');
  const phoneEl = document.getElementById('sc-phone');
  const addrEl = document.getElementById('sc-address');
  const notesEl = document.getElementById('sc-notes');
  const hpEl = document.getElementById('hp-store');
  if (nameEl) nameEl.addEventListener('input', (e) => (checkoutState.customerName = e.target.value));
  if (phoneEl) phoneEl.addEventListener('input', (e) => (checkoutState.phone = e.target.value));
  if (addrEl) addrEl.addEventListener('input', (e) => (checkoutState.address = e.target.value));
  if (notesEl) notesEl.addEventListener('input', (e) => (checkoutState.notes = e.target.value));
  if (hpEl) hpEl.addEventListener('input', (e) => (checkoutState.honeypot = e.target.value));

  document.querySelectorAll('.js-sc-delivery').forEach((btn) => {
    btn.addEventListener('click', () => {
      checkoutState.deliveryType = btn.dataset.val;
      rerender();
    });
  });

  const form = document.getElementById('store-checkout-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      checkoutState.error = '';

      if (checkoutState.customerName.trim().length < 2) {
        checkoutState.error = t('print.validationName');
        rerender();
        return;
      }
      if (checkoutState.phone.replace(/[^0-9+]/g, '').length < 8) {
        checkoutState.error = t('print.validationPhone');
        rerender();
        return;
      }
      if (checkoutState.deliveryType === 'delivery' && checkoutState.address.trim().length < 4) {
        checkoutState.error = t('print.validationAddress');
        rerender();
        return;
      }

      checkoutState.submitting = true;
      rerender();

      try {
        const res = await submitStoreOrder({
          customerName: checkoutState.customerName.trim(),
          phone: checkoutState.phone.trim(),
          deliveryType: checkoutState.deliveryType,
          address: checkoutState.address.trim(),
          notes: checkoutState.notes.trim(),
          items: state.cart,
          honeypot: checkoutState.honeypot,
        });
        checkoutState.orderResult = res;
        clearCart();
        refreshCatalog(true);
        showToast(`${t('print.orderCode')}: ${res.order_code}`, 'success');
      } catch (err) {
        if (err.message === 'SUPABASE_NOT_CONFIGURED') {
          checkoutState.error = t('common.demoBanner');
        } else if (err.message?.includes('OUT_OF_STOCK:')) {
          const item = err.message.split('OUT_OF_STOCK:')[1] || '';
          checkoutState.error = t('cart.outOfStockErr', { item });
        } else {
          checkoutState.error = err.message || t('common.error');
        }
      } finally {
        checkoutState.submitting = false;
        rerender();
      }
    });
  }
}
