import './styles/main.css';
import { applyDocLang, onLangChange, t } from './i18n/index.js';
import { state, subscribe, refreshCatalog } from './lib/store.js';
import { renderHeader, bindHeaderEvents } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { getCurrentRoute, setNoIndexMeta } from './router.js';
import { renderHome, bindHomeEvents } from './pages/home.js';
import { renderPrintPage, bindPrintEvents } from './pages/print.js';
import { renderShopPage, bindShopEvents } from './pages/shop.js';
import { renderCartPage, bindCartEvents } from './pages/cart.js';

let adminModulePromise = null;
let loadedAdminModule = null;

function loadAdminModule() {
  if (!adminModulePromise) {
    adminModulePromise = import('./pages/admin/index.js').then((mod) => {
      loadedAdminModule = mod;
      return mod;
    });
  }
  return adminModulePromise;
}

function renderApp(opts = {}) {
  const root = document.getElementById('app');
  if (!root) return;

  const route = getCurrentRoute();
  const isAdmin = route.startsWith('/admin');
  setNoIndexMeta(isAdmin);

  let mainHtml = '';
  if (isAdmin) {
    if (loadedAdminModule) {
      mainHtml = loadedAdminModule.renderAdminPage(state, renderApp);
    } else {
      mainHtml = `<div class="container" style="padding-block:48px;text-align:center;">${t('common.loading')}</div>`;
      loadAdminModule().then(() => renderApp());
    }
  } else if (route.startsWith('/print')) {
    mainHtml = renderPrintPage(state);
  } else if (route.startsWith('/shop')) {
    mainHtml = renderShopPage(state);
  } else if (route.startsWith('/cart')) {
    mainHtml = renderCartPage(state);
  } else {
    mainHtml = renderHome(state);
  }

  // Preserve cursor position if re-rendering on live typing
  let focusInfo = null;
  if (opts.preserveFocusId) {
    const activeEl = document.getElementById(opts.preserveFocusId);
    if (activeEl) {
      focusInfo = {
        id: opts.preserveFocusId,
        start: activeEl.selectionStart,
        end: activeEl.selectionEnd,
      };
    }
  }

  root.innerHTML = `
    ${renderHeader(route, state)}
    <main id="main-content">${mainHtml}</main>
    ${renderFooter(state)}
  `;

  bindHeaderEvents();

  if (isAdmin) {
    if (loadedAdminModule) {
      loadedAdminModule.bindAdminEvents(state, renderApp);
    }
  } else if (route.startsWith('/print')) {
    bindPrintEvents(state, renderApp);
  } else if (route.startsWith('/shop')) {
    bindShopEvents(state, renderApp);
  } else if (route.startsWith('/cart')) {
    bindCartEvents(state, renderApp);
  } else {
    bindHomeEvents(state);
  }

  if (focusInfo) {
    const el = document.getElementById(focusInfo.id);
    if (el) {
      el.focus();
      try {
        if (typeof focusInfo.start === 'number') {
          el.setSelectionRange(focusInfo.start, focusInfo.end);
        }
      } catch {
        // number inputs don't support setSelectionRange
      }
    }
  }
}

applyDocLang();
renderApp();
refreshCatalog();

subscribe(() => renderApp());
onLangChange(() => renderApp());
window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
  renderApp();
});
