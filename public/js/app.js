import { state, save, toggleFav, setSyncHook } from './storage.js';
import { getSets, getSetCards } from './api.js';
import { createBox, activeBox, remaining } from './boxManager.js';
import { boxScreen, packScreen } from './pack.js';
import { resolveProduct, packSkinHTML } from './productAssets.js';
import { icon, iconFill } from './icons.js';
import * as auth from './auth.js';

const view = document.getElementById('view');
const subtitle = document.getElementById('subtitle');
const backBtn = document.getElementById('back');
const modal = document.getElementById('modal');
const tabbar = document.getElementById('tabbar');
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ── sync automatico verso l'account a ogni save() ── */
setSyncHook(auth.scheduleSync);

/* ── router con stack per il tasto indietro ── */
const stack = [];
function go(fn, sub = '') {
  stack.push({ fn, sub });
  subtitle.textContent = sub;
  backBtn.hidden = stack.length < 2;
  view.scrollTop = 0;
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  fn();
}
backBtn.innerHTML = icon('arrowleft');
backBtn.onclick = () => {
  if (stack.length < 2) return;
  stack.pop();
  const { fn, sub } = stack[stack.length - 1];
  subtitle.textContent = sub; backBtn.hidden = stack.length < 2; fn();
};

/* ── bottom navigation: icone + label, stato attivo ── */
const TABS = [
  ['home', 'Home', 'home'], ['sets', 'Espansioni', 'layers'],
  ['collection', 'Collezione', 'cards'], ['favorites', 'Preferiti', 'heart'],
  ['profile', 'Profilo', 'user']
];
tabbar.innerHTML = TABS.map(([k, l, i], n) =>
  `<button data-nav="${k}" class="${n === 0 ? 'on' : ''}">${icon(i, 21)}<span>${l}</span></button>`).join('');
tabbar.querySelectorAll('button').forEach(b => b.onclick = () => {
  tabbar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  stack.length = 0;
  const screens = {
    home, sets: setsScreen, collection: () => collectionScreen(false),
    favorites: () => collectionScreen(true), profile: profileScreen
  };
  go(screens[b.dataset.nav], b.dataset.nav === 'home' ? '' : b.querySelector('span').textContent);
  stack.length = 1; backBtn.hidden = true;
});

const soundBtn = document.getElementById('soundToggle');
const paintSound = () => soundBtn.innerHTML = icon(state.sound ? 'volume' : 'volumeoff', 18);
soundBtn.onclick = () => { state.sound = !state.sound; save(); paintSound(); };
paintSound();

/* ═══════════ AUTH ═══════════ */
function authScreen(mode = 'login') {
  document.body.classList.add('lock');
  const reg = mode === 'register';
  view.innerHTML = `
    <div class="authwrap">
      <div class="authlogo">POKÉMON<br>DOPAMINE</div>
      <h2>${reg ? 'Crea account' : 'Bentornato'}</h2>
      <p class="hint">${reg ? 'Collezione e preferiti sincronizzati su tutti i tuoi dispositivi.'
                            : 'Accedi per ritrovare la tua collezione.'}</p>
      <label class="field">${icon('mail', 18)}<input id="em" type="email" placeholder="Email" autocomplete="email"></label>
      <label class="field">${icon('lock', 18)}<input id="pw" type="password" placeholder="Password" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      ${reg ? `<label class="field">${icon('lock', 18)}<input id="pw2" type="password" placeholder="Conferma password"></label>` : ''}
      <div class="autherr" id="err"></div>
      <button class="btn primary wide" id="goauth">${reg ? 'Crea account' : 'Accedi'}</button>
      <button class="authlink" id="swap">${reg ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}</button>
      <button class="authlink dim" id="skip">Continua senza account</button>
    </div>`;
  const err = view.querySelector('#err');
  view.querySelector('#swap').onclick = () => authScreen(reg ? 'login' : 'register');
  view.querySelector('#skip').onclick = () => auth.guest();
  view.querySelector('#goauth').onclick = async () => {
    const em = view.querySelector('#em').value.trim(), pw = view.querySelector('#pw').value;
    if (reg && pw !== view.querySelector('#pw2').value) { err.textContent = 'Le password non coincidono'; return; }
    err.textContent = '';
    const btn = view.querySelector('#goauth'); btn.disabled = true; btn.textContent = 'Attendi…';
    try { await (reg ? auth.register(em, pw) : auth.login(em, pw)); }
    catch (e) { err.textContent = e.message; btn.disabled = false; btn.textContent = reg ? 'Crea account' : 'Accedi'; }
  };
}

/* ═══════════ HOME ═══════════ */
function home() {
  const box = activeBox();
  const owned = Object.values(state.owned);
  const uniques = owned.length;
  const copies = owned.reduce((n, e) => n + e.qty, 0);
  const favs = owned.filter(e => e.fav).length;
  const recent = owned.filter(e => e.t).sort((a, b) => b.t - a.t).slice(0, 6);

  view.innerHTML = `
    ${box && remaining(box) > 0 ? `
    <div class="card continue">
      <div class="ctitle">CONTINUA IL TUO BOX</div>
      <div class="cset">${box.setName} · 36 Booster Box</div>
      <div class="bar"><i style="width:${box.opened.length / box.total * 100}%"></i></div>
      <div class="cnum">${box.opened.length} / ${box.total} pacchetti aperti</div>
      <button class="btn primary" id="cont">Continua</button>
    </div>` : ''}
    <section class="hero">
      <div class="herotxt">
        <small>ESPANSIONE IN EVIDENZA</small>
        <h2 id="heroname">&nbsp;</h2>
        <button class="btn primary" id="heroopen" disabled>Apri booster</button>
      </div>
      <div class="heropack" id="heropack"><div class="spin"></div></div>
    </section>
    <div class="qagrid">
      <button class="qa" data-go="sets">${icon('layers', 22)}<b>Espansioni</b><small>Sfoglia i set</small></button>
      <button class="qa" data-go="collection">${icon('cards', 22)}<b>Collezione</b><small>${uniques} carte uniche</small></button>
      <button class="qa" data-go="favorites">${icon('heart', 22)}<b>Preferiti</b><small>${favs} carte</small></button>
      <button class="qa" data-go="recent">${icon('clock', 22)}<b>Ultime carte</b><small>${recent.length ? 'aperture recenti' : 'ancora nessuna'}</small></button>
    </div>
    <div class="statsrow">
      <div class="stat"><b>${uniques}</b><span>Uniche</span></div>
      <div class="stat"><b>${copies}</b><span>Totali</span></div>
      <div class="stat"><b>${state.stats.packs || 0}</b><span>Pacchetti</span></div>
    </div>
    ${recent.length ? `
    <h3 class="secttl">Ultime carte</h3>
    <div class="recentstrip">${recent.map(e =>
      `<img src="${e.card.images.small}" loading="lazy" alt="${e.card.name}" data-id="${e.card.id}">`).join('')}
    </div>` : ''}`;

  const c = view.querySelector('#cont');
  if (c) c.onclick = () => go(() => boxFlow(box), box.setName);
  view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const k = b.dataset.go;
    if (k === 'sets') go(setsScreen, 'Espansioni');
    else if (k === 'favorites') go(() => collectionScreen(true), 'Preferiti');
    else go(() => collectionScreen(false), 'Collezione');
  });
  view.querySelectorAll('.recentstrip img').forEach(im => im.onclick = () => {
    const e = state.owned[im.dataset.id]; if (e) fullscreen(e.card);
  });

  // hero asincrono: l'app resta usabile anche se l'API non risponde
  getSets().then(sets => {
    if (!sets?.length || !view.querySelector('#heropack')) return;
    const feat = sets[0];
    view.querySelector('#heroname').textContent = feat.name;
    view.querySelector('#heropack').innerHTML =
      `<div class="minibooster">${packSkinHTML(resolveProduct(feat))}</div>`;
    const b = view.querySelector('#heroopen');
    b.disabled = false;
    b.onclick = () => go(() => productsScreen(feat), feat.name);
  }).catch(() => {
    const hp = view.querySelector('#heropack');
    if (hp) hp.innerHTML = '<p class="hint">Set non disponibili</p>';
  });
}

/* ═══════════ ESPANSIONI ═══════════ */
async function setsScreen() {
  view.innerHTML = `
    <label class="field search">${icon('search', 18)}<input id="q" placeholder="Cerca espansione"></label>
    <div class="list" id="ls"><div class="spin"></div></div>`;
  let sets;
  try { sets = await getSets(); }
  catch {
    return view.querySelector('#ls').innerHTML =
      `<div class="err">Impossibile caricare le espansioni.<br><button class="btn" onclick="location.reload()">Riprova</button></div>`;
  }
  const ls = view.querySelector('#ls');
  const paint = q => {
    const f = sets.filter(s => s.name.toLowerCase().includes(q));
    ls.innerHTML = f.slice(0, 60).map(s => `
      <button class="setcard" data-id="${s.id}">
        <img src="${s.images.logo}" loading="lazy" alt="">
        <span><b>${s.name}</b><small>${s.printedTotal || s.total} carte · ${s.releaseDate || ''}</small></span>
        ${icon('chevright', 18)}
      </button>`).join('') || '<div class="hint">Nessun risultato</div>';
    ls.querySelectorAll('.setcard').forEach(r => r.onclick = () => {
      const set = sets.find(x => x.id === r.dataset.id);
      go(() => productsScreen(set), set.name);
    });
  };
  paint('');
  view.querySelector('#q').oninput = debounce(e => paint(e.target.value.toLowerCase()), 250);
}

/* ═══════════ PAGINA DEL SET ═══════════ */
function productsScreen(set) {
  const prod = resolveProduct(set);
  view.innerHTML = `
    <img class="setlogo" src="${set.images.logo}" alt="${set.name}">
    <div class="chip center">${set.printedTotal || set.total} carte disponibili</div>
    <div class="prodrow">
      <div class="prodcard">
        <div class="minibooster sm">${packSkinHTML(prod)}</div>
        <b>Booster Pack</b><small>10 carte</small>
        <button class="btn primary" id="bp">Apri booster</button>
      </div>
      <div class="prodcard">
        <div class="minibox" style="--sym:url('${prod.symbol}')">
          ${prod.boxImage ? `<img src="${prod.boxImage}" alt="">` : `<img class="mblogo" src="${prod.logo}" alt="">`}
        </div>
        <b>Booster Box</b><small>36 pack</small>
        <button class="btn" id="bb">Apri box</button>
      </div>
    </div>
    <button class="btn big" id="sg">${icon('search', 18)} Carta singola <small>sfoglia il set</small></button>`;
  view.querySelector('#bb').onclick = () => {
    const box = createBox(set);
    go(() => boxFlow(box, set), set.name);
  };
  view.querySelector('#bp').onclick = () => openSingle(set);
  view.querySelector('#sg').onclick = () => go(() => singlesScreen(set), set.name);
}

function openSingle(set) {
  const again = () => { stack.pop(); openSingle(set); };
  const done = () => { stack.pop(); const top = stack[stack.length - 1]; subtitle.textContent = top.sub; top.fn(); };
  go(() => packScreen(view, set, null, null, done, again), set.name);
}

function boxFlow(box, set = null) {
  const fake = set || { id: box.setId, name: box.setName, images: { logo: box.logo, symbol: box.symbol || '' } };
  const backToBox = () => { stack.pop(); go(() => boxFlow(box, set), box.setName); };
  boxScreen(view, box, i =>
    go(() => packScreen(view, fake, box, i, backToBox, backToBox), box.setName));
}

/* ═══════════ CARTE SINGOLE ═══════════ */
async function singlesScreen(set) {
  view.innerHTML = `
    <label class="field search">${icon('search', 18)}<input id="q" placeholder="Nome, numero, rarità"></label>
    <div class="grid" id="g"><div class="spin"></div></div>`;
  let cards;
  try { cards = await getSetCards(set.id); }
  catch { return view.querySelector('#g').innerHTML = '<div class="err">Impossibile caricare le carte.</div>'; }
  const g = view.querySelector('#g');
  const paint = q => {
    const f = cards.filter(c => (c.name + c.number + (c.rarity || '')).toLowerCase().includes(q));
    g.innerHTML = f.slice(0, 120).map((c, i) =>
      `<div class="gcard" data-i="${i}"><img src="${c.images.small}" loading="lazy" alt="${c.name}"></div>`).join('');
    g.querySelectorAll('.gcard').forEach(el => el.onclick = () => fullscreen(f[+el.dataset.i]));
  };
  paint('');
  view.querySelector('#q').oninput = debounce(e => paint(e.target.value.toLowerCase()), 250);
}

/* ═══════════ COLLEZIONE / PREFERITI ═══════════ */
function collectionScreen(favOnly) {
  const all = Object.values(state.owned).filter(e => !favOnly || e.fav);
  const copies = all.reduce((n, e) => n + e.qty, 0);
  view.innerHTML = `
    <div class="chip center">${all.length} carte uniche · ${copies} totali</div>
    <label class="field search">${icon('search', 18)}<input id="q" placeholder="Cerca ${favOnly ? 'nei preferiti' : 'nella collezione'}"></label>
    <div class="grid" id="g"></div>`;
  const g = view.querySelector('#g');
  const paint = q => {
    const f = all.filter(e => e.card.name.toLowerCase().includes(q));
    g.innerHTML = f.map((e, i) => `
      <div class="gcard" data-i="${i}">
        <img src="${e.card.images.small}" loading="lazy" alt="${e.card.name}">
        ${e.qty > 1 ? `<span class="qty">×${e.qty}</span>` : ''}
        ${e.fav ? `<span class="favmark">${iconFill('heart', 14)}</span>` : ''}
      </div>`).join('') || `<div class="hint">${favOnly ? 'Nessun preferito ancora.' : 'Apri un pacchetto per iniziare la collezione.'}</div>`;
    g.querySelectorAll('.gcard').forEach(el => el.onclick = () =>
      fullscreen(f[+el.dataset.i].card, () => collectionScreen(favOnly)));
  };
  paint('');
  view.querySelector('#q').oninput = debounce(e => paint(e.target.value.toLowerCase()), 250);
}

/* ═══════════ PROFILO ═══════════ */
function profileScreen() {
  const owned = Object.values(state.owned);
  const copies = owned.reduce((n, e) => n + e.qty, 0);
  const favs = owned.filter(e => e.fav).length;
  if (auth.authed()) {
    view.innerHTML = `
      <div class="profilehead">
        <span class="avatar">${icon('user', 30)}</span>
        <b>${auth.user()}</b>
        <small>Sincronizzazione attiva</small>
      </div>
      <div class="statsrow">
        <div class="stat"><b>${copies}</b><span>Carte possedute</span></div>
        <div class="stat"><b>${favs}</b><span>Preferiti</span></div>
        <div class="stat"><b>${state.stats.packs || 0}</b><span>Pacchetti</span></div>
      </div>
      <h3 class="secttl">${icon('settings', 16)} Impostazioni</h3>
      <div class="card setting">
        <small>Indirizzo del server (per l'app Android lascia qui l'URL del backend remoto)</small>
        <label class="field"><input id="apibase" placeholder="https://tuo-server.com" value="${auth.getApiBase()}"></label>
        <button class="btn" id="saveapi">Salva</button>
      </div>
      <button class="btn big danger" id="lo">${icon('logout', 18)} Logout</button>`;
    view.querySelector('#saveapi').onclick = () => { auth.setApiBase(view.querySelector('#apibase').value); location.reload(); };
    view.querySelector('#lo').onclick = () => auth.logout();
  } else {
    view.innerHTML = `
      <div class="profilehead">
        <span class="avatar">${icon('user', 30)}</span>
        <b>Ospite</b>
        <small>I dati sono salvati solo su questo dispositivo</small>
      </div>
      <div class="statsrow">
        <div class="stat"><b>${copies}</b><span>Carte possedute</span></div>
        <div class="stat"><b>${favs}</b><span>Preferiti</span></div>
        <div class="stat"><b>${state.stats.packs || 0}</b><span>Pacchetti</span></div>
      </div>
      <p class="hint">Crea un account per sincronizzare collezione e preferiti su tutti i tuoi dispositivi.</p>
      <button class="btn primary wide" id="reg">Crea account</button>
      <button class="btn wide" id="log">Accedi</button>`;
    view.querySelector('#reg').onclick = () => { localStorage.removeItem('pkd_guest'); authScreen('register'); };
    view.querySelector('#log').onclick = () => { localStorage.removeItem('pkd_guest'); authScreen('login'); };
  }
}

/* ═══════════ FULLSCREEN + PINCH ZOOM ═══════════ */
function fullscreen(card, onClose) {
  const owned = state.owned[card.id];
  modal.hidden = false;
  modal.innerHTML = `
    <div class="fs">
      <button class="icon fsx">${icon('x', 18)}</button>
      <div class="fswrap"><img id="fsi" src="${card.images.large || card.images.small}" alt="${card.name}"></div>
      <div class="fsinfo">
        <b>${card.name}</b>
        <span>${card.number}/${card.set?.total || ''} · ${card.rarity || ''} · ${card.set?.name || ''}</span>
        <button class="btn" id="fav">${owned?.fav ? iconFill('heart', 16) : icon('heart', 16)} ${owned?.fav ? 'Preferito' : 'Aggiungi ai preferiti'}</button>
      </div>
    </div>`;
  modal.querySelector('.fsx').onclick = close;
  const favB = modal.querySelector('#fav');
  favB.onclick = () => {
    if (!owned) return;
    const f = toggleFav(card.id);
    favB.innerHTML = `${f ? iconFill('heart', 16) : icon('heart', 16)} ${f ? 'Preferito' : 'Aggiungi ai preferiti'}`;
  };
  function close() { modal.hidden = true; modal.innerHTML = ''; if (onClose) onClose(); }

  const img = modal.querySelector('#fsi');
  let scale = 1, tx = 0, ty = 0, pts = new Map(), startDist = 0, startScale = 1, lastTap = 0;
  img.style.touchAction = 'none';
  const apply = () => img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
  img.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, e); img.setPointerCapture(e.pointerId);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      startDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); startScale = scale;
    }
    const now = Date.now();
    if (now - lastTap < 300 && pts.size === 1) {
      scale = scale > 1 ? 1 : 2.2; tx = ty = 0;
      img.style.transition = 'transform .2s'; apply(); setTimeout(() => img.style.transition = '', 220);
    }
    lastTap = now;
  });
  img.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, e);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      scale = clampN(startScale * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / startDist, 1, 4);
    } else if (scale > 1) { tx += e.clientX - prev.clientX; ty += e.clientY - prev.clientY; }
    apply();
  });
  const lift = e => { pts.delete(e.pointerId); if (scale <= 1.02) { scale = 1; tx = ty = 0; apply(); } };
  img.addEventListener('pointerup', lift); img.addEventListener('pointercancel', lift);
}

/* ═══════════ DEBUG (console) ═══════════ */
window.PKD = {
  reset() { localStorage.clear(); location.reload(); },
  forceTier(t) { window.__pkdForceTier = t; },
  completeBox() { const b = activeBox(); if (b) { b.opened = [...Array(b.total).keys()]; save(); } },
  state
};

/* ═══════════ BOOT ═══════════ */
if (!auth.authed() && !auth.isGuest()) authScreen('login');
else { document.body.classList.remove('lock'); go(home); }
