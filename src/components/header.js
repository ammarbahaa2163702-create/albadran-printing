import { getLang, toggleLang, t } from '../i18n/index.js';
import { getCartCount } from '../lib/store.js';

export function renderHeader(currentRoute, state) {
  const lang = getLang();
  const cartCount = getCartCount();
  const isHome = currentRoute === '/' || currentRoute === '';
  const isPrint = currentRoute.startsWith('/print');
  const isShop = currentRoute.startsWith('/shop');
  const isCart = currentRoute.startsWith('/cart');

  return `
    <div class="cmyk-bar" aria-hidden="true">
      <span></span><span></span><span></span><span></span>
    </div>
    <header class="site-header">
      <div class="container header-inner">
        <a href="#/" class="brand-link" aria-label="${t('brand.name')}">
          <svg class="brand-mark" viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
            <rect width="40" height="40" rx="10" fill="#0F172A"/>
            <path d="M11 9h12l6 6v15a1.5 1.5 0 0 1-1.5 1.5H11A1.5 1.5 0 0 1 9.5 30V10.5A1.5 1.5 0 0 1 11 9z" fill="#FAF8F5"/>
            <path d="M23 9v6h6" fill="none" stroke="#0F172A" stroke-width="1.6"/>
            <circle cx="15" cy="23" r="2.2" fill="#00AEEF"/>
            <circle cx="20" cy="23" r="2.2" fill="#EC008C"/>
            <circle cx="25" cy="23" r="2.2" fill="#FACC15"/>
            <rect x="13" y="14.5" width="7.5" height="2" rx="1" fill="#0F172A"/>
          </svg>
          <span class="brand-text">
            <strong class="brand-name">${lang === 'ar' ? 'البدران للطباعة' : 'Al-Badran Printing'}</strong>
            <small class="brand-sub">${t('brand.tagline')}</small>
          </span>
        </a>

        <nav class="main-nav" id="main-nav" aria-label="Main navigation">
          <a href="#/" class="nav-link ${isHome ? 'active' : ''}">${t('nav.home')}</a>
          <a href="#/print" class="nav-link ${isPrint ? 'active' : ''}">${t('nav.print')}</a>
          <a href="#/shop" class="nav-link ${isShop ? 'active' : ''}">${t('nav.shop')}</a>
        </nav>

        <div class="header-actions">
          <a href="#/cart" class="icon-btn cart-btn ${isCart ? 'active' : ''}" aria-label="${t('nav.cart')}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span class="cart-badge ${cartCount > 0 ? '' : 'hidden'}" id="header-cart-badge">${cartCount}</span>
          </a>

          <button type="button" class="lang-btn" id="lang-toggle-btn" aria-label="Switch language">
            ${t('nav.langSwitch')}
          </button>

          <button type="button" class="icon-btn mobile-menu-btn" id="mobile-menu-btn" aria-label="${t('nav.menu')}" aria-expanded="false">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
    ${state.demo ? `<div class="notice-banner notice-demo"><div class="container">${t('common.demoBanner')}</div></div>` : ''}
    ${!state.printConfig?.orders_enabled ? `<div class="notice-banner notice-paused"><div class="container">${t('common.pausedBanner')}</div></div>` : ''}
  `;
}

export function bindHeaderEvents() {
  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => toggleLang());
  }

  const menuBtn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('main-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
}
