import { tier } from './rarity.js';
const pick = a => a[Math.floor(Math.random() * a.length)];

export function generatePack(cards, cardsPerPack = 10, forceTier = null) {
  const pool = { common: [], uncommon: [], rare: [], holo: [], ultra: [], secret: [] };
  cards.forEach(c => pool[tier(c.rarity)].push(c));
  const take = (t, n) => {
    const src = pool[t].length ? pool[t] : cards, out = [];
    for (let i = 0; i < n; i++) out.push(pick(src));
    return out;
  };
  let hit = forceTier;
  if (!hit) {
    const r = Math.random();
    hit = r < 0.03 && pool.secret.length ? 'secret'
        : r < 0.15 && pool.ultra.length ? 'ultra'
        : r < 0.40 && pool.holo.length ? 'holo' : 'rare';
  }
  return [...take('common', 4), ...take('uncommon', 3), ...take('common', 1),
          ...take('uncommon', 1), ...take(hit, 1)].slice(0, cardsPerPack);
}
