import { t, localize } from '../i18n/index.js';
import { formatCurrency, formatFileSize, formatNumber, escapeHtml, buildWhatsAppUrl } from '../lib/format.js';
import { calculatePrintQuote } from '../lib/pricing.js';
import { inspectPdfFile, createImageThumbnail } from '../lib/pdf.js';
import { uploadPrintFile, submitPrintOrder } from '../lib/supabase.js';
import { showToast } from '../lib/store.js';

const ALLOWED_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'pptx'];

const calcState = {
  file: null,
  fileName: '',
  fileSize: 0,
  fileType: '',
  fileExt: '',
  thumbnailUrl: '',
  inspecting: false,
  fileError: '',
  isEstimated: false,
  pages: 1,
  paperSize: 'A4',
  colorMode: 'bw',
  sides: 'single',
  copies: 1,
  finishingIds: [],
  notes: '',
  customerName: '',
  phone: '',
  deliveryType: 'pickup',
  address: '',
  honeypot: '',
  submitting: false,
  submitError: '',
  orderResult: null,
};

function getExt(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

function buildWhatsAppMessage(state, quote, orderCode = '') {
  const lines = [t('print.waGreeting')];
  if (orderCode) lines.push(`${t('print.waOrderCode')}: ${orderCode}`);
  if (calcState.fileName) lines.push(`${t('print.waFile')}: ${calcState.fileName}`);
  lines.push(
    `${t('print.waSpecs')}: ${calcState.paperSize} | ${t(`print.${calcState.colorMode}`)} | ${t(`print.${calcState.sides}`)}`
  );
  lines.push(`${t('print.waPages')}: ${calcState.pages}${calcState.isEstimated ? ' (~)' : ''}`);
  lines.push(`${t('print.waCopies')}: ${calcState.copies}`);
  if (quote.chosenFinishing?.length) {
    const finNames = quote.chosenFinishing.map((f) => localize(f, 'name')).join(', ');
    lines.push(`${t('print.waFinishing')}: ${finNames}`);
  }
  const currency = state.shopInfo?.currency || 'EGP';
  lines.push(`${t('print.waTotal')}: ${formatCurrency(quote.total, currency)}`);
  if (calcState.customerName) lines.push(`${t('print.waCustomer')}: ${calcState.customerName}`);
  if (calcState.phone) lines.push(`${t('print.waPhone')}: ${calcState.phone}`);
  lines.push(
    `${t('print.waDelivery')}: ${t(`print.${calcState.deliveryType}`)}${
      calcState.deliveryType === 'delivery' && calcState.address ? ` (${calcState.address})` : ''
    }`
  );
  if (calcState.notes) lines.push(`${t('print.waNotes')}: ${calcState.notes}`);
  return lines.join('\n');
}

export function renderPrintPage(state) {
  if (calcState.orderResult) {
    return renderSuccessView(state);
  }

  const currency = state.shopInfo?.currency || 'EGP';
  const maxMb = Number(state.printConfig?.max_file_mb || 50);
  const ordersEnabled = state.printConfig?.orders_enabled !== false;

  const quote = calculatePrintQuote({
    prices: state.printPrices,
    discounts: state.discounts,
    finishingOptions: state.finishing,
    minOrderTotal: state.printConfig?.min_order_total ?? 10,
    paperSize: calcState.paperSize,
    colorMode: calcState.colorMode,
    sides: calcState.sides,
    pages: calcState.pages,
    copies: calcState.copies,
    selectedFinishingIds: calcState.finishingIds,
  });

  const waUrl = buildWhatsAppUrl(state.shopInfo?.whatsapp, buildWhatsAppMessage(state, quote));

  return `
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">${t('print.title')}</h1>
        <p class="page-sub">${t('print.subtitle')}</p>
      </div>

      <div class="calc-layout">
        <div class="grid-1">
          <!-- Step 1: Upload -->
          <section class="sheet-card">
            <h2 style="margin-top:0;">${t('print.step1')}</h2>
            <div class="dropzone" id="print-dropzone" tabindex="0" role="button">
              <input type="file" id="print-file-input" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.pptx" />
              <div class="dropzone-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p class="dropzone-title">${t('print.dropTitle')}</p>
              <p class="dropzone-sub">${t('print.dropOr')}</p>
              <span class="btn btn-dark btn-sm">${calcState.file ? t('print.changeFile') : t('print.chooseFile')}</span>
              <p class="dropzone-formats">${t('print.dropFormats', { maxMb })}</p>
            </div>

            ${calcState.inspecting ? `<div class="alert alert-info" style="margin-top:12px;">${t('print.readingPdf')}</div>` : ''}
            ${calcState.fileError ? `<div class="alert alert-error" style="margin-top:12px;">${escapeHtml(calcState.fileError)}</div>` : ''}

            ${calcState.file && !calcState.inspecting ? `
              <div class="file-preview-box">
                ${calcState.thumbnailUrl ? `<img class="file-thumb" src="${calcState.thumbnailUrl}" alt="${escapeHtml(calcState.fileName)}" width="66" height="86" />` : ''}
                <div class="file-meta">
                  <div class="file-name">${escapeHtml(calcState.fileName)}</div>
                  <div class="section-sub" style="font-size:0.86rem;">
                    ${formatFileSize(calcState.fileSize)} · <strong>${t('print.pagesDetected', { pages: formatNumber(calcState.pages) })}</strong>
                  </div>
                </div>
              </div>
            ` : ''}

            ${calcState.isEstimated ? `
              <div class="alert alert-warn" style="margin-top:12px;">${t('print.estimatedNotice')}</div>
              <div class="field" style="margin-top:10px;">
                <label class="field-label" for="manual-pages-input">${t('print.manualPages')}</label>
                <input id="manual-pages-input" type="number" min="1" max="10000" class="input" value="${calcState.pages}" />
              </div>
            ` : ''}
          </section>

          <!-- Step 2: Settings -->
          <section class="card" style="margin-top:18px;">
            <h2 style="margin-top:0;">${t('print.step2')}</h2>

            <div class="field">
              <span class="field-label">${t('print.paperSize')}</span>
              <div class="seg-group" role="group" aria-label="${t('print.paperSize')}">
                ${['A5', 'A4', 'A3'].map((sz) => `
                  <button type="button" class="seg-btn js-paper-btn ${calcState.paperSize === sz ? 'active' : ''}" data-val="${sz}">${sz}</button>
                `).join('')}
              </div>
            </div>

            <div class="field">
              <span class="field-label">${t('print.colorMode')}</span>
              <div class="seg-group" role="group" aria-label="${t('print.colorMode')}">
                <button type="button" class="seg-btn js-color-btn ${calcState.colorMode === 'bw' ? 'active' : ''}" data-val="bw">${t('print.bw')}</button>
                <button type="button" class="seg-btn js-color-btn ${calcState.colorMode === 'color' ? 'active' : ''}" data-val="color">${t('print.color')}</button>
              </div>
            </div>

            <div class="field">
              <span class="field-label">${t('print.sides')}</span>
              <div class="seg-group" role="group" aria-label="${t('print.sides')}">
                <button type="button" class="seg-btn js-sides-btn ${calcState.sides === 'single' ? 'active' : ''}" data-val="single">${t('print.single')}</button>
                <button type="button" class="seg-btn js-sides-btn ${calcState.sides === 'double' ? 'active' : ''}" data-val="double">${t('print.double')}</button>
              </div>
            </div>

            <div class="field">
              <label class="field-label" for="copies-input">${t('print.copies')}</label>
              <div class="stepper">
                <button type="button" id="copies-minus" aria-label="Decrease copies">−</button>
                <input id="copies-input" type="number" min="1" max="100000" value="${calcState.copies}" />
                <button type="button" id="copies-plus" aria-label="Increase copies">+</button>
              </div>
            </div>

            ${(state.finishing || []).length > 0 ? `
              <div class="field">
                <span class="field-label">${t('print.finishing')}</span>
                <div class="check-list">
                  ${state.finishing.map((opt) => {
                    const checked = calcState.finishingIds.includes(opt.id);
                    const suffix = opt.price_type === 'per_copy' ? `× ${t('admin.prices.perCopy')}` : t('admin.prices.flat');
                    return `
                      <label class="check-item">
                        <span class="check-left">
                          <input type="checkbox" class="js-finishing-cb" value="${escapeHtml(opt.id)}" ${checked ? 'checked' : ''} />
                          <span>${escapeHtml(localize(opt, 'name'))}</span>
                        </span>
                        <span style="font-size:0.85rem;color:var(--ink-muted);">${formatCurrency(opt.price, currency)} (${suffix})</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <div class="field" style="margin-bottom:0;">
              <label class="field-label" for="print-notes">${t('print.notes')}</label>
              <textarea id="print-notes" class="textarea" placeholder="${escapeHtml(t('print.notesPlaceholder'))}">${escapeHtml(calcState.notes)}</textarea>
            </div>
          </section>
        </div>

        <!-- Step 3 & 4: Sticky Price + Order Form -->
        <aside class="calc-sticky">
          <section class="sheet-card">
            <h2 style="margin-top:0;">${t('print.step3')}</h2>

            ${!calcState.file ? `<div class="alert alert-info">${t('print.uploadPrompt')}</div>` : ''}

            ${quote.available ? `
              <div class="breakdown-list">
                <div class="breakdown-row">
                  <span>${t('print.pricePerPage')}</span>
                  <strong>${formatCurrency(quote.unitPrice, currency)}</strong>
                </div>
                <div class="breakdown-row">
                  <span>${t('print.pagesCost', { pages: formatNumber(quote.pages), copies: formatNumber(quote.copies) })}</span>
                  <strong>${formatCurrency(quote.pagesCost, currency)}</strong>
                </div>
                ${quote.discountPercent > 0 ? `
                  <div class="breakdown-row discount">
                    <span>${t('print.discount', { pct: quote.discountPercent })}</span>
                    <strong>−${formatCurrency(quote.discountAmount, currency)}</strong>
                  </div>
                ` : ''}
                ${quote.finishingTotal > 0 ? `
                  <div class="breakdown-row">
                    <span>${t('print.finishingCost')}</span>
                    <strong>${formatCurrency(quote.finishingTotal, currency)}</strong>
                  </div>
                ` : ''}
                ${quote.minApplied ? `
                  <div class="breakdown-row" style="color:var(--ink-muted);font-size:0.84rem;">
                    <span>${t('print.minOrderApplied', { min: formatCurrency(quote.minTotal, currency) })}</span>
                  </div>
                ` : ''}
              </div>

              <div class="total-box">
                <span>${t('print.total')}</span>
                <strong id="print-total-display">${formatCurrency(quote.total, currency)}</strong>
              </div>

              ${quote.nextDiscountTier ? `
                <div class="alert alert-info" style="font-size:0.84rem;">
                  ${t('print.upsellHint', {
                    more: formatNumber(quote.nextDiscountTier.more_needed),
                    target: formatNumber(quote.nextDiscountTier.min_copies),
                    pct: quote.nextDiscountTier.discount_percent,
                  })}
                </div>
              ` : ''}
            ` : `<div class="alert alert-error">${t('common.error')}</div>`}

            <hr style="border:none;border-top:1px solid var(--border);margin:18px 0;" />

            <h2 style="margin-top:0;">${t('print.step4')}</h2>
            <form id="print-order-form" novalidate>
              <input type="text" name="website" id="hp-print" class="hp-field" tabindex="-1" autocomplete="off" value="${escapeHtml(calcState.honeypot)}" />

              <div class="field">
                <label class="field-label" for="cust-name">${t('print.customerName')} *</label>
                <input id="cust-name" class="input" type="text" required value="${escapeHtml(calcState.customerName)}" />
              </div>

              <div class="field">
                <label class="field-label" for="cust-phone">${t('print.customerPhone')} *</label>
                <input id="cust-phone" class="input" type="tel" required placeholder="010xxxxxxxx" value="${escapeHtml(calcState.phone)}" />
              </div>

              <div class="field">
                <span class="field-label">${t('print.deliveryType')}</span>
                <div class="seg-group">
                  <button type="button" class="seg-btn js-delivery-btn ${calcState.deliveryType === 'pickup' ? 'active' : ''}" data-val="pickup">${t('print.pickup')}</button>
                  <button type="button" class="seg-btn js-delivery-btn ${calcState.deliveryType === 'delivery' ? 'active' : ''}" data-val="delivery">${t('print.delivery')}</button>
                </div>
              </div>

              ${calcState.deliveryType === 'delivery' ? `
                <div class="field">
                  <label class="field-label" for="cust-address">${t('print.address')} *</label>
                  <input id="cust-address" class="input" type="text" required placeholder="${escapeHtml(t('print.addressPlaceholder'))}" value="${escapeHtml(calcState.address)}" />
                </div>
              ` : ''}

              ${calcState.submitError ? `<div class="alert alert-error">${escapeHtml(calcState.submitError)}</div>` : ''}

              <div style="display:grid;gap:10px;">
                <button type="submit" class="btn btn-primary btn-block" id="confirm-print-btn" ${!ordersEnabled || calcState.submitting || calcState.inspecting ? 'disabled' : ''}>
                  ${calcState.submitting ? t('print.submitting') : t('print.confirmOrder')}
                </button>
                <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-block">
                  ${t('print.sendWhatsApp')}
                </a>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  `;
}

function renderSuccessView(state) {
  const res = calcState.orderResult;
  const currency = state.shopInfo?.currency || 'EGP';
  const quote = calculatePrintQuote({
    prices: state.printPrices,
    discounts: state.discounts,
    finishingOptions: state.finishing,
    minOrderTotal: state.printConfig?.min_order_total ?? 10,
    paperSize: calcState.paperSize,
    colorMode: calcState.colorMode,
    sides: calcState.sides,
    pages: calcState.pages,
    copies: calcState.copies,
    selectedFinishingIds: calcState.finishingIds,
  });
  const waUrl = buildWhatsAppUrl(
    state.shopInfo?.whatsapp,
    buildWhatsAppMessage(state, { ...quote, total: res.total }, res.order_code)
  );

  return `
    <div class="container" style="max-width:640px;padding-block:36px;">
      <section class="sheet-card" style="text-align:center;">
        <div class="step-num" style="margin-inline:auto;width:48px;height:48px;font-size:1.3rem;background:var(--success-bg);color:var(--success);">✓</div>
        <h1 style="margin:6px 0 8px;">${t('print.successTitle')}</h1>
        <p class="section-sub">${t('print.successSub')}</p>

        <div class="total-box" style="margin-top:20px;">
          <span>${t('print.orderCode')}</span>
          <strong style="letter-spacing:0.04em;">${escapeHtml(res.order_code)}</strong>
        </div>

        <div class="breakdown-list" style="text-align:start;">
          <div class="breakdown-row"><span>${t('print.waFile')}</span><strong>${escapeHtml(calcState.fileName)}</strong></div>
          <div class="breakdown-row"><span>${t('print.waSpecs')}</span><strong>${calcState.paperSize} · ${t(`print.${calcState.colorMode}`)} · ${t(`print.${calcState.sides}`)}</strong></div>
          <div class="breakdown-row"><span>${t('print.waPages')} / ${t('print.waCopies')}</span><strong>${formatNumber(calcState.pages)} × ${formatNumber(calcState.copies)}</strong></div>
          <div class="breakdown-row"><span>${t('print.total')}</span><strong>${formatCurrency(res.total, currency)}</strong></div>
        </div>

        <div style="display:grid;gap:10px;margin-top:20px;">
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-block">${t('print.sendWhatsApp')}</a>
          <button type="button" class="btn btn-outline btn-block" id="start-new-print-btn">${t('print.newOrder')}</button>
        </div>
      </section>
    </div>
  `;
}

export function bindPrintEvents(state, rerender) {
  if (calcState.orderResult) {
    const newBtn = document.getElementById('start-new-print-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        Object.assign(calcState, {
          file: null,
          fileName: '',
          fileSize: 0,
          fileType: '',
          fileExt: '',
          thumbnailUrl: '',
          fileError: '',
          isEstimated: false,
          pages: 1,
          finishingIds: [],
          notes: '',
          submitError: '',
          orderResult: null,
        });
        rerender();
      });
    }
    return;
  }

  const dropzone = document.getElementById('print-dropzone');
  const fileInput = document.getElementById('print-file-input');

  const handleFile = async (file) => {
    if (!file) return;
    const maxMb = Number(state.printConfig?.max_file_mb || 50);
    const ext = getExt(file.name);

    calcState.fileError = '';
    calcState.submitError = '';

    if (!ALLOWED_EXTS.includes(ext)) {
      calcState.file = null;
      calcState.fileError = t('print.fileUnsupported');
      rerender();
      return;
    }

    if (file.size > maxMb * 1024 * 1024) {
      calcState.file = null;
      calcState.fileError = t('print.fileTooBig', { maxMb });
      rerender();
      return;
    }

    calcState.file = file;
    calcState.fileName = file.name;
    calcState.fileSize = file.size;
    calcState.fileType = file.type || ext;
    calcState.fileExt = ext;
    calcState.thumbnailUrl = '';
    calcState.isEstimated = ext === 'docx' || ext === 'pptx';

    if (ext === 'pdf') {
      calcState.inspecting = true;
      rerender();
      try {
        const info = await inspectPdfFile(file);
        calcState.pages = info.pages;
        calcState.thumbnailUrl = info.thumbnailUrl;
      } catch (err) {
        calcState.file = null;
        calcState.fileError = err.code === 'PDF_ENCRYPTED' ? t('print.pdfEncrypted') : t('print.pdfInvalid');
      } finally {
        calcState.inspecting = false;
        rerender();
      }
      return;
    }

    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      calcState.pages = 1;
      calcState.thumbnailUrl = await createImageThumbnail(file);
      rerender();
      return;
    }

    // docx / pptx
    calcState.pages = Math.max(1, calcState.pages || 1);
    rerender();
  };

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', (e) => handleFile(e.target.files?.[0]));
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handleFile(e.dataTransfer?.files?.[0]);
    });
  }

  const manualPages = document.getElementById('manual-pages-input');
  if (manualPages) {
    manualPages.addEventListener('input', (e) => {
      calcState.pages = Math.max(1, Math.min(10000, Math.floor(Number(e.target.value) || 1)));
      rerender({ preserveFocusId: 'manual-pages-input' });
    });
  }

  document.querySelectorAll('.js-paper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      calcState.paperSize = btn.dataset.val;
      rerender();
    });
  });

  document.querySelectorAll('.js-color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      calcState.colorMode = btn.dataset.val;
      rerender();
    });
  });

  document.querySelectorAll('.js-sides-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      calcState.sides = btn.dataset.val;
      rerender();
    });
  });

  const copiesMinus = document.getElementById('copies-minus');
  const copiesPlus = document.getElementById('copies-plus');
  const copiesInput = document.getElementById('copies-input');
  if (copiesMinus) {
    copiesMinus.addEventListener('click', () => {
      calcState.copies = Math.max(1, calcState.copies - 1);
      rerender();
    });
  }
  if (copiesPlus) {
    copiesPlus.addEventListener('click', () => {
      calcState.copies = Math.min(100000, calcState.copies + 1);
      rerender();
    });
  }
  if (copiesInput) {
    copiesInput.addEventListener('input', (e) => {
      calcState.copies = Math.max(1, Math.min(100000, Math.floor(Number(e.target.value) || 1)));
      rerender({ preserveFocusId: 'copies-input' });
    });
  }

  document.querySelectorAll('.js-finishing-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.value;
      if (cb.checked) {
        if (!calcState.finishingIds.includes(id)) calcState.finishingIds.push(id);
      } else {
        calcState.finishingIds = calcState.finishingIds.filter((x) => x !== id);
      }
      rerender();
    });
  });

  const notesEl = document.getElementById('print-notes');
  if (notesEl) {
    notesEl.addEventListener('input', (e) => {
      calcState.notes = e.target.value;
    });
  }

  const nameEl = document.getElementById('cust-name');
  const phoneEl = document.getElementById('cust-phone');
  const addrEl = document.getElementById('cust-address');
  const hpEl = document.getElementById('hp-print');
  if (nameEl) nameEl.addEventListener('input', (e) => (calcState.customerName = e.target.value));
  if (phoneEl) phoneEl.addEventListener('input', (e) => (calcState.phone = e.target.value));
  if (addrEl) addrEl.addEventListener('input', (e) => (calcState.address = e.target.value));
  if (hpEl) hpEl.addEventListener('input', (e) => (calcState.honeypot = e.target.value));

  document.querySelectorAll('.js-delivery-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      calcState.deliveryType = btn.dataset.val;
      rerender();
    });
  });

  const form = document.getElementById('print-order-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      calcState.submitError = '';

      if (!calcState.file) {
        calcState.submitError = t('print.needFileFirst');
        rerender();
        return;
      }
      if (calcState.customerName.trim().length < 2) {
        calcState.submitError = t('print.validationName');
        rerender();
        return;
      }
      const digits = calcState.phone.replace(/[^0-9+]/g, '');
      if (digits.length < 8) {
        calcState.submitError = t('print.validationPhone');
        rerender();
        return;
      }
      if (calcState.deliveryType === 'delivery' && calcState.address.trim().length < 4) {
        calcState.submitError = t('print.validationAddress');
        rerender();
        return;
      }

      calcState.submitting = true;
      rerender();

      try {
        const filePath = await uploadPrintFile(calcState.file);
        const result = await submitPrintOrder({
          customerName: calcState.customerName.trim(),
          phone: calcState.phone.trim(),
          deliveryType: calcState.deliveryType,
          address: calcState.address.trim(),
          notes: calcState.notes.trim(),
          paperSize: calcState.paperSize,
          colorMode: calcState.colorMode,
          sides: calcState.sides,
          pages: calcState.pages,
          copies: calcState.copies,
          finishingIds: calcState.finishingIds,
          filePath,
          fileName: calcState.fileName,
          fileType: calcState.fileType,
          fileSize: calcState.fileSize,
          isEstimated: calcState.isEstimated,
          honeypot: calcState.honeypot,
        });
        calcState.orderResult = result;
        showToast(`${t('print.orderCode')}: ${result.order_code}`, 'success');
      } catch (err) {
        if (err.message === 'SUPABASE_NOT_CONFIGURED') {
          calcState.submitError = t('common.demoBanner');
        } else if (err.message?.includes('ORDERS_PAUSED')) {
          calcState.submitError = t('common.pausedBanner');
        } else {
          calcState.submitError = err.message || t('common.error');
        }
      } finally {
        calcState.submitting = false;
        rerender();
      }
    });
  }
}
