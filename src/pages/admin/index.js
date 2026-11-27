import { t, localize } from '../../i18n/index.js';
import { formatCurrency, formatNumber, escapeHtml, buildWhatsAppUrl } from '../../lib/format.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { refreshCatalog, showToast } from '../../lib/store.js';

const STATUSES = ['New', 'Confirmed', 'Printing', 'Ready', 'Delivered', 'Cancelled'];

const adminState = {
  checkedAuth: false,
  user: null,
  isAdmin: false,
  authError: '',
  loginEmail: '',
  loginPassword: '',
  loggingIn: false,
  activeTab: 'orders',
  loadingData: false,
  orders: [],
  prices: [],
  discounts: [],
  finishing: [],
  categories: [],
  products: [],
  shopInfo: {},
  printConfig: {},
  // Orders filters
  orderStatus: 'all',
  orderKind: 'all',
  orderSearch: '',
  orderDate: '',
  selectedOrderId: null,
  // Product modal
  editingProduct: null,
};

function normalizeCustomerWa(phone) {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    digits = '2' + digits;
  }
  return digits;
}

async function compressImageToWebP(file, maxWidth = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) reject(new Error('Compression failed'));
            else resolve(blob);
          },
          'image/webp',
          0.82
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image file'));
    };
    img.src = url;
  });
}

async function checkAdminSession(rerender) {
  if (!isSupabaseConfigured() || !supabase) {
    adminState.checkedAuth = true;
    rerender();
    return;
  }
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user || null;
  if (!user) {
    adminState.checkedAuth = true;
    adminState.user = null;
    adminState.isAdmin = false;
    rerender();
    return;
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  adminState.checkedAuth = true;
  if (adminRow) {
    adminState.user = user;
    adminState.isAdmin = true;
    adminState.authError = '';
    await loadAdminData(rerender);
  } else {
    await supabase.auth.signOut();
    adminState.user = null;
    adminState.isAdmin = false;
    adminState.authError = t('admin.unauthorized');
    rerender();
  }
}

async function loadAdminData(rerender) {
  if (!supabase || !adminState.isAdmin) return;
  adminState.loadingData = true;
  rerender();

  try {
    const [ord, prc, dsc, fin, cat, prd, stg] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('print_prices').select('*').order('paper_size').order('color_mode').order('sides'),
      supabase.from('quantity_discounts').select('*').order('min_copies'),
      supabase.from('finishing_options').select('*').order('sort'),
      supabase.from('categories').select('*').order('sort'),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('key, value'),
    ]);

    adminState.orders = ord.data || [];
    adminState.prices = prc.data || [];
    adminState.discounts = dsc.data || [];
    adminState.finishing = fin.data || [];
    adminState.categories = cat.data || [];
    adminState.products = prd.data || [];
    const stgMap = {};
    for (const row of stg.data || []) stgMap[row.key] = row.value;
    adminState.shopInfo = stgMap.shop_info || {};
    adminState.printConfig = stgMap.print_config || {};
  } catch (err) {
    showToast(err.message || t('common.error'), 'error');
  } finally {
    adminState.loadingData = false;
    rerender();
  }
}

export function renderAdminPage(state, rerender) {
  if (!adminState.checkedAuth) {
    checkAdminSession(rerender);
    return `<div class="container" style="padding-block:48px;text-align:center;">${t('common.loading')}</div>`;
  }

  if (!isSupabaseConfigured()) {
    return `
      <div class="container" style="max-width:520px;padding-block:48px;">
        <div class="card">
          <h1 style="margin-top:0;">${t('admin.title')}</h1>
          <div class="alert alert-warn">${t('common.demoBanner')}</div>
        </div>
      </div>
    `;
  }

  if (!adminState.isAdmin) {
    return `
      <div class="container" style="max-width:460px;padding-block:48px;">
        <section class="sheet-card">
          <h1 style="margin-top:0;">${t('admin.loginTitle')}</h1>
          <p class="section-sub" style="margin-bottom:18px;">${t('admin.loginSub')}</p>
          <form id="admin-login-form">
            <div class="field">
              <label class="field-label" for="adm-email">${t('admin.email')}</label>
              <input id="adm-email" type="email" class="input" required value="${escapeHtml(adminState.loginEmail)}" />
            </div>
            <div class="field">
              <label class="field-label" for="adm-pass">${t('admin.password')}</label>
              <input id="adm-pass" type="password" class="input" required value="${escapeHtml(adminState.loginPassword)}" />
            </div>
            ${adminState.authError ? `<div class="alert alert-error">${escapeHtml(adminState.authError)}</div>` : ''}
            <button type="submit" class="btn btn-primary btn-block" ${adminState.loggingIn ? 'disabled' : ''}>
              ${adminState.loggingIn ? t('common.loading') : t('admin.signIn')}
            </button>
          </form>
        </section>
      </div>
    `;
  }

  const newCount = adminState.orders.filter((o) => o.status === 'New').length;

  return `
    <div class="container" style="padding-block:24px;">
      <div class="section-head">
        <div>
          <h1 class="page-title">${t('admin.title')}</h1>
          <p class="page-sub">${escapeHtml(adminState.user?.email || '')}</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-outline btn-sm" id="adm-refresh-btn">↻</button>
          <button type="button" class="btn btn-outline btn-sm" id="adm-signout-btn">${t('admin.signOut')}</button>
        </div>
      </div>

      <div class="admin-tabs">
        <button type="button" class="pill-btn js-adm-tab ${adminState.activeTab === 'orders' ? 'active' : ''}" data-tab="orders">
          ${t('admin.tabs.orders')} ${newCount > 0 ? `(${newCount})` : ''}
        </button>
        <button type="button" class="pill-btn js-adm-tab ${adminState.activeTab === 'prices' ? 'active' : ''}" data-tab="prices">${t('admin.tabs.prices')}</button>
        <button type="button" class="pill-btn js-adm-tab ${adminState.activeTab === 'products' ? 'active' : ''}" data-tab="products">${t('admin.tabs.products')}</button>
        <button type="button" class="pill-btn js-adm-tab ${adminState.activeTab === 'settings' ? 'active' : ''}" data-tab="settings">${t('admin.tabs.settings')}</button>
      </div>

      ${adminState.loadingData ? `<div class="card">${t('common.loading')}</div>` : renderActiveTab(state)}
    </div>
  `;
}

function renderActiveTab(state) {
  if (adminState.activeTab === 'orders') return renderOrdersTab(state);
  if (adminState.activeTab === 'prices') return renderPricesTab(state);
  if (adminState.activeTab === 'products') return renderProductsTab(state);
  return renderSettingsTab();
}

function renderOrdersTab(state) {
  const currency = state.shopInfo?.currency || 'EGP';
  const q = adminState.orderSearch.trim().toLowerCase();

  const filtered = adminState.orders.filter((o) => {
    if (adminState.orderStatus !== 'all' && o.status !== adminState.orderStatus) return false;
    if (adminState.orderKind !== 'all' && o.kind !== adminState.orderKind) return false;
    if (adminState.orderDate && !(o.created_at || '').startsWith(adminState.orderDate)) return false;
    if (!q) return true;
    return (
      (o.order_code || '').toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.phone || '').toLowerCase().includes(q)
    );
  });

  const selected = adminState.selectedOrderId
    ? adminState.orders.find((o) => o.id === adminState.selectedOrderId)
    : null;

  return `
    <div class="shop-toolbar">
      <input id="adm-order-search" type="search" class="input search-box" placeholder="${escapeHtml(t('admin.orders.searchPlaceholder'))}" value="${escapeHtml(adminState.orderSearch)}" />
      <select id="adm-order-status" class="select" style="width:auto;min-width:140px;">
        <option value="all">${t('admin.orders.filterStatus')}: ${t('common.all')}</option>
        ${STATUSES.map((s) => `<option value="${s}" ${adminState.orderStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <select id="adm-order-kind" class="select" style="width:auto;min-width:130px;">
        <option value="all">${t('admin.orders.filterKind')}: ${t('common.all')}</option>
        <option value="print" ${adminState.orderKind === 'print' ? 'selected' : ''}>${t('admin.orders.kindPrint')}</option>
        <option value="store" ${adminState.orderKind === 'store' ? 'selected' : ''}>${t('admin.orders.kindStore')}</option>
      </select>
      <input id="adm-order-date" type="date" class="input" style="width:auto;" value="${escapeHtml(adminState.orderDate)}" />
    </div>

    <div class="card table-wrap">
      ${filtered.length === 0 ? `<p class="section-sub">${t('admin.orders.empty')}</p>` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>${t('print.orderCode')}</th>
              <th>${t('admin.orders.filterKind')}</th>
              <th>${t('print.customerName')}</th>
              <th>${t('print.customerPhone')}</th>
              <th>${t('print.total')}</th>
              <th>${t('admin.orders.filterStatus')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((o) => `
              <tr>
                <td><strong>${escapeHtml(o.order_code)}</strong></td>
                <td>${o.kind === 'print' ? t('admin.orders.kindPrint') : t('admin.orders.kindStore')}</td>
                <td>${escapeHtml(o.customer_name)}</td>
                <td>${escapeHtml(o.phone)}</td>
                <td><strong>${formatCurrency(o.total, currency)}</strong></td>
                <td><span class="status-pill">${escapeHtml(o.status)}</span></td>
                <td>
                  <button type="button" class="btn btn-outline btn-sm js-open-order" data-id="${escapeHtml(o.id)}">${t('common.edit')}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    ${selected ? renderOrderModal(selected, currency) : ''}
  `;
}

function renderOrderModal(o, currency) {
  const pj = o.print_job || {};
  const waUrl = buildWhatsAppUrl(
    normalizeCustomerWa(o.phone),
    `${o.order_code} (${o.status}) - ${formatCurrency(o.total, currency)}`
  );

  return `
    <div class="modal-backdrop" id="adm-order-modal">
      <div class="modal-card">
        <div class="modal-head">
          <h2 style="margin:0;">${escapeHtml(o.order_code)}</h2>
          <button type="button" class="btn btn-outline btn-sm" id="adm-close-order">✕</button>
        </div>
        <p class="section-sub" style="margin-top:0;">
          <strong>${escapeHtml(o.customer_name)}</strong> · ${escapeHtml(o.phone)} · ${t(`print.${o.delivery_type}`)}
          ${o.address ? `<br/>${escapeHtml(o.address)}` : ''}
          ${o.notes ? `<br/><em>${escapeHtml(o.notes)}</em>` : ''}
        </p>

        ${o.kind === 'print' ? `
          <div class="card" style="background:var(--surface-alt);margin-bottom:14px;">
            <div><strong>${escapeHtml(pj.file_name || '')}</strong></div>
            <div>${escapeHtml(pj.paper_size)} · ${escapeHtml(pj.color_mode)} · ${escapeHtml(pj.sides)}</div>
            <div>${t('print.waPages')}: ${formatNumber(pj.pages)} × ${t('print.waCopies')}: ${formatNumber(pj.copies)}</div>
            ${(pj.finishing || []).length ? `<div>${t('print.finishing')}: ${pj.finishing.map((f) => escapeHtml(localize(f, 'name'))).join(', ')}</div>` : ''}
            ${o.file_path ? `<button type="button" class="btn btn-dark btn-sm" style="margin-top:10px;" id="adm-download-file" data-path="${escapeHtml(o.file_path)}">${t('admin.orders.downloadFile')}</button>` : ''}
          </div>
        ` : `
          <div class="card" style="background:var(--surface-alt);margin-bottom:14px;">
            ${(o.items || []).map((it) => `
              <div class="breakdown-row">
                <span>${escapeHtml(localize(it, 'name'))} × ${formatNumber(it.qty)}</span>
                <strong>${formatCurrency(it.line_total, currency)}</strong>
              </div>
            `).join('')}
          </div>
        `}

        <form id="adm-order-edit-form" data-id="${escapeHtml(o.id)}">
          <div class="grid-2">
            <div class="field">
              <label class="field-label" for="adm-ord-status">${t('admin.orders.updateStatus')}</label>
              <select id="adm-ord-status" class="select">
                ${STATUSES.map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="adm-ord-total">${t('admin.orders.finalPrice')}</label>
              <input id="adm-ord-total" type="number" step="0.01" min="0" class="input" value="${Number(o.total)}" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="adm-ord-note">${t('admin.orders.adminNote')}</label>
            <textarea id="adm-ord-note" class="textarea">${escapeHtml(o.admin_note || '')}</textarea>
          </div>
          <div style="display:grid;gap:8px;">
            <button type="submit" class="btn btn-primary btn-block">${t('admin.orders.saveChanges')}</button>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-block">${t('admin.orders.whatsappClient')}</a>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderPricesTab() {
  return `
    <div style="display:grid;gap:20px;">
      <section class="card table-wrap">
        <h2 style="margin-top:0;">${t('admin.prices.matrixTitle')}</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>${t('admin.prices.paper')}</th>
              <th>${t('admin.prices.color')}</th>
              <th>${t('admin.prices.sides')}</th>
              <th>${t('admin.prices.price')}</th>
              <th>${t('admin.prices.active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${adminState.prices.map((p) => `
              <tr>
                <td><strong>${escapeHtml(p.paper_size)}</strong></td>
                <td>${escapeHtml(p.color_mode)}</td>
                <td>${escapeHtml(p.sides)}</td>
                <td><input type="number" step="0.01" min="0" class="input js-prc-val" data-id="${escapeHtml(p.id)}" value="${Number(p.price_per_page)}" style="width:110px;" /></td>
                <td><input type="checkbox" class="js-prc-act" data-id="${escapeHtml(p.id)}" ${p.active ? 'checked' : ''} /></td>
                <td><button type="button" class="btn btn-dark btn-sm js-save-prc" data-id="${escapeHtml(p.id)}">${t('common.save')}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2 style="margin-top:0;">${t('admin.prices.minOrderTitle')}</h2>
        <div style="display:flex;gap:10px;max-width:320px;">
          <input id="adm-min-order" type="number" step="1" min="0" class="input" value="${Number(adminState.printConfig.min_order_total ?? 10)}" />
          <button type="button" class="btn btn-primary" id="adm-save-min-order">${t('common.save')}</button>
        </div>
      </section>

      <section class="card">
        <h2 style="margin-top:0;">${t('admin.prices.discountsTitle')}</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>${t('admin.prices.minCopies')}</th><th>${t('admin.prices.discountPct')}</th><th></th></tr></thead>
            <tbody>
              ${adminState.discounts.map((d) => `
                <tr>
                  <td>${formatNumber(d.min_copies)}+</td>
                  <td>${d.discount_percent}%</td>
                  <td><button type="button" class="btn btn-outline btn-sm js-del-disc" data-id="${escapeHtml(d.id)}">${t('common.delete')}</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <form id="adm-add-disc-form" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          <input id="disc-min" type="number" min="2" class="input" style="width:150px;" placeholder="${escapeHtml(t('admin.prices.minCopies'))}" required />
          <input id="disc-pct" type="number" min="1" max="90" step="0.5" class="input" style="width:150px;" placeholder="${escapeHtml(t('admin.prices.discountPct'))}" required />
          <button type="submit" class="btn btn-dark">${t('admin.prices.addTier')}</button>
        </form>
      </section>

      <section class="card">
        <h2 style="margin-top:0;">${t('admin.prices.finishingTitle')}</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>EN</th><th>AR</th><th>${t('admin.prices.price')}</th><th>${t('admin.prices.priceType')}</th><th>${t('admin.prices.active')}</th><th></th></tr></thead>
            <tbody>
              ${adminState.finishing.map((f) => `
                <tr>
                  <td>${escapeHtml(f.name_en)}</td>
                  <td>${escapeHtml(f.name_ar)}</td>
                  <td><input type="number" step="0.5" min="0" class="input js-fin-price" data-id="${escapeHtml(f.id)}" value="${Number(f.price)}" style="width:100px;" /></td>
                  <td>${f.price_type === 'per_copy' ? t('admin.prices.perCopy') : t('admin.prices.flat')}</td>
                  <td><input type="checkbox" class="js-fin-act" data-id="${escapeHtml(f.id)}" ${f.active ? 'checked' : ''} /></td>
                  <td style="display:flex;gap:6px;">
                    <button type="button" class="btn btn-dark btn-sm js-save-fin" data-id="${escapeHtml(f.id)}">${t('common.save')}</button>
                    <button type="button" class="btn btn-outline btn-sm js-del-fin" data-id="${escapeHtml(f.id)}">${t('common.delete')}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <form id="adm-add-fin-form" class="grid-4" style="margin-top:14px;">
          <input id="fin-en" class="input" placeholder="${escapeHtml(t('admin.prices.nameEn'))}" required />
          <input id="fin-ar" class="input" placeholder="${escapeHtml(t('admin.prices.nameAr'))}" required />
          <input id="fin-price" type="number" step="0.5" min="0" class="input" placeholder="${escapeHtml(t('admin.prices.price'))}" required />
          <div style="display:flex;gap:6px;">
            <select id="fin-type" class="select">
              <option value="per_copy">${t('admin.prices.perCopy')}</option>
              <option value="flat">${t('admin.prices.flat')}</option>
            </select>
            <button type="submit" class="btn btn-dark">${t('common.add')}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderProductsTab(state) {
  const currency = state.shopInfo?.currency || 'EGP';
  const ep = adminState.editingProduct;

  return `
    <div style="display:grid;gap:20px;">
      <section class="card">
        <div class="section-head" style="margin-bottom:12px;">
          <h2 style="margin:0;">${t('admin.tabs.products')}</h2>
          <button type="button" class="btn btn-primary btn-sm" id="adm-new-prod-btn">${t('admin.products.addProduct')}</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>EN</th><th>AR</th><th>${t('admin.products.price')}</th><th>${t('admin.products.stock')}</th><th>${t('admin.products.active')}</th><th></th></tr></thead>
            <tbody>
              ${adminState.products.map((p) => `
                <tr>
                  <td>${escapeHtml(p.name_en)}</td>
                  <td>${escapeHtml(p.name_ar)}</td>
                  <td>${formatCurrency(p.price, currency)}</td>
                  <td>${formatNumber(p.stock)}</td>
                  <td>${p.active ? '✓' : '—'}</td>
                  <td style="display:flex;gap:6px;">
                    <button type="button" class="btn btn-outline btn-sm js-edit-prod" data-id="${escapeHtml(p.id)}">${t('common.edit')}</button>
                    <button type="button" class="btn btn-outline btn-sm js-del-prod" data-id="${escapeHtml(p.id)}">${t('common.delete')}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2 style="margin-top:0;">${t('admin.products.categoriesTitle')}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          ${adminState.categories.map((c) => `
            <span class="badge-pill">${escapeHtml(c.name_en)} / ${escapeHtml(c.name_ar)}
              <button type="button" class="js-del-cat" data-id="${escapeHtml(c.id)}" style="border:none;background:none;cursor:pointer;font-weight:800;">×</button>
            </span>
          `).join('')}
        </div>
        <form id="adm-add-cat-form" style="display:flex;gap:8px;flex-wrap:wrap;">
          <input id="cat-en" class="input" style="width:200px;" placeholder="${escapeHtml(t('admin.products.nameEn'))}" required />
          <input id="cat-ar" class="input" style="width:200px;" placeholder="${escapeHtml(t('admin.products.nameAr'))}" required />
          <button type="submit" class="btn btn-dark">${t('admin.products.addCategory')}</button>
        </form>
      </section>
    </div>

    ${ep ? renderProductEditorModal(ep) : ''}
  `;
}

function renderProductEditorModal(ep) {
  return `
    <div class="modal-backdrop" id="adm-prod-modal">
      <div class="modal-card">
        <div class="modal-head">
          <h2 style="margin:0;">${ep.id ? t('admin.products.editProduct') : t('admin.products.addProduct')}</h2>
          <button type="button" class="btn btn-outline btn-sm" id="adm-close-prod">✕</button>
        </div>
        <form id="adm-prod-form">
          <div class="field">
            <label class="field-label" for="prd-cat">${t('admin.products.category')}</label>
            <select id="prd-cat" class="select">
              ${adminState.categories.map((c) => `<option value="${escapeHtml(c.id)}" ${ep.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name_en)} / ${escapeHtml(c.name_ar)}</option>`).join('')}
            </select>
          </div>
          <div class="grid-2">
            <div class="field"><label class="field-label" for="prd-en">${t('admin.products.nameEn')}</label><input id="prd-en" class="input" required value="${escapeHtml(ep.name_en || '')}" /></div>
            <div class="field"><label class="field-label" for="prd-ar">${t('admin.products.nameAr')}</label><input id="prd-ar" class="input" required value="${escapeHtml(ep.name_ar || '')}" /></div>
          </div>
          <div class="grid-2">
            <div class="field"><label class="field-label" for="prd-den">${t('admin.products.descEn')}</label><textarea id="prd-den" class="textarea">${escapeHtml(ep.description_en || '')}</textarea></div>
            <div class="field"><label class="field-label" for="prd-dar">${t('admin.products.descAr')}</label><textarea id="prd-dar" class="textarea">${escapeHtml(ep.description_ar || '')}</textarea></div>
          </div>
          <div class="grid-2">
            <div class="field"><label class="field-label" for="prd-price">${t('admin.products.price')}</label><input id="prd-price" type="number" step="0.5" min="0" class="input" required value="${Number(ep.price || 0)}" /></div>
            <div class="field"><label class="field-label" for="prd-stock">${t('admin.products.stock')}</label><input id="prd-stock" type="number" min="0" class="input" required value="${Number(ep.stock || 0)}" /></div>
          </div>
          <div class="field">
            <label class="field-label" for="prd-img">${t('admin.products.image')}</label>
            <input id="prd-img" type="file" accept="image/*" class="input" />
          </div>
          <label class="check-item" style="margin-bottom:14px;">
            <span class="check-left">
              <input id="prd-act" type="checkbox" ${ep.active !== false ? 'checked' : ''} />
              <span>${t('admin.products.active')}</span>
            </span>
          </label>
          <button type="submit" class="btn btn-primary btn-block">${t('common.save')}</button>
        </form>
      </div>
    </div>
  `;
}

function renderSettingsTab() {
  const s = adminState.shopInfo || {};
  const pc = adminState.printConfig || {};
  return `
    <section class="card" style="max-width:700px;">
      <form id="adm-settings-form">
        <div class="grid-2">
          <div class="field"><label class="field-label" for="stg-wa">${t('admin.settings.whatsapp')}</label><input id="stg-wa" class="input" value="${escapeHtml(s.whatsapp || '')}" required /></div>
          <div class="field"><label class="field-label" for="stg-ph">${t('admin.settings.phone')}</label><input id="stg-ph" class="input" value="${escapeHtml(s.phone || '')}" required /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label class="field-label" for="stg-aen">${t('admin.settings.addressEn')}</label><input id="stg-aen" class="input" value="${escapeHtml(s.address_en || '')}" /></div>
          <div class="field"><label class="field-label" for="stg-aar">${t('admin.settings.addressAr')}</label><input id="stg-aar" class="input" value="${escapeHtml(s.address_ar || '')}" /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label class="field-label" for="stg-hen">${t('admin.settings.hoursEn')}</label><input id="stg-hen" class="input" value="${escapeHtml(s.hours_en || '')}" /></div>
          <div class="field"><label class="field-label" for="stg-har">${t('admin.settings.hoursAr')}</label><input id="stg-har" class="input" value="${escapeHtml(s.hours_ar || '')}" /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label class="field-label" for="stg-cur">${t('admin.settings.currency')}</label><input id="stg-cur" class="input" value="${escapeHtml(s.currency || 'EGP')}" /></div>
          <div class="field"><label class="field-label" for="stg-maxmb">${t('admin.settings.maxFileMb')}</label><input id="stg-maxmb" type="number" min="1" max="200" class="input" value="${Number(pc.max_file_mb || 50)}" /></div>
        </div>
        <label class="check-item" style="margin-bottom:16px;">
          <span class="check-left">
            <input id="stg-enabled" type="checkbox" ${pc.orders_enabled !== false ? 'checked' : ''} />
            <span>${t('admin.settings.ordersEnabled')}</span>
          </span>
        </label>
        <button type="submit" class="btn btn-primary">${t('admin.settings.saveSettings')}</button>
      </form>
    </section>
  `;
}

export function bindAdminEvents(state, rerender) {
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    const emailEl = document.getElementById('adm-email');
    const passEl = document.getElementById('adm-pass');
    emailEl.addEventListener('input', (e) => (adminState.loginEmail = e.target.value));
    passEl.addEventListener('input', (e) => (adminState.loginPassword = e.target.value));
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      adminState.loggingIn = true;
      adminState.authError = '';
      rerender();
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: adminState.loginEmail.trim(),
          password: adminState.loginPassword,
        });
        if (error) throw error;
        adminState.loginPassword = '';
        await checkAdminSession(rerender);
      } catch (err) {
        adminState.authError = err.message || t('common.error');
      } finally {
        adminState.loggingIn = false;
        rerender();
      }
    });
    return;
  }

  document.getElementById('adm-refresh-btn')?.addEventListener('click', () => loadAdminData(rerender));
  document.getElementById('adm-signout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    adminState.user = null;
    adminState.isAdmin = false;
    rerender();
  });

  document.querySelectorAll('.js-adm-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminState.activeTab = btn.dataset.tab;
      rerender();
    });
  });

  // Orders events
  document.getElementById('adm-order-search')?.addEventListener('input', (e) => {
    adminState.orderSearch = e.target.value;
    rerender({ preserveFocusId: 'adm-order-search' });
  });
  document.getElementById('adm-order-status')?.addEventListener('change', (e) => {
    adminState.orderStatus = e.target.value;
    rerender();
  });
  document.getElementById('adm-order-kind')?.addEventListener('change', (e) => {
    adminState.orderKind = e.target.value;
    rerender();
  });
  document.getElementById('adm-order-date')?.addEventListener('change', (e) => {
    adminState.orderDate = e.target.value;
    rerender();
  });
  document.querySelectorAll('.js-open-order').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminState.selectedOrderId = btn.dataset.id;
      rerender();
    });
  });
  document.getElementById('adm-close-order')?.addEventListener('click', () => {
    adminState.selectedOrderId = null;
    rerender();
  });
  document.getElementById('adm-download-file')?.addEventListener('click', async (e) => {
    const path = e.target.dataset.path;
    const { data, error } = await supabase.storage.from('print-files').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      showToast(error?.message || t('common.error'), 'error');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  });
  document.getElementById('adm-order-edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = e.target.dataset.id;
    const status = document.getElementById('adm-ord-status').value;
    const total = Number(document.getElementById('adm-ord-total').value);
    const admin_note = document.getElementById('adm-ord-note').value;
    const { error } = await supabase.from('orders').update({ status, total, admin_note }).eq('id', id);
    if (error) return showToast(error.message, 'error');
    showToast(t('admin.orders.saved'), 'success');
    adminState.selectedOrderId = null;
    await loadAdminData(rerender);
  });

  // Prices events
  document.querySelectorAll('.js-save-prc').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const val = Number(document.querySelector(`.js-prc-val[data-id="${id}"]`).value);
      const act = document.querySelector(`.js-prc-act[data-id="${id}"]`).checked;
      const { error } = await supabase.from('print_prices').update({ price_per_page: val, active: act }).eq('id', id);
      if (error) return showToast(error.message, 'error');
      showToast(t('admin.prices.saved'), 'success');
      await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
    });
  });

  document.getElementById('adm-save-min-order')?.addEventListener('click', async () => {
    const nextCfg = { ...adminState.printConfig, min_order_total: Number(document.getElementById('adm-min-order').value) };
    const { error } = await supabase.from('settings').upsert({ key: 'print_config', value: nextCfg, is_public: true });
    if (error) return showToast(error.message, 'error');
    showToast(t('admin.prices.saved'), 'success');
    await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
  });

  document.getElementById('adm-add-disc-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const min_copies = Number(document.getElementById('disc-min').value);
    const discount_percent = Number(document.getElementById('disc-pct').value);
    const { error } = await supabase.from('quantity_discounts').insert({ min_copies, discount_percent });
    if (error) return showToast(error.message, 'error');
    await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
  });

  document.querySelectorAll('.js-del-disc').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('quantity_discounts').delete().eq('id', btn.dataset.id);
      if (error) return showToast(error.message, 'error');
      await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
    });
  });

  document.querySelectorAll('.js-save-fin').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const price = Number(document.querySelector(`.js-fin-price[data-id="${id}"]`).value);
      const active = document.querySelector(`.js-fin-act[data-id="${id}"]`).checked;
      const { error } = await supabase.from('finishing_options').update({ price, active }).eq('id', id);
      if (error) return showToast(error.message, 'error');
      showToast(t('admin.prices.saved'), 'success');
      await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
    });
  });

  document.querySelectorAll('.js-del-fin').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('finishing_options').delete().eq('id', btn.dataset.id);
      if (error) return showToast(error.message, 'error');
      await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
    });
  });

  document.getElementById('adm-add-fin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('finishing_options').insert({
      name_en: document.getElementById('fin-en').value.trim(),
      name_ar: document.getElementById('fin-ar').value.trim(),
      price: Number(document.getElementById('fin-price').value),
      price_type: document.getElementById('fin-type').value,
      active: true,
    });
    if (error) return showToast(error.message, 'error');
    await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
  });

  // Products events
  document.getElementById('adm-new-prod-btn')?.addEventListener('click', () => {
    adminState.editingProduct = {
      category_id: adminState.categories[0]?.id || null,
      name_en: '',
      name_ar: '',
      description_en: '',
      description_ar: '',
      price: 0,
      stock: 10,
      active: true,
      image_url: '',
    };
    rerender();
  });

  document.querySelectorAll('.js-edit-prod').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = adminState.products.find((x) => x.id === btn.dataset.id);
      if (p) {
        adminState.editingProduct = { ...p };
        rerender();
      }
    });
  });

  document.getElementById('adm-close-prod')?.addEventListener('click', () => {
    adminState.editingProduct = null;
    rerender();
  });

  document.getElementById('adm-prod-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ep = adminState.editingProduct;
    let image_url = ep.image_url || '';
    const file = document.getElementById('prd-img').files?.[0];
    if (file) {
      try {
        const blob = await compressImageToWebP(file);
        const path = `prod-${Date.now()}.webp`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, blob, {
          contentType: 'image/webp',
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
        image_url = pub.publicUrl;
      } catch (err) {
        return showToast(err.message, 'error');
      }
    }

    const row = {
      category_id: document.getElementById('prd-cat').value || null,
      name_en: document.getElementById('prd-en').value.trim(),
      name_ar: document.getElementById('prd-ar').value.trim(),
      description_en: document.getElementById('prd-den').value.trim(),
      description_ar: document.getElementById('prd-dar').value.trim(),
      price: Number(document.getElementById('prd-price').value),
      stock: Number(document.getElementById('prd-stock').value),
      active: document.getElementById('prd-act').checked,
      image_url,
    };

    const { error } = ep.id
      ? await supabase.from('products').update(row).eq('id', ep.id)
      : await supabase.from('products').insert(row);

    if (error) return showToast(error.message, 'error');
    adminState.editingProduct = null;
    showToast(t('admin.products.saved'), 'success');
    await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
  });

  document.querySelectorAll('.js-del-prod').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('products').delete().eq('id', btn.dataset.id);
      if (error) return showToast(error.message, 'error');
      await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
    });
  });

  document.getElementById('adm-add-cat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('categories').insert({
      name_en: document.getElementById('cat-en').value.trim(),
      name_ar: document.getElementById('cat-ar').value.trim(),
      sort: adminState.categories.length + 1,
    });
    if (error) return showToast(error.message, 'error');
    await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
  });

  document.querySelectorAll('.js-del-cat').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('categories').delete().eq('id', btn.dataset.id);
      if (error) return showToast(error.message, 'error');
      await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
    });
  });

  // Settings events
  document.getElementById('adm-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nextInfo = {
      ...adminState.shopInfo,
      name_en: adminState.shopInfo.name_en || 'Al-Badran Printing',
      name_ar: adminState.shopInfo.name_ar || 'البدران للطباعة',
      whatsapp: document.getElementById('stg-wa').value.trim(),
      phone: document.getElementById('stg-ph').value.trim(),
      address_en: document.getElementById('stg-aen').value.trim(),
      address_ar: document.getElementById('stg-aar').value.trim(),
      hours_en: document.getElementById('stg-hen').value.trim(),
      hours_ar: document.getElementById('stg-har').value.trim(),
      currency: document.getElementById('stg-cur').value.trim() || 'EGP',
    };
    const nextCfg = {
      ...adminState.printConfig,
      max_file_mb: Number(document.getElementById('stg-maxmb').value) || 50,
      orders_enabled: document.getElementById('stg-enabled').checked,
    };

    const [r1, r2] = await Promise.all([
      supabase.from('settings').upsert({ key: 'shop_info', value: nextInfo, is_public: true }),
      supabase.from('settings').upsert({ key: 'print_config', value: nextCfg, is_public: true }),
    ]);
    if (r1.error || r2.error) return showToast((r1.error || r2.error).message, 'error');
    showToast(t('admin.settings.saved'), 'success');
    await Promise.all([loadAdminData(rerender), refreshCatalog(true)]);
  });
}
