export function getCurrentRoute() {
  const raw = window.location.hash || '#/';
  const cleaned = raw.replace(/^#/, '');
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export function setNoIndexMeta(isNoIndex) {
  let meta = document.querySelector('meta[name="robots"]');
  if (isNoIndex) {
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
  } else if (meta) {
    meta.remove();
  }
}
