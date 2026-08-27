const mem = new Map();
async function get(url) {
  if (mem.has(url)) return mem.get(url);
  const ses = sessionStorage.getItem('pkd:' + url);
  if (ses) { const d = JSON.parse(ses); mem.set(url, d); return d; }
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  mem.set(url, d);
  try { sessionStorage.setItem('pkd:' + url, JSON.stringify(d)); } catch {}
  return d;
}
export const getSets = () => get('/api/sets').then(d => d.data);
export async function getSetCards(setId) {
  let page = 1, all = [];
  for (;;) {
    const d = await get(`/api/cards/${setId}?page=${page}`);
    all = all.concat(d.data);
    if (!d.data.length || all.length >= d.totalCount) break;
    page++;
  }
  return all;
}
