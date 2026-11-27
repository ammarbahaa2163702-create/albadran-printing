import { t, localize } from '../i18n/index.js';
import { formatCurrency, escapeHtml, buildWhatsAppUrl } from '../lib/format.js';
import { findUnitPrice } from '../lib/pricing.js';
import { addToCart, showToast } from '../lib/store.js';
import { renderProductMedia } from '../components/productThumb.js';

export function renderHome(state) {
  const info = state.shopInfo || {};
  const currency = info.currency || 'EGP';
  const baseA4 = findUnitPrice(state.printPrices, {
    paperSize: 'A4',
    colorMode: 'bw',
    sides: 'single',
  });
  const startingRate = baseA4 !== null ? formatCurrency(baseA4, currency) : t('home.statsRateVal');
  const featured = (state.products || []).slice(0, 3);
  const waUrl = buildWhatsAppUrl(info.whatsapp, '');

  return `
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="badge-pill">
            <span class="reg-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            ${t('home.badge')}
          </span>
          <h1 class="hero-title">${t('home.heroTitle')}</h1>
          <p class="hero-sub">${t('home.heroSub')}</p>
          <div class="hero-cta-row">
            <a href="#/print" class="btn btn-primary">${t('home.heroCta')}</a>
            <a href="#/shop" class="btn btn-outline">${t('home.heroShop')}</a>
          </div>
          <div class="hero-stats">
            <div class="stat-box">
              <small>${t('home.statsRate')}</small>
              <strong>${escapeHtml(startingRate)}</strong>
            </div>
            <div class="stat-box">
              <small>${t('home.statsTurnaround')}</small>
              <strong>${t('home.statsTurnaroundVal')}</strong>
            </div>
            <div class="stat-box">
              <small>${t('home.statsPrivacy')}</small>
              <strong>${t('home.statsPrivacyVal')}</strong>
            </div>
          </div>
        </div>

        <aside class="specimen-sheet sheet-card" aria-label="Sample print quote">
          <div class="specimen-header">
            <strong>JOB SPECIMEN · A4</strong>
            <span>CMYK / B&amp;W</span>
          </div>
          <div class="specimen-row"><span>${t('print.paperSize')}</span><strong>A4</strong></div>
          <div class="specimen-row"><span>${t('print.colorMode')}</span><strong>${t('print.bw')}</strong></div>
          <div class="specimen-row"><span>${t('print.pricePerPage')}</span><strong>${escapeHtml(startingRate)}</strong></div>
          <div class="specimen-row"><span>100 ${t('print.copies')}</span><strong>−10%</strong></div>
          <div class="specimen-total">
            <span>${t('print.step3')}</span>
            <a href="#/print" class="btn btn-primary btn-sm">${t('home.heroCta')}</a>
          </div>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <h2 class="section-title">${t('home.stepsTitle')}</h2>
            <p class="section-sub">${t('home.stepsSub')}</p>
          </div>
        </div>
        <div class="grid-4">
          <article class="card">
            <span class="step-num">1</span>
            <h3>${t('home.step1Title')}</h3>
            <p class="section-sub">${t('home.step1Desc')}</p>
          </article>
          <article class="card">
            <span class="step-num">2</span>
            <h3>${t('home.step2Title')}</h3>
            <p class="section-sub">${t('home.step2Desc')}</p>
          </article>
          <article class="card">
            <span class="step-num">3</span>
            <h3>${t('home.step3Title')}</h3>
            <p class="section-sub">${t('home.step3Desc')}</p>
          </article>
          <article class="card">
            <span class="step-num">4</span>
            <h3>${t('home.step4Title')}</h3>
            <p class="section-sub">${t('home.step4Desc')}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section" style="background: var(--surface-alt); border-block: 1px solid var(--border);">
      <div class="container">
        <div class="section-head">
          <div>
            <h2 class="section-title">${t('home.servicesTitle')}</h2>
            <p class="section-sub">${t('home.servicesSub')}</p>
          </div>
        </div>
        <div class="grid-3">
          <article class="card">
            <h3>${t('home.srv1Title')}</h3>
            <p class="section-sub">${t('home.srv1Desc')}</p>
          </article>
          <article class="card">
            <h3>${t('home.srv2Title')}</h3>
            <p class="section-sub">${t('home.srv2Desc')}</p>
          </article>
          <article class="card">
            <h3>${t('home.srv3Title')}</h3>
            <p class="section-sub">${t('home.srv3Desc')}</p>
          </article>
        </div>
      </div>
    </section>

    ${featured.length > 0 ? `
      <section class="section">
        <div class="container">
          <div class="section-head">
            <h2 class="section-title">${t('home.featuredTitle')}</h2>
            <a href="#/shop" class="btn btn-outline btn-sm">${t('home.featuredAll')}</a>
          </div>
          <div class="grid-3">
            ${featured.map((p) => {
              const name = localize(p, 'name');
              const out = Number(p.stock) <= 0;
              return `
                <article class="card product-card">
                  <div>
                    <div class="product-img-wrap">${renderProductMedia(p, name)}</div>
                    <h3 class="product-title">${escapeHtml(name)}</h3>
                    <div class="product-price">${formatCurrency(p.price, currency)}</div>
                  </div>
                  <div class="product-actions">
                    <button type="button" class="btn btn-dark btn-sm btn-block js-home-add" data-id="${escapeHtml(p.id)}" ${out ? 'disabled' : ''}>
                      ${out ? t('shop.outOfStock') : t('shop.addToCart')}
                    </button>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    ` : ''}

    <section class="section" id="contact">
      <div class="container">
        <div class="sheet-card">
          <div class="section-head">
            <h2 class="section-title">${t('home.contactTitle')}</h2>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">${t('home.contactWhatsApp')}</a>
          </div>
          <div class="grid-3">
            <div>
              <strong>${t('home.contactAddress')}</strong>
              <p class="section-sub">${escapeHtml(localize(info, 'address'))}</p>
            </div>
            <div>
              <strong>${t('home.contactHours')}</strong>
              <p class="section-sub">${escapeHtml(localize(info, 'hours'))}</p>
            </div>
            <div>
              <strong>${t('home.contactPhone')}</strong>
              <p class="section-sub"><a href="tel:${escapeHtml(info.phone)}">${escapeHtml(info.phone)}</a></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindHomeEvents(state) {
  document.querySelectorAll('.js-home-add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = state.products.find((p) => p.id === btn.dataset.id);
      if (!prod) return;
      addToCart(prod, 1);
      showToast(t('shop.added'), 'success');
    });
  });
}
