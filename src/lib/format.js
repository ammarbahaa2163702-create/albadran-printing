import { getLang } from '../i18n/index.js';

export function formatNumber(n, lang = getLang()) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG').format(num);
}

export function formatCurrency(amount, currency = 'EGP', lang = getLang()) {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  const label = lang === 'ar' && currency === 'EGP' ? 'ج.م' : currency;
  return `${formatted} ${label}`;
}

export function formatFileSize(bytes, lang = getLang()) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) {
    return `${formatNumber((bytes / 1024).toFixed(1), lang)} KB`;
  }
  return `${formatNumber((bytes / (1024 * 1024)).toFixed(2), lang)} MB`;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildWhatsAppUrl(phone, text) {
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
