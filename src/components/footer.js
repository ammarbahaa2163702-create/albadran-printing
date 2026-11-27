import { t, localize } from '../i18n/index.js';
import { escapeHtml, buildWhatsAppUrl } from '../lib/format.js';

export function renderFooter(state) {
  const info = state.shopInfo || {};
  const waUrl = buildWhatsAppUrl(info.whatsapp, '');

  return `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <strong class="footer-brand">${escapeHtml(localize(info, 'name') || t('brand.name'))}</strong>
          <p class="footer-desc">${escapeHtml(t('brand.tagline'))}</p>
          <div class="reg-marks" aria-hidden="true">
            <span class="dot-c"></span><span class="dot-m"></span><span class="dot-y"></span><span class="dot-k"></span>
          </div>
        </div>
        <div>
          <h2 class="footer-heading" style="font-size:1rem;margin:0 0 8px;">${t('footer.quickLinks')}</h2>
          <ul class="footer-links">
            <li><a href="#/">${t('nav.home')}</a></li>
            <li><a href="#/print">${t('nav.print')}</a></li>
            <li><a href="#/shop">${t('nav.shop')}</a></li>
            <li><a href="#/cart">${t('nav.cart')}</a></li>
          </ul>
        </div>
        <div>
          <h2 class="footer-heading" style="font-size:1rem;margin:0 0 8px;">${t('footer.contact')}</h2>
          <p class="footer-meta">${escapeHtml(localize(info, 'address'))}</p>
          <p class="footer-meta">${escapeHtml(localize(info, 'hours'))}</p>
          <p class="footer-meta"><a href="tel:${escapeHtml(info.phone)}">${escapeHtml(info.phone)}</a> · <a href="${waUrl}" target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© ${new Date().getFullYear()} ${t('footer.rights')}</span>
      </div>
    </footer>
  `;
}
