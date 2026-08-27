/* ─── AUTH + SYNC — account email/password e sincronizzazione collezione ───
   Il backend è configurabile (localStorage 'pkd_api_base'): in locale resta '',
   nell'APK Capacitor si imposta l'URL del server remoto dal Profilo. */
import { state } from './storage.js';

const base = () => localStorage.getItem('pkd_api_base') || '';
const token = () => localStorage.getItem('pkd_token');
export const user = () => localStorage.getItem('pkd_user');
export const authed = () => !!token() && !!user();
export const isGuest = () => !authed() && localStorage.getItem('pkd_guest') === '1';

async function call(path, opts = {}) {
  const r = await fetch(base() + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: 'Bearer ' + token() } : {}),
      ...(opts.headers || {})
    }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Errore di rete (' + r.status + ')');
  return d;
}

function begin(d) {
  localStorage.setItem('pkd_token', d.token);
  localStorage.setItem('pkd_user', d.email);
  localStorage.removeItem('pkd_guest');
}

export async function register(email, password) {
  begin(await call('/api/register', { method: 'POST', body: JSON.stringify({ email, password }) }));
  location.reload();               // profilo nuovo: parte con dati vuoti
}

export async function login(email, password) {
  begin(await call('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
  // pull della collezione/preferiti dal server nel profilo locale di questo utente
  try {
    const d = await call('/api/sync');
    if (d && d.owned) localStorage.setItem('pkd_v1:' + user(), JSON.stringify(d));
  } catch {}
  location.reload();
}

export async function logout() {
  try { await call('/api/logout', { method: 'POST' }); } catch {}
  localStorage.removeItem('pkd_token');
  localStorage.removeItem('pkd_user');
  location.reload();
}

export function guest() {
  localStorage.setItem('pkd_guest', '1');
  location.reload();
}

export function setApiBase(url) {
  const v = String(url || '').trim().replace(/\/+$/, '');
  if (v) localStorage.setItem('pkd_api_base', v);
  else localStorage.removeItem('pkd_api_base');
}
export const getApiBase = () => localStorage.getItem('pkd_api_base') || '';

/* Push automatico (debounced) dello stato al server dopo ogni modifica.
   In caso di errore di rete ritenta più tardi: la UI non si blocca mai. */
let t = null;
export function scheduleSync() {
  if (!authed()) return;
  clearTimeout(t);
  t = setTimeout(async () => {
    try { await call('/api/sync', { method: 'PUT', body: JSON.stringify(state) }); }
    catch { t = setTimeout(scheduleSync, 10000); }
  }, 1200);
}
