// ─── PRODUCT ASSETS — mappa centralizzata setId → asset del prodotto fisico ───
// Un solo punto dove associare a ogni espansione il proprio booster/box.
// Aggiungere un set = aggiungere una voce qui (percorso locale in public/assets
// o URL). Nessun altro file va toccato.
//
// Esempio:
// "sv3pt5": {
//   pack: "assets/packs/sv3pt5.png",              // artwork reale del booster
//   box:  "assets/boxes/sv3pt5.png",              // artwork reale del box
//   variants: ["assets/packs/sv3pt5-mew.png",     // varianti artwork del booster
//              "assets/packs/sv3pt5-pika.png"]
// }
//
// Se il set non ha ancora asset dedicati NON si blocca nulla: l'app genera una
// skin dal logo e dal simbolo REALI del set (nessun artwork inventato).
export const productAssets = {
  // "base1":  { pack: "assets/packs/base1.png",  box: "assets/boxes/base1.png",  variants: [] },
  // "sv3pt5": { pack: "assets/packs/sv3pt5.png", box: "assets/boxes/sv3pt5.png", variants: [] },
};

// Risolve gli asset per un set: artwork reale se mappato (variante casuale se
// ce n'è più d'una), altrimenti fallback con logo+simbolo ufficiali del set.
export function resolveProduct(set) {
  const a = productAssets[set?.id] || {};
  const variants = [...(a.variants || [])];
  if (a.pack) variants.unshift(a.pack);
  return {
    packImage: variants.length ? variants[Math.floor(Math.random() * variants.length)] : null,
    boxImage: a.box || null,
    logo: set?.images?.logo || '',
    symbol: set?.images?.symbol || ''
  };
}

// Markup del booster: artwork reale quando esiste, altrimenti skin foil
// generata con pattern del simbolo del set + logo Pokémon del set.
export function packSkinHTML(prod) {
  if (prod.packImage) return `<img class="pakreal" src="${prod.packImage}" alt="">`;
  return `
    <div class="pakskin" style="--sym:url('${prod.symbol}')">
      <div class="pakpattern"></div>
      <img class="paklogo" src="${prod.logo}" alt="">
    </div>`;
}
