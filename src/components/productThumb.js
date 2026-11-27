import { escapeHtml } from '../lib/format.js';

export function renderProductMedia(product, altText) {
  if (product.image_url) {
    return `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(altText)}" width="400" height="300" loading="lazy" decoding="async" />`;
  }
  return `
    <svg viewBox="0 0 240 180" width="240" height="180" aria-hidden="true">
      <rect width="240" height="180" fill="#F3EFE8"/>
      <rect x="64" y="34" width="112" height="112" rx="14" fill="#FFFFFF" stroke="#E2DDD5" stroke-width="2"/>
      <circle cx="96" cy="78" r="11" fill="#0095D9"/>
      <circle cx="120" cy="78" r="11" fill="#D81B60"/>
      <circle cx="144" cy="78" r="11" fill="#EAB308"/>
      <rect x="84" y="106" width="72" height="8" rx="4" fill="#0F172A" opacity="0.8"/>
      <rect x="96" y="121" width="48" height="6" rx="3" fill="#475569" opacity="0.45"/>
    </svg>
  `;
}
