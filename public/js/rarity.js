export function tier(r = '') {
  r = r.toLowerCase();
  if (/(secret|hyper|special illustration|rainbow|gold)/.test(r)) return 'secret';
  if (/(illustration rare|ultra|full art|vmax|vstar|shiny|amazing|\bex\b|\bv\b)/.test(r)) return 'ultra';
  if (/holo/.test(r)) return 'holo';
  if (/rare/.test(r)) return 'rare';
  if (/uncommon/.test(r)) return 'uncommon';
  return 'common';
}
export const TIER_RANK = { common: 0, uncommon: 1, rare: 2, holo: 3, ultra: 4, secret: 5 };
