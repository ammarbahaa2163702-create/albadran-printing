/**
 * Lazy-loaded PDF inspection using pdfjs-dist.
 * Only fetched when the customer actually selects a PDF file.
 */

let pdfjsReady = null;

async function getPdfJs() {
  if (!pdfjsReady) {
    pdfjsReady = (async () => {
      const [pdfjs, workerUrlMod] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => import('pdfjs-dist')),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
      return pdfjs;
    })();
  }
  return pdfjsReady;
}

export async function inspectPdfFile(file) {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      const e = new Error('PDF_ENCRYPTED');
      e.code = 'PDF_ENCRYPTED';
      throw e;
    }
    const e = new Error('PDF_INVALID');
    e.code = 'PDF_INVALID';
    throw e;
  }

  const pages = doc.numPages;
  let thumbnailUrl = '';

  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = 220;
    const scale = targetWidth / viewport.width;
    const thumbViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(thumbViewport.width);
    canvas.height = Math.round(thumbViewport.height);
    const ctx = canvas.getContext('2d');

    if (ctx) {
      await page.render({ canvasContext: ctx, viewport: thumbViewport }).promise;
      thumbnailUrl = canvas.toDataURL('image/webp', 0.8);
    }
  } catch {
    // Thumbnail is optional; page count still succeeded
  } finally {
    try {
      await doc.destroy();
    } catch {
      // ignore cleanup errors
    }
  }

  return { pages, thumbnailUrl };
}

export function createImageThumbnail(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 220;
        const ratio = Math.min(1, maxW / (img.naturalWidth || maxW));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.8));
      } catch {
        resolve('');
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}
