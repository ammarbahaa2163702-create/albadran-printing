/**
 * Pure pricing engine matching supabase/schema.sql create_print_order().
 */

export function findUnitPrice(prices, { paperSize, colorMode, sides }) {
  const match = (prices || []).find(
    (p) =>
      p.active !== false &&
      p.paper_size === paperSize &&
      p.color_mode === colorMode &&
      p.sides === sides
  );
  return match ? Number(match.price_per_page) : null;
}

export function calculatePrintQuote({
  prices,
  discounts,
  finishingOptions,
  minOrderTotal = 10,
  paperSize,
  colorMode,
  sides,
  pages,
  copies,
  selectedFinishingIds = [],
}) {
  const unitPrice = findUnitPrice(prices, { paperSize, colorMode, sides });
  if (unitPrice === null) {
    return { available: false, unitPrice: 0, total: 0 };
  }

  const safePages = Math.max(1, Math.floor(Number(pages) || 1));
  const safeCopies = Math.max(1, Math.floor(Number(copies) || 1));

  const pagesCost = round2(safePages * safeCopies * unitPrice);

  const sortedDiscounts = [...(discounts || [])]
    .map((d) => ({
      min_copies: Number(d.min_copies),
      discount_percent: Number(d.discount_percent),
    }))
    .filter((d) => d.min_copies >= 2 && d.discount_percent > 0)
    .sort((a, b) => a.min_copies - b.min_copies);

  let discountPercent = 0;
  let nextDiscountTier = null;
  for (const tier of sortedDiscounts) {
    if (safeCopies >= tier.min_copies) {
      if (tier.discount_percent > discountPercent) {
        discountPercent = tier.discount_percent;
      }
    } else if (!nextDiscountTier && tier.discount_percent > discountPercent) {
      nextDiscountTier = {
        min_copies: tier.min_copies,
        discount_percent: tier.discount_percent,
        more_needed: tier.min_copies - safeCopies,
      };
    }
  }

  const subtotal = round2(pagesCost * (1 - discountPercent / 100));
  const discountAmount = round2(pagesCost - subtotal);

  const activeFinishing = (finishingOptions || []).filter((f) => f.active !== false);
  const selectedSet = new Set(selectedFinishingIds);
  let finishingTotal = 0;
  const chosenFinishing = [];

  for (const opt of activeFinishing) {
    if (!selectedSet.has(opt.id)) continue;
    const price = Number(opt.price);
    const amount = opt.price_type === 'per_copy' ? round2(price * safeCopies) : round2(price);
    finishingTotal = round2(finishingTotal + amount);
    chosenFinishing.push({ ...opt, amount });
  }

  const rawTotal = round2(subtotal + finishingTotal);
  const minTotal = Number(minOrderTotal) || 0;
  const minApplied = rawTotal < minTotal;
  const total = round2(Math.max(rawTotal, minTotal));

  return {
    available: true,
    unitPrice,
    pages: safePages,
    copies: safeCopies,
    pagesCost,
    discountPercent,
    discountAmount,
    subtotal,
    finishingTotal,
    chosenFinishing,
    minApplied,
    minTotal,
    total,
    nextDiscountTier,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
