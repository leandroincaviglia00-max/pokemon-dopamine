/* Salvataggio locale con profili separati per utente: 'guest' oppure l'email
   dell'account. Al login/logout si cambia profilo — i dati restano isolati. */
const USER = localStorage.getItem('pkd_user') || 'guest';
const KEY = 'pkd_v1:' + USER;

// migrazione: il vecchio salvataggio unico diventa il profilo guest
if (USER === 'guest' && !localStorage.getItem(KEY) && localStorage.getItem('pkd_v1')) {
  localStorage.setItem(KEY, localStorage.getItem('pkd_v1'));
  localStorage.removeItem('pkd_v1');
}

function base() { return { owned: {}, boxes: {}, activeBoxId: null, sound: true, stats: { packs: 0 } }; }
function load() {
  try {
    const s = Object.assign(base(), JSON.parse(localStorage.getItem(KEY)) || {});
    s.stats = Object.assign({ packs: 0 }, s.stats);
    return s;
  } catch { return base(); }
}
export const state = load();

let syncHook = null;
export function setSyncHook(fn) { syncHook = fn; }

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (syncHook) syncHook();          // push automatico verso l'account, se connesso
}

function slim(c) {
  return { id: c.id, name: c.name, number: c.number, rarity: c.rarity || 'Common',
    set: { id: c.set.id, name: c.set.name, total: c.set.printedTotal || c.set.total },
    images: c.images };
}
export function addCard(card) {
  const e = state.owned[card.id] || (state.owned[card.id] = { qty: 0, fav: false, t: 0, card: slim(card) });
  e.qty++; e.t = Date.now(); save(); return e;
}
export function toggleFav(id) {
  const e = state.owned[id]; if (e) { e.fav = !e.fav; save(); } return e?.fav;
}
