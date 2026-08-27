import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import 'dotenv/config';

const app = express();
app.use(express.json({ limit: '2mb' }));

/* CORS: necessario quando il frontend (es. APK Capacitor) parla con un backend remoto */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  next();
});

/* ─── Proxy Pokémon TCG API (la chiave resta SOLO qui) ─── */
const API = 'https://api.pokemontcg.io/v2';
const KEY = process.env.POKEMON_TCG_API_KEY || '';
const cache = new Map();
const TTL = 12 * 60 * 60 * 1000;

async function proxy(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const r = await fetch(API + path, { headers: KEY ? { 'X-Api-Key': KEY } : {} });
  if (!r.ok) throw new Error('API ' + r.status);
  const data = await r.json();
  cache.set(path, { t: Date.now(), data });
  return data;
}

app.get('/api/sets', async (_req, res) => {
  try { res.json(await proxy('/sets?orderBy=-releaseDate&pageSize=250')); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/cards/:setId', async (req, res) => {
  const page = Number(req.query.page) || 1;
  try { res.json(await proxy(`/cards?q=set.id:${req.params.setId}&pageSize=250&page=${page}&orderBy=number`)); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

/* ─── Account + sincronizzazione ───
   Storage su file JSON (nessuna dipendenza extra); struttura già pronta
   per migrare a un database vero mantenendo le stesse route. */
const DB_FILE = new URL('./data.json', import.meta.url).pathname;
let db = { users: {}, sessions: {}, data: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch {}
let dbTimer = null;
function persist() {
  clearTimeout(dbTimer);
  dbTimer = setTimeout(() => fs.writeFile(DB_FILE, JSON.stringify(db), () => {}), 300);
}

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const email = db.sessions[token];
  if (!email || !db.users[email]) return res.status(401).json({ error: 'Sessione scaduta, accedi di nuovo' });
  req.email = email; req.token = token;
  next();
}

app.post('/api/register', (req, res) => {
  const { email, password } = req.body || {};
  const key = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(key)) return res.status(400).json({ error: 'Email non valida' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password troppo corta (minimo 6 caratteri)' });
  if (db.users[key]) return res.status(409).json({ error: 'Esiste già un account con questa email' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.users[key] = { email: key, salt, hash: hashPw(password, salt), createdAt: Date.now() };
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = key;
  persist();
  res.json({ token, email: key });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const key = String(email || '').trim().toLowerCase();
  const u = db.users[key];
  if (!u || !password) return res.status(401).json({ error: 'Email o password errati' });
  const a = Buffer.from(u.hash, 'hex'), b = Buffer.from(hashPw(password, u.salt), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return res.status(401).json({ error: 'Email o password errati' });
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = key;
  persist();
  res.json({ token, email: key });
});

app.post('/api/logout', requireAuth, (req, res) => {
  delete db.sessions[req.token]; persist();
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ email: req.email }));

/* Collezione + preferiti dell'utente: pull al login, push automatico a ogni modifica */
app.get('/api/sync', requireAuth, (req, res) => res.json(db.data[req.email] || null));

app.put('/api/sync', requireAuth, (req, res) => {
  const s = req.body;
  if (!s || typeof s !== 'object') return res.status(400).json({ error: 'Dati non validi' });
  db.data[req.email] = { owned: s.owned || {}, boxes: s.boxes || {}, activeBoxId: s.activeBoxId || null, stats: s.stats || {}, updatedAt: Date.now() };
  persist();
  res.json({ ok: true });
});

app.use(express.static('public'));
app.listen(process.env.PORT || 3000, () => console.log('Pokémon Dopamine → http://localhost:3000'));
