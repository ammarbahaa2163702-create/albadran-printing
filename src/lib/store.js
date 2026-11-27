import { FALLBACK_DATA, fetchPublicBootstrap } from './supabase.js';

const CART_KEY = 'ab_cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // ignore storage errors
  }
}

export const state = {
  loaded: false,
  loading: false,
  error: null,
  demo: true,
  shopInfo: { ...FALLBACK_DATA.shop_info },
  printConfig: { ...FALLBACK_DATA.print_config },
  printPrices: [...FALLBACK_DATA.print_prices],
  discounts: [...FALLBACK_DATA.quantity_discounts],
  finishing: [...FALLBACK_DATA.finishing_options],
  categories: [...FALLBACK_DATA.categories],
  products: [...FALLBACK_DATA.products],
  cart: loadCart(),
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

export async function refreshCatalog(force = false) {
  if (state.loading) return;
  if (state.loaded && !force) return;
  state.loading = true;
  state.error = null;
  notify();

  try {
    const data = await fetchPublicBootstrap();
    state.demo = Boolean(data.demo);
    state.shopInfo = data.shop_info;
    state.printConfig = data.print_config;
    state.printPrices = data.print_prices;
    state.discounts = data.quantity_discounts;
    state.finishing = data.finishing_options;
    state.categories = data.categories;
    state.products = data.products;
    state.loaded = true;
  } catch (err) {
    state.error = err.message || 'Failed to load data';
  } finally {
    state.loading = false;
    notify();
  }
}

export function addToCart(product, qty = 1) {
  const existing = state.cart.find((item) => item.id === product.id);
  const maxStock = Number(product.stock ?? 999);
  if (maxStock <= 0) return;

  if (existing) {
    existing.qty = Math.min(maxStock, existing.qty + qty);
  } else {
    state.cart.push({
      id: product.id,
      name_en: product.name_en,
      name_ar: product.name_ar,
      price: Number(product.price),
      image_url: product.image_url || '',
      stock: maxStock,
      qty: Math.min(maxStock, Math.max(1, qty)),
    });
  }
  saveCart(state.cart);
  notify();
}

export function updateCartQty(productId, qty) {
  const nextQty = Math.floor(Number(qty) || 0);
  if (nextQty <= 0) {
    removeFromCart(productId);
    return;
  }
  const item = state.cart.find((i) => i.id === productId);
  if (!item) return;
  const liveProduct = state.products.find((p) => p.id === productId);
  const maxStock = liveProduct ? Number(liveProduct.stock) : item.stock || 999;
  item.qty = Math.min(maxStock, nextQty);
  saveCart(state.cart);
  notify();
}

export function removeFromCart(productId) {
  state.cart = state.cart.filter((i) => i.id !== productId);
  saveCart(state.cart);
  notify();
}

export function clearCart() {
  state.cart = [];
  saveCart(state.cart);
  notify();
}

export function getCartCount() {
  return state.cart.reduce((sum, i) => sum + (i.qty || 0), 0);
}

export function getCartTotal() {
  return state.cart.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
}

export function showToast(message, type = 'info') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-leave');
    setTimeout(() => el.remove(), 260);
  }, 3200);
}
