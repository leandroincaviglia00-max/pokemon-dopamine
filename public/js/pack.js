import { state, save, addCard } from './storage.js';
import { getSetCards } from './api.js';
import { generatePack } from './packGenerator.js';
import { openPackAt, remaining } from './boxManager.js';
import { resolveProduct, packSkinHTML } from './productAssets.js';
import { tier, TIER_RANK } from './rarity.js';
import { icon } from './icons.js';
import { sfx } from './audio.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const vib = p => navigator.vibrate && navigator.vibrate(p);

/* ═══════════════ SCHERMATA BOX ═══════════════ */
export function boxScreen(view, box, goPack) {
  if (!box.lidOpen) return closedBox(view, box, () => boxScreen(view, box, goPack));

  const rem = remaining(box);
  view.innerHTML = `
    <div class="boxhead">
      <div class="chip">${box.opened.length} / ${box.total} aperti · ${rem} rimasti</div>
      <div class="bar"><i style="width:${box.opened.length / box.total * 100}%"></i></div>
    </div>
    <p class="hint">Trascina un booster verso l'alto per estrarlo</p>
    <div class="boxinterior">
      <div class="packgrid" id="pg"></div>
    </div>`;
  const pg = view.querySelector('#pg');

  for (let i = 0; i < box.total; i++) {
    const done = box.opened.includes(i);
    const p = document.createElement('div');
    p.className = 'minipack' + (done ? ' done' : '');
    p.innerHTML = done ? icon('check', 16)
      : `<span class="mpskin" style="--sym:url('${box.symbol || ''}')"><img src="${box.logo}" alt="" loading="lazy"></span>`;
    pg.appendChild(p);
    if (done) continue;

    let sy = 0, dy = 0, drag = false;
    p.style.touchAction = 'none';
    p.addEventListener('pointerdown', e => { drag = true; sy = e.clientY; p.setPointerCapture(e.pointerId); p.classList.add('lift'); });
    p.addEventListener('pointermove', e => {
      if (!drag) return;
      dy = clamp(e.clientY - sy, -160, 0);
      p.style.transform = `translateY(${dy}px) scale(${1 - dy / 700})`;
    });
    const end = () => {
      if (!drag) return; drag = false; p.classList.remove('lift');
      if (dy < -90) {
        vib(15); sfx('open');
        p.classList.add('pull');
        setTimeout(() => goPack(i), 260);
      } else {
        p.style.transition = 'transform .28s cubic-bezier(.2,.8,.3,1.1)';
        p.style.transform = '';
        setTimeout(() => p.style.transition = '', 290);
      }
      dy = 0;
    };
    p.addEventListener('pointerup', end);
    p.addEventListener('pointercancel', end);
  }
}

function closedBox(view, box, done) {
  const prod = resolveProduct({ id: box.setId, images: { logo: box.logo, symbol: box.symbol } });
  view.innerHTML = `
    <div class="stage">
      <div class="boxscene">
        <div class="box3d" id="b3d" style="--sym:url('${prod.symbol}')">
          <div class="bface lid" id="flap"><span class="lidtape"></span></div>
          <div class="bface front">
            ${prod.boxImage ? `<img class="boxreal" src="${prod.boxImage}" alt="">`
                            : `<img class="boxlogo" src="${prod.logo}" alt="${box.setName}">`}
            <span class="boxcount">36 BOOSTER</span>
          </div>
          <div class="bface side"></div>
        </div>
        <div class="floorlight"></div>
      </div>
    </div>
    <div class="gesturehint"><span class="fingericon">${icon('drag', 18)}</span> Trascina il sigillo per aprire il box</div>`;

  const flap = view.querySelector('#flap'), b3d = view.querySelector('#b3d');
  let sx = 0, prog = 0, drag = false, last = 0;
  flap.style.touchAction = 'none';

  flap.addEventListener('pointerdown', e => { drag = true; sx = e.clientX; flap.setPointerCapture(e.pointerId); b3d.classList.add('handling'); });
  flap.addEventListener('pointermove', e => {
    if (!drag) return;
    prog = clamp((e.clientX - sx) / (b3d.offsetWidth * 0.8), 0, 1);
    flap.style.transform = `rotateX(${-105 * prog}deg)`;
    if (prog - last > 0.12) { vib(5); sfx('tear'); last = prog; }
  });
  const end = () => {
    if (!drag) return; drag = false; b3d.classList.remove('handling');
    if (prog > 0.75) {
      sfx('open'); vib([20, 40, 20]);
      flap.style.transition = 'transform .4s cubic-bezier(.3,.7,.3,1)';
      flap.style.transform = 'rotateX(-168deg)';
      b3d.classList.add('boxopen');
      setTimeout(() => { box.lidOpen = true; save(); done(); }, 560);
    } else {
      flap.style.transition = 'transform .35s cubic-bezier(.2,.8,.3,1.1)';
      flap.style.transform = '';
      setTimeout(() => flap.style.transition = '', 360);
      prog = 0; last = 0;
    }
  };
  flap.addEventListener('pointerup', end);
  flap.addEventListener('pointercancel', end);
}

/* ═══════════════ APERTURA PACCHETTO ═══════════════ */
export async function packScreen(view, set, box, packIndex, onDone, onAgain) {
  const prod = resolveProduct(set);
  const num = box ? `Pacchetto ${box.opened.length + 1} / ${box.total}` : 'Booster Pack';
  view.innerHTML = `
    <div class="stepper">
      <span class="on">Pacchetto</span><span>Apri</span><span>Carte</span><span>Riepilogo</span>
    </div>
    <div class="chip center">${num}</div>
    <div class="stage" id="stage">
      <div class="boosterwrap">
        <div class="booster" id="pak">
          <div class="crimp top"></div>
          ${packSkinHTML(prod)}
          <div class="sheen"></div>
          <div class="crimp bottom"></div>
          <div class="tearflap" id="strip"></div>
          <div class="seam" id="seam"></div>
        </div>
        <div class="floorlight"></div>
      </div>
    </div>
    <div class="gesturehint"><span class="fingericon">${icon('drag', 18)}</span> Trascina il dito lungo la cucitura<br><small>per aprire il pacchetto</small></div>
    <div class="backstrip">${'<div class="cardback mini"></div>'.repeat(10)}</div>
    <div class="totchip">10 CARTE TOTALI</div>`;

  const steps = view.querySelectorAll('.stepper span');
  const setStep = i => steps.forEach((s, j) => s.classList.toggle('on', j <= i));

  // dati reali caricati in parallelo alla gesture: la UI non resta mai bloccata
  let cards = null, loadErr = null;
  getSetCards(set.id).then(all => cards = generatePack(all, 10, window.__pkdForceTier || null))
    .catch(e => loadErr = e);

  const pak = view.querySelector('#pak'), strip = view.querySelector('#strip'), seam = view.querySelector('#seam');
  let sx = 0, prog = 0, drag = false, lastTick = 0;
  pak.style.touchAction = 'none';

  pak.addEventListener('pointerdown', e => {
    const r = pak.getBoundingClientRect();
    if (e.clientY > r.top + r.height * 0.28) return;
    drag = true; sx = e.clientX; pak.setPointerCapture(e.pointerId);
    pak.classList.add('gripped');
    setStep(1);
  });
  pak.addEventListener('pointermove', e => {
    if (!drag) return;
    prog = clamp((e.clientX - sx) / (pak.offsetWidth * 0.85), 0, 1);
    strip.style.transform = `translateX(${prog * 74}%) rotate(${prog * 26}deg) translateY(${-prog * 34}px)`;
    strip.style.opacity = 1;
    seam.style.setProperty('--tear', prog);
    pak.style.transform = `skewX(${-prog * 3}deg) rotate(${prog * 1.6}deg) scaleY(${1 + prog * 0.015})`;
    if (prog - lastTick > 0.1) { vib(6); sfx('tear'); lastTick = prog; }
  });
  const release = async () => {
    if (!drag) return; drag = false; pak.classList.remove('gripped');
    if (prog >= 0.9) {
      vib([15, 30, 15]); sfx('open');
      strip.style.transition = 'all .45s ease-out';
      strip.style.transform += ' translateY(-140px) rotate(40deg)'; strip.style.opacity = 0;
      pak.classList.add('opened');
      if (box && packIndex != null) openPackAt(box, packIndex);
      state.stats.packs = (state.stats.packs || 0) + 1; save();
      const t0 = Date.now();
      while (!cards && !loadErr && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 100));
      if (!cards) return errorRetry(view, () => packScreen(view, set, box, packIndex, onDone, onAgain));
      setTimeout(() => revealStack(view, cards, setStep, onDone, onAgain), 620);
    } else {
      strip.style.transition = 'all .38s cubic-bezier(.2,.8,.3,1.05)';
      strip.style.transform = ''; strip.style.opacity = 0.9;
      seam.style.transition = '--tear .38s'; seam.style.setProperty('--tear', 0);
      pak.style.transition = 'transform .34s cubic-bezier(.2,.8,.3,1.05)'; pak.style.transform = '';
      setTimeout(() => { strip.style.transition = seam.style.transition = pak.style.transition = ''; }, 400);
      prog = 0; lastTick = 0;
    }
  };
  pak.addEventListener('pointerup', release);
  pak.addEventListener('pointercancel', release);
}

function errorRetry(view, retry) {
  view.innerHTML = `<div class="err">Impossibile caricare le carte.<br><button class="btn" id="rt">Riprova</button></div>`;
  view.querySelector('#rt').onclick = retry;
}

/* ═══════════════ REVEAL DELLE CARTE — con contatore X/Y del pacchetto ═══════════════ */
function revealStack(view, cards, setStep, onDone, onAgain) {
  setStep(2);
  const total = cards.length;                 // dinamico: 8, 10, 12... mai hardcodato
  const stage = view.querySelector('#stage');
  stage.innerHTML = `<div class="stack risein" id="stack"></div>`;
  view.querySelector('.gesturehint').innerHTML =
    `<span class="fingericon up">${icon('dragup', 18)}</span> Trascina la carta verso l'alto`;

  // contatore di avanzamento del SINGOLO pacchetto: "Carta X / Y" + progress bar.
  // Si aggiorna SOLO quando lo swipe è completato, mai durante il drag.
  const prog = document.createElement('div');
  prog.className = 'packprog';
  view.querySelector('.chip.center').after(prog);
  const paintProg = () => {
    const cur = Math.min(idx + 1, total);
    prog.innerHTML = `<span>Carta ${cur} / ${total}</span><div class="pbar"><i style="width:${cur / total * 100}%"></i></div>`;
  };

  const stack = view.querySelector('#stack');
  const pulled = [];

  cards.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'cardEl';
    el.style.zIndex = cards.length - i;
    el.innerHTML = `
      <div class="cardinner">
        <div class="cardface cardbackface"><div class="pokeball"></div></div>
        <div class="cardface cardfront"><img src="${c.images.large || c.images.small}" loading="lazy"
             onerror="this.parentNode.classList.add('noimg');this.remove()" alt="${c.name}"></div>
      </div>`;
    stack.appendChild(el);
  });

  let idx = 0;
  paintProg();
  arm();

  function arm() {
    if (idx >= total) return summary();
    // la carta attiva è SEMPRE il primo elemento rimasto nello stack:
    // niente indici su liste che slittano dopo ogni remove()
    const el = stack.querySelector('.cardEl');
    if (!el) return summary();
    el.classList.add('active');
    const under = el.nextElementSibling;
    const card = cards[idx], t = tier(card.rarity);
    const H = el.offsetHeight || 420;
    let sy = 0, sxx = 0, dy = 0, dx = 0, drag = false, lastY = 0, lastT = 0, vel = 0;
    el.style.touchAction = 'none';

    const down = e => {
      drag = true; sy = lastY = e.clientY; sxx = e.clientX;
      lastT = performance.now(); vel = 0;
      el.setPointerCapture(e.pointerId); el.style.transition = '';
    };
    const move = e => {
      if (!drag) return;
      const now = performance.now();
      vel = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
      dy = Math.min(0, e.clientY - sy); dx = e.clientX - sxx;
      const p = clamp(-dy / (H * 0.9), 0, 1);
      const res = dy * (1 - p * 0.25);
      el.style.transform = `translateY(${res}px) translateX(${dx * 0.22}px) rotate(${dx * 0.03}deg)`;
      el.style.boxShadow = `0 ${10 + p * 30}px ${24 + p * 44}px rgba(0,0,0,.6)`;
      if (under) {
        under.style.transform = `scale(${0.94 + 0.06 * p}) translateY(${12 * (1 - p)}px)`;
        under.style.filter = `brightness(${0.55 + 0.45 * p})`;
      }
    };
    const up = () => {
      if (!drag) return; drag = false;
      const p = clamp(-dy / (H * 0.9), 0, 1);
      if (p >= 0.55 || (vel < -0.9 && p > 0.12)) commit();
      else {
        el.style.transition = 'transform .32s cubic-bezier(.2,.9,.3,1.15), box-shadow .32s';
        el.style.transform = ''; el.style.boxShadow = '';
        if (under) { under.style.transition = 'all .32s'; under.style.transform = ''; under.style.filter = ''; }
        setTimeout(() => { el.style.transition = ''; if (under) under.style.transition = ''; }, 340);
      }
      dy = dx = 0;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    function commit() {
      el.style.transition = 'transform .32s ease-in, opacity .32s';
      el.style.transform = `translateY(-${H * 1.35}px) rotate(${dx * 0.05}deg)`;
      el.style.opacity = '0';
      sfx('flip');
      addCard(card); pulled.push(card);
      const rank = TIER_RANK[t];
      if (under) { under.style.transition = 'all .3s'; under.style.transform = ''; under.style.filter = ''; }
      setTimeout(() => {
        el.remove();
        if (rank >= 3) flashReveal(card, t);
        if (rank >= 4) { vib([30, 60, 30, 60, 80]); sfx('rare'); }
        else if (rank >= 2) vib(20);
        idx++;                                   // lo swipe è completato: ora
        paintProg();                             // il contatore avanza
        arm();
      }, rank >= 3 ? 180 : 320);
    }
  }

  function flashReveal(card, t) {
    const m = document.getElementById('modal');
    m.hidden = false;
    m.innerHTML = `<div class="reveal tier-${t}">
      <img src="${card.images.large || card.images.small}" alt="${card.name}">
      <div class="shine"></div>
      <div class="revealname">${card.name}<span>${card.rarity || ''}</span></div></div>`;
    const dur = t === 'secret' ? 2600 : t === 'ultra' ? 2000 : 1300;
    m.onclick = close; setTimeout(close, dur);
    function close() { m.hidden = true; m.innerHTML = ''; m.onclick = null; }
  }

  function summary() {
    setStep(3); sfx('add');
    prog.remove();
    const best = [...pulled].sort((a, b) => TIER_RANK[tier(b.rarity)] - TIER_RANK[tier(a.rarity)])[0];
    stage.innerHTML = `
      <div class="summary">
        <h2>Pacchetto completato</h2>
        <div class="chip center">${total} / ${total} carte</div>
        <div class="sumgrid">${pulled.map(c =>
          `<div class="sumcard ${c === best ? 'best' : ''}">
             <img src="${c.images.small}" loading="lazy" alt="${c.name}"></div>`).join('')}
        </div>
        <p class="hint">Carte aggiunte automaticamente alla collezione</p>
        <div class="sumbtns">
          <button class="btn" id="sumback">Torna al set</button>
          <button class="btn primary" id="sumagain">Apri un altro pacchetto</button>
        </div>
      </div>`;
    view.querySelector('.gesturehint').innerHTML = '';
    view.querySelector('.backstrip').innerHTML = '';
    view.querySelector('.totchip').innerHTML = '';
    stage.querySelector('#sumback').onclick = onDone;
    stage.querySelector('#sumagain').onclick = onAgain || onDone;
  }
}
