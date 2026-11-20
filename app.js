'use strict';
/* Домашнее меню — всё хранится на устройстве (localStorage), меню передаётся в самой ссылке. */

// ——— утилиты ———
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = (id) => DB.products[id];
const RID = {}; DB.recipes.forEach((r) => (RID[r.id] = r));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const COURSE_ORDER = ['salad', 'soup', 'main', 'dessert', 'drink'];
const COUNT = { salad: 2, soup: 2, main: 3, dessert: 2, drink: 3 };
const QN = { 3: 'Много', 2: 'Немного', 1: 'На донышке' };
const FLAG_N = { meat: 'Мясо', pork: 'Свинина', poultry: 'Птица', fish: 'Рыба', seafood: 'Морепродукты', alcohol: 'Алкоголь' };
const TPL = {
  romantic: { n: 'Романтический ужин', e: '🕯️' },
  family:   { n: 'Семейный',           e: '🏡' },
  minimal:  { n: 'Минимализм',         e: '◻️' },
  bistro:   { n: 'Итальянское бистро', e: '🍝' },
  festive:  { n: 'Праздник',           e: '🎉' },
};
const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const fmtTime = (d) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c); };

// ——— хранилище ———
const KEY = 'domashnee-menu-v1';
function defaultState() {
  const pantry = {};
  DB.defaultStaples.forEach((id) => (pantry[id] = { q: 3 }));
  return {
    pantry, leftovers: [], people: [], menus: [], shop: [], favs: [],
    settings: { host: '', equip: { stove: true, oven: true, blender: true, microwave: true, airfryer: false, multicooker: false } },
  };
}
let S = null;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S || typeof S !== 'object') S = defaultState();
{ const d = defaultState(); for (const k in d) if (S[k] === undefined) S[k] = d[k]; S.settings.equip = Object.assign(d.settings.equip, S.settings.equip || {}); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не удалось сохранить на устройстве'); } }

// ——— упаковка в ссылку ———
const b64u = {
  enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; },
};
async function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) {
    try {
      const st = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return 'z' + b64u.enc(new Uint8Array(await new Response(st).arrayBuffer()));
    } catch (e) { /* без сжатия */ }
  }
  return 'j' + b64u.enc(bytes);
}
async function unpack(s) {
  let bytes = b64u.dec(s.slice(1));
  if (s[0] === 'z') {
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(st).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
const baseUrl = () => location.href.split('#')[0].split('?')[0];

// ——— ограничения ———
function restrOf(ids) {
  const r = { al: new Set(), flags: new Set(), dis: new Set(), spice: 3, names: [] };
  S.people.filter((p) => ids.has(p.id)).forEach((p) => {
    r.names.push(p.name);
    (p.al || []).forEach((a) => r.al.add(a));
    (p.pr || []).forEach((pr) => { const d = DB.principles[pr]; if (!d) return; (d.banFlags || []).forEach((f) => r.flags.add(f)); (d.banAllergens || []).forEach((a) => r.al.add(a)); });
    (p.dis || []).forEach((d) => r.dis.add(d));
    r.spice = Math.min(r.spice, p.spice ?? 3);
  });
  return r;
}
function banned(pid, r) { const p = P(pid); if (!p) return true; return p.al.some((a) => r.al.has(a)) || p.fl.some((f) => r.flags.has(f)); }
function loBanned(lo, r) { return (lo.al || []).some((a) => r.al.has(a)) || (lo.fl || []).some((f) => r.flags.has(f)); }
function equipOk(r) {
  const e = S.settings.equip;
  return r.eq.every((x) => (x === 'oven' ? e.oven || e.airfryer : x === 'stove' ? e.stove || e.multicooker : !!e[x]));
}
function alOf(pids) { const s = new Set(); pids.forEach((id) => P(id) && P(id).al.forEach((a) => s.add(a))); return [...s]; }
function flOf(pids) { const s = new Set(); pids.forEach((id) => P(id) && P(id).fl.forEach((f) => s.add(f))); return [...s]; }

// ——— генератор ———
const G = {
  meal: (() => { const h = new Date().getHours(); return h < 11 ? 'b' : h < 16 ? 'l' : 'd'; })(),
  time: 45, courses: new Set(['salad', 'main', 'dessert', 'drink']), eaters: null, buy: 1,
  mark: {}, // pid -> 'must' | 'skip'
  useLo: true, cuisines: new Set(), result: null, ranked: null, seen: {},
  title: '', tpl: 'romantic', mode: 'each', deadline: '', note: '', showProducts: false,
};
function gEaters() { if (!G.eaters) G.eaters = new Set(S.people.map((p) => p.id)); return G.eaters; }

function buildCtx() {
  const have = new Set(), soon = new Set(), must = new Set();
  for (const [id, v] of Object.entries(S.pantry)) {
    if (!P(id) || G.mark[id] === 'skip') continue;
    have.add(id);
    if (v.soon) soon.add(id);
    if (G.mark[id] === 'must') must.add(id);
  }
  return { have, soon, must, r: restrOf(gEaters()), time: G.time, buy: G.buy };
}
function evalRecipe(rec, ctx) {
  if (!equipOk(rec)) return null;
  if (rec.course !== 'drink' && rec.time > ctx.time) return null;
  const spiceOver = Math.max(0, rec.spice - ctx.r.spice);
  if (spiceOver >= 2) return null;
  const used = [], miss = [], dis = [], amt = {};
  const prio = (id) => (ctx.must.has(id) ? 0 : ctx.soon.has(id) ? 1 : ctx.r.dis.has(id) ? 3 : 2);
  for (const slot of rec.req) {
    const valid = slot.ids.filter((id) => P(id) && !banned(id, ctx.r));
    if (!valid.length) return null; // запрещено ограничениями
    const have = valid.filter((id) => ctx.have.has(id)).sort((a, b) => prio(a) - prio(b));
    if (have.length) { used.push(have[0]); amt[have[0]] = slot.amt; if (ctx.r.dis.has(have[0])) dis.push(have[0]); }
    else { miss.push(valid[0]); amt[valid[0]] = slot.amt; }
  }
  if (miss.length > ctx.buy) return null;
  const opt = [];
  for (const slot of rec.opt) {
    const have = slot.ids.filter((id) => P(id) && ctx.have.has(id) && !banned(id, ctx.r) && !ctx.r.dis.has(id)).sort((a, b) => prio(a) - prio(b));
    if (have.length && !used.includes(have[0])) { opt.push(have[0]); amt[have[0]] = slot.amt; }
  }
  const all = used.concat(opt);
  const soonUsed = all.filter((id) => ctx.soon.has(id));
  const mustUsed = all.filter((id) => ctx.must.has(id));
  let score = used.length * 1.5 + opt.length * 0.7 + soonUsed.length * 5 + mustUsed.length * 20 - miss.length * 7 - dis.length * 5 - spiceOver * 4;
  if (S.favs.includes(rec.id)) score += 3;
  if (G.cuisines.size && G.cuisines.has(rec.cu)) score += 2;
  score += Math.random() * 3.5;
  return { c: rec.course, rid: rec.id, tier: rec.tier, used, opt, miss, dis, soon: soonUsed, must: mustUsed, amt, score, al: alOf(all), fl: flOf(all) };
}
function pickTop(c, list) {
  const n = COUNT[c], out = [], ids = new Set();
  const take = (x) => { if (x && !ids.has(x.rid)) { out.push(x); ids.add(x.rid); } };
  if (c === 'main') {
    [1, 2, 3].forEach((t) => take(list.find((x) => x.tier === t && !ids.has(x.rid))));
  } else if (c === 'drink') {
    const alc = (x) => x.fl.includes('alcohol');
    list.filter((x) => !alc(x)).slice(0, 2).forEach(take);
    if (G.meal !== 'b') take(list.find((x) => alc(x)));
  } else {
    const cus = new Set();
    list.forEach((x) => { if (out.length < n && !cus.has(RID[x.rid].cu)) { take(x); cus.add(RID[x.rid].cu); } });
  }
  for (const x of list) { if (out.length >= n) break; take(x); }
  return out.slice(0, n);
}
function genRun() {
  const ctx = buildCtx();
  G.ranked = {}; G.result = {}; G.seen = {};
  for (const c of COURSE_ORDER) {
    if (!G.courses.has(c)) continue;
    const list = DB.recipes
      .filter((r) => r.course === c && r.meals.includes(G.meal) && (c === 'drink' || !G.cuisines.size || G.cuisines.has(r.cu)))
      .map((r) => evalRecipe(r, ctx)).filter(Boolean).sort((a, b) => b.score - a.score);
    G.ranked[c] = list;
    G.result[c] = pickTop(c, list);
    G.seen[c] = new Set(G.result[c].map((x) => x.rid));
  }
  if (G.useLo) {
    S.leftovers.filter((lo) => lo.portions > 0 && !loBanned(lo, ctx.r)).forEach((lo) => {
      const c = G.courses.has(lo.c) ? lo.c : 'main';
      (G.result[c] = G.result[c] || []).unshift({ c, lo: true, loId: lo.id, n: lo.name, al: lo.al || [], fl: lo.fl || [], por: lo.portions });
    });
  }
  if (!G.title) G.title = defaultTitle();
}
function defaultTitle() {
  const m = { b: 'Завтрак', l: 'Обед', d: 'Ужин' }[G.meal];
  return { romantic: m + ' для двоих', family: 'Семейный ' + m.toLowerCase(), minimal: m, bistro: m + ' в бистро', festive: 'Праздничный ' + m.toLowerCase() }[G.tpl] || m;
}
function genReplace(c, i) {
  const cur = G.result[c][i]; if (!cur || cur.lo) return;
  const shown = new Set(G.result[c].map((x) => x.rid));
  let cand = G.ranked[c].filter((x) => !shown.has(x.rid) && !G.seen[c].has(x.rid));
  if (!cand.length) { G.seen[c] = new Set(shown); cand = G.ranked[c].filter((x) => !shown.has(x.rid)); }
  if (!cand.length) { toast('Больше вариантов нет — добавь продуктов или разреши докупить'); return; }
  const next = (c === 'main' && cand.find((x) => x.tier === cur.tier)) || cand[0];
  G.seen[c].add(next.rid);
  G.result[c][i] = next;
}
function feasibilityWarnings() {
  if (!G.result || G.mode !== 'each') return [];
  const count = {};
  Object.values(G.result).flat().forEach((x) => { if (x.lo || x.c === 'drink') return; x.used.forEach((id) => { if (P(id).cat !== 'base') count[id] = (count[id] || 0) + 1; }); });
  return Object.entries(count).filter(([id, n]) => n >= 2 && (S.pantry[id]?.q || 3) <= 2).map(([id, n]) => `${P(id).n} — в ${plural(n, 'блюде', 'блюдах', 'блюдах')}, а этого ${QN[S.pantry[id].q].toLowerCase()}`);
}

// ——— меню → ссылка ———
function menuToPayload(m) {
  return {
    i: m.id, t: m.title, h: m.host, m: m.meal, p: m.tpl, o: m.mode === 'one' ? 1 : 2, d: m.deadline || 0, n: m.note || '',
    x: m.items.map((it) => (it.lo ? [it.c, '#', it.n, (it.al || []).join(',')] : [it.c, it.rid, it.used.concat(it.opt || []).join(','), it.tier])),
  };
}
function resolvePayload(pl) {
  return {
    id: pl.i, title: pl.t, host: pl.h, meal: pl.m, tpl: pl.p, mode: pl.o === 1 ? 'one' : 'each', deadline: pl.d, note: pl.n,
    items: pl.x.map((x, idx) => {
      if (x[1] === '#') return { idx, c: x[0], lo: true, n: x[2], al: x[3] ? x[3].split(',') : [], desc: 'Уже приготовлено — осталось только разогреть', time: 5 };
      const r = RID[x[1]]; if (!r) return null;
      const used = x[2] ? x[2].split(',').filter((id) => P(id)) : [];
      return { idx, c: x[0], rid: r.id, n: r.n, desc: r.desc, time: r.time, kcal: r.kcal, cu: r.cu, tier: x[3] || r.tier, spice: r.spice, used, al: alOf(used), ing: used.filter((id) => P(id).cat !== 'base').map((id) => P(id).n) };
    }).filter(Boolean),
  };
}
async function menuLink(m) { return baseUrl() + '#m=' + (await pack(menuToPayload(m))); }

async function shareText(title, text, url) {
  const full = url ? text + '\n' + url : text;
  if (navigator.share) {
    try { await navigator.share({ title, text: full }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  openSheet(`<h3>Отправить</h3>
    <p class="muted">Скопируй текст или выбери мессенджер.</p>
    <textarea class="input" rows="6" readonly id="shareTa">${esc(full)}</textarea>
    <div class="row wrap gap">
      <button class="btn primary" data-a="copyShare">📋 Скопировать</button>
      <a class="btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url || '')}&text=${encodeURIComponent(text)}">Telegram</a>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(full)}">WhatsApp</a>
    </div>`);
  return false;
}

// ——— интерфейс: общее ———
const UI = { tab: 'fridge', menuId: null, fq: '', openCats: new Set() };
let toastTimer = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.add('open'); document.body.classList.add('noscroll'); }
function closeSheet() { $('#sheet').classList.remove('open'); document.body.classList.remove('noscroll'); SH = {}; }
let SH = {}; // состояние открытой шторки

const alBadges = (al) => al.map((a) => `<span class="al" title="${esc(DB.allergens[a]?.n)}">${DB.allergens[a]?.e || ''}</span>`).join('');
const pname = (id) => (P(id) ? P(id).n : id);
const plist = (ids) => ids.map(pname).join(', ');

function render() {
  const tabs = [['fridge', '🧊', 'Холодильник'], ['gen', '✨', 'Генератор'], ['menus', '📜', 'Меню'], ['shop', '🛒', 'Покупки'], ['people', '👥', 'Едоки']];
  const shopN = S.shop.filter((x) => !x.done).length;
  const newResp = S.menus.reduce((n, m) => n + (m.responses || []).filter((r) => !r.seen).length, 0);
  let body = '';
  if (UI.tab === 'fridge') body = vFridge();
  else if (UI.tab === 'gen') body = vGen();
  else if (UI.tab === 'menus') body = UI.menuId ? vMenu(UI.menuId) : vMenus();
  else if (UI.tab === 'shop') body = vShop();
  else if (UI.tab === 'people') body = vPeople();
  $('#app').innerHTML = `<main class="page">${body}</main>
  <nav class="tabbar">${tabs.map(([id, e, n]) => `<button class="tab ${UI.tab === id ? 'on' : ''}" data-a="tab" data-id="${id}"><span class="te">${e}</span><span>${n}</span>${id === 'shop' && shopN ? `<b class="dot">${shopN}</b>` : ''}${id === 'menus' && newResp ? `<b class="dot">${newResp}</b>` : ''}</button>`).join('')}</nav>`;
}

// ——— Холодильник ———
function vFridge() {
  const inF = Object.keys(S.pantry).filter((id) => P(id) && P(id).cat !== 'base');
  const soonN = inF.filter((id) => S.pantry[id].soon).length;
  const shelves = DB.categories.filter(([c]) => c !== 'base').map(([c, n, e]) => {
    const items = inF.filter((id) => P(id).cat === c);
    if (!items.length) return '';
    return `<div class="shelf"><div class="shelf-label">${e} ${n}</div><div class="shelf-items">${items.map((id) => {
      const v = S.pantry[id];
      return `<button class="tok q${v.q} ${v.soon ? 'soon' : ''}" data-a="prod" data-id="${id}"><span class="te">${P(id).e}</span><span class="tn">${esc(P(id).n)}</span><span class="qd"><i></i><i></i><i></i></span></button>`;
    }).join('')}</div></div>`;
  }).join('');
  const lo = S.leftovers.filter((l) => l.portions > 0);
  const base = Object.keys(DB.products).filter((id) => P(id).cat === 'base');
  return `
  <header class="hdr"><div><h1>Мой холодильник</h1><p class="muted">${plural(inF.length, 'продукт', 'продукта', 'продуктов')}${soonN ? ` · <span class="warn-t">${soonN} надо съесть</span>` : ''}</p></div></header>
  <section class="fridge">${shelves || `<div class="empty"><div class="big">🧊</div><p>Холодильник пуст. Отметь продукты ниже — они сохранятся, и генератор будет брать их автоматически.</p></div>`}
  <p class="legend"><span class="qd q3"><i></i><i></i><i></i></span> много · <span class="qd q2"><i></i><i></i><i></i></span> немного · <span class="qd q1"><i></i><i></i><i></i></span> на донышке · <b class="soon-dot">!</b> надо съесть</p></section>

  <section class="card">
    <div class="row between"><h2>🍱 Готовая еда</h2><button class="btn small" data-a="loAdd">+ Добавить</button></div>
    ${lo.length ? lo.map((l) => { const d = daysAgo(l.date); return `<div class="lo ${d >= 3 ? 'old' : ''}">
      <div><b>${esc(l.name)}</b><div class="muted small">${plural(l.portions, 'порция', 'порции', 'порций')} · ${d === 0 ? 'сегодня' : d === 1 ? 'вчера' : plural(d, 'день', 'дня', 'дней') + ' назад'}${d >= 3 ? ' · <span class="warn-t">съешь сегодня</span>' : ''} ${alBadges(l.al || [])}</div></div>
      <div class="row gap"><button class="btn icon" data-a="loStep" data-id="${l.id}" data-d="-1">−</button><button class="btn icon" data-a="loStep" data-id="${l.id}" data-d="1">+</button></div></div>`; }).join('')
    : `<p class="muted small">Остались котлеты, пюре или блины? Добавь их сюда — генератор предложит их в меню как «готово за 5 минут».</p>`}
  </section>

  <section class="card">
    <h2>🧂 Всегда есть</h2>
    <p class="muted small">Базовое, что почти не заканчивается. Отметь один раз.</p>
    <div class="chips">${base.map((id) => `<button class="chip ${S.pantry[id] ? 'on' : ''}" data-a="toggleBase" data-id="${id}">${P(id).e} ${esc(P(id).n)}</button>`).join('')}</div>
  </section>

  <section class="card">
    <h2>➕ Добавить продукты</h2>
    <input class="input" placeholder="Поиск: курица, сыр, рис…" data-in="fsearch" value="${esc(UI.fq)}">
    <div id="fresults">${fSearchResults()}</div>
    <div class="cats">${DB.categories.filter(([c]) => c !== 'base').map(([c, n, e]) => `
      <details ${UI.openCats.has(c) ? 'open' : ''} data-cat="${c}"><summary>${e} ${n} <span class="muted small">${inF.filter((id) => P(id).cat === c).length || ''}</span></summary>
      <div class="chips">${Object.keys(DB.products).filter((id) => P(id).cat === c).map((id) => chipProd(id)).join('')}</div></details>`).join('')}
    </div>
  </section>`;
}
const chipProd = (id) => `<button class="chip ${S.pantry[id] ? 'on' : ''}" data-a="toggleProd" data-id="${id}">${P(id).e} ${esc(P(id).n)}</button>`;
function fSearchResults() {
  const q = UI.fq.trim().toLowerCase(); if (!q) return '';
  const res = Object.keys(DB.products).filter((id) => P(id).n.toLowerCase().includes(q)).slice(0, 24);
  return `<div class="chips">${res.length ? res.map(chipProd).join('') : '<span class="muted small">Ничего не нашлось</span>'}</div>`;
}
function sheetProduct(id) {
  const v = S.pantry[id]; if (!v) return;
  openSheet(`<h3>${P(id).e} ${esc(P(id).n)}</h3>
    <label class="lbl">Сколько осталось</label>
    <div class="seg">${[3, 2, 1].map((q) => `<button class="${v.q === q ? 'on' : ''}" data-a="setQ" data-id="${id}" data-q="${q}">${QN[q]}</button>`).join('')}</div>
    <label class="switch"><input type="checkbox" data-a="setSoon" data-id="${id}" ${v.soon ? 'checked' : ''}><span>⏰ Надо съесть поскорее</span></label>
    <p class="muted small">Такие продукты генератор ставит в приоритет.</p>
    <div class="row between"><button class="btn danger" data-a="removeProd" data-id="${id}">Закончилось</button><button class="btn primary" data-a="closeSheet">Готово</button></div>`);
}
function sheetLoAdd() {
  SH = { kind: 'lo', q: '', rid: null, name: '', portions: 2, al: new Set(), fl: new Set(), c: 'main' };
  drawLoSheet();
}
function drawLoSheet() {
  const q = SH.q.trim().toLowerCase();
  const res = q ? DB.recipes.filter((r) => r.course !== 'drink' && r.n.toLowerCase().includes(q)).slice(0, 6) : [];
  openSheet(`<h3>🍱 Готовая еда</h3>
    <label class="lbl">Что осталось?</label>
    <input class="input" placeholder="Котлеты, пюре, блины… или своё название" data-in="loq" value="${esc(SH.q)}">
    <div id="loRes">${res.map((r) => `<button class="pick ${SH.rid === r.id ? 'on' : ''}" data-a="loPick" data-id="${r.id}">${DB.courses[r.course].e} ${esc(r.n)}</button>`).join('')}</div>
    <label class="lbl">Раздел меню</label>
    <div class="seg">${['salad', 'soup', 'main', 'dessert'].map((c) => `<button class="${SH.c === c ? 'on' : ''}" data-a="loC" data-c="${c}">${DB.courses[c].e} ${DB.courses[c].n.split(' ')[0]}</button>`).join('')}</div>
    <label class="lbl">Порций</label>
    <div class="row gap"><button class="btn icon" data-a="loP" data-d="-1">−</button><b class="big-n">${SH.portions}</b><button class="btn icon" data-a="loP" data-d="1">+</button></div>
    <label class="lbl">Что внутри (для аллергий и запретов)</label>
    <div class="chips">${Object.entries(DB.allergens).map(([k, a]) => `<button class="chip ${SH.al.has(k) ? 'on' : ''}" data-a="loAl" data-k="${k}">${a.e} ${a.n}</button>`).join('')}</div>
    <div class="chips">${['meat', 'pork', 'poultry', 'fish', 'seafood'].map((f) => `<button class="chip ${SH.fl.has(f) ? 'on' : ''}" data-a="loFl" data-k="${f}">${FLAG_N[f]}</button>`).join('')}</div>
    <div class="row between"><button class="btn" data-a="closeSheet">Отмена</button><button class="btn primary" data-a="loSave">Сохранить</button></div>`);
}

// ——— Генератор ———
function vGen() {
  const eat = gEaters();
  const ctx = buildCtx();
  const inF = Object.keys(S.pantry).filter((id) => P(id) && P(id).cat !== 'base');
  const soonN = inF.filter((id) => S.pantry[id].soon && G.mark[id] !== 'skip').length;
  const usedN = inF.filter((id) => G.mark[id] !== 'skip').length;
  const r = ctx.r;
  const restr = [...[...r.al].map((a) => DB.allergens[a].e + ' ' + DB.allergens[a].n), ...[...r.flags].map((f) => 'без: ' + FLAG_N[f])];
  const lo = S.leftovers.filter((l) => l.portions > 0);
  return `
  <header class="hdr"><div><h1>Генератор меню</h1><p class="muted">Берёт продукты из холодильника автоматически</p></div></header>
  <section class="card">
    <label class="lbl">Приём пищи</label>
    <div class="seg big">${Object.entries(DB.meals).map(([k, n]) => `<button class="${G.meal === k ? 'on' : ''}" data-a="gMeal" data-k="${k}">${{ b: '☀️', l: '🌤️', d: '🌙' }[k]} ${n}</button>`).join('')}</div>

    <label class="lbl">Кто ест</label>
    ${S.people.length ? `<div class="chips">${S.people.map((p) => `<button class="chip ${eat.has(p.id) ? 'on' : ''}" data-a="gEater" data-id="${p.id}">${p.emoji || '🙂'} ${esc(p.name)}</button>`).join('')}</div>`
    : `<p class="muted small">Добавь едоков на вкладке «Едоки», чтобы учитывать их аллергии и вкусы.</p>`}
    ${restr.length ? `<p class="restr">🛡️ Исключаю: ${restr.map(esc).join(' · ')}</p>` : ''}

    <label class="lbl">Разделы меню</label>
    <div class="chips">${COURSE_ORDER.map((c) => `<button class="chip ${G.courses.has(c) ? 'on' : ''}" data-a="gCourse" data-c="${c}">${DB.courses[c].e} ${DB.courses[c].n}</button>`).join('')}</div>

    <label class="lbl">Время на одно блюдо</label>
    <div class="seg">${[15, 30, 45, 60, 90].map((t) => `<button class="${G.time === t ? 'on' : ''}" data-a="gTime" data-t="${t}">${t === 90 ? '90+' : t} мин</button>`).join('')}</div>

    <label class="lbl">Кухня <span class="muted small">(необязательно)</span></label>
    <div class="chips scroll">${Object.entries(DB.cuisines).map(([k, n]) => `<button class="chip ${G.cuisines.has(k) ? 'on' : ''}" data-a="gCu" data-k="${k}">${esc(n)}</button>`).join('')}</div>

    <label class="lbl">Продукты</label>
    <button class="summary" data-a="gToggleProducts">🧊 Беру ${plural(usedN, 'продукт', 'продукта', 'продуктов')}${soonN ? `, из них <b class="warn-t">${soonN} надо съесть</b>` : ''} <span class="muted">${G.showProducts ? '▲' : '▼ настроить'}</span></button>
    ${G.showProducts ? `<p class="muted small">Нажимай, чтобы переключать: обычный → ⭐ обязательно использовать → 🚫 не трогать сегодня</p>
      <div class="chips">${inF.map((id) => { const m = G.mark[id]; return `<button class="chip ${m === 'must' ? 'must' : m === 'skip' ? 'skip' : 'on'}" data-a="gMark" data-id="${id}">${m === 'must' ? '⭐' : m === 'skip' ? '🚫' : P(id).e} ${esc(P(id).n)}${S.pantry[id].soon ? ' ⏰' : ''}</button>`; }).join('') || '<span class="muted small">Холодильник пуст</span>'}</div>` : ''}

    <label class="lbl">Если чего-то не хватает</label>
    <div class="seg">${[[0, 'Только что есть'], [1, 'Докупить 1'], [2, 'Докупить до 2']].map(([v, n]) => `<button class="${G.buy === v ? 'on' : ''}" data-a="gBuy" data-v="${v}">${n}</button>`).join('')}</div>

    ${lo.length ? `<label class="switch"><input type="checkbox" data-a="gLo" ${G.useLo ? 'checked' : ''}><span>🍱 Предложить готовое (${lo.map((l) => esc(l.name)).join(', ')})</span></label>` : ''}

    <button class="btn primary wide" data-a="gRun">✨ ${G.result ? 'Сгенерировать заново' : 'Сгенерировать меню'}</button>
  </section>
  ${G.result ? vGenResult() : ''}`;
}
function dishCard(x, c, i, editable) {
  if (x.lo) return `<div class="dish lo-dish"><div class="dish-top"><span class="tier t0">Из вчерашнего</span><span class="muted small">${plural(x.por, 'порция', 'порции', 'порций')}</span></div>
    <div class="dish-n">${esc(x.n)}</div><div class="dish-meta">⏱ 5 мин на разогрев ${alBadges(x.al)}</div>
    ${editable ? `<div class="dish-acts"><button class="btn small ghost" data-a="gRemove" data-c="${c}" data-i="${i}">✕ Убрать</button></div>` : ''}</div>`;
  const r = RID[x.rid];
  return `<div class="dish">
    <div class="dish-top"><span class="tier t${x.tier}">${DB.tiers[x.tier]}</span><span class="muted small">${esc(DB.cuisines[r.cu] || '')}</span></div>
    <div class="dish-n">${esc(r.n)}</div>
    <div class="dish-meta">⏱ ${r.time} мин · ${r.kcal} ккал${r.spice ? ' · ' + '🌶️'.repeat(r.spice) : ''} ${alBadges(x.al)}</div>
    <div class="dish-d">${esc(r.desc)}</div>
    ${x.used.length ? `<div class="dish-ing">🧊 ${esc(plist(x.used.concat(x.opt).filter((id) => P(id).cat !== 'base')))}</div>` : ''}
    ${x.soon.length ? `<div class="badge soon">⏰ Спасает: ${esc(plist(x.soon))}</div>` : ''}
    ${x.miss.length ? `<div class="badge buy">🛒 Докупить: ${esc(plist(x.miss))}</div>` : ''}
    ${x.dis.length ? `<div class="badge dis">😕 Есть нелюбимое: ${esc(plist(x.dis))} — можно убрать или заменить</div>` : ''}
    ${editable ? `<div class="dish-acts"><button class="btn small" data-a="gReplace" data-c="${c}" data-i="${i}">↻ Заменить</button><button class="btn small ghost" data-a="recipe" data-id="${x.rid}" data-c="${c}" data-i="${i}">Рецепт</button><button class="btn small ghost" data-a="gRemove" data-c="${c}" data-i="${i}">✕</button></div>` : ''}
  </div>`;
}
function vGenResult() {
  const warns = feasibilityWarnings();
  const any = COURSE_ORDER.some((c) => G.result[c] && G.result[c].length);
  return `<section class="card">
    <div class="row between"><h2>Ваше меню</h2><button class="btn small" data-a="gRun">🔀 Перемешать</button></div>
    ${any ? '' : `<div class="empty"><p>Ничего не подошло. Попробуй добавить продуктов, увеличить время или разрешить докупить 1–2 продукта.</p></div>`}
    ${COURSE_ORDER.filter((c) => G.result[c]).map((c) => `<h3 class="course-h">${DB.courses[c].e} ${DB.courses[c].n}</h3>
      ${G.result[c].length ? G.result[c].map((x, i) => dishCard(x, c, i, true)).join('') : '<p class="muted small">Под ограничения и продукты ничего не нашлось.</p>'}
      ${G.ranked[c] && G.ranked[c].length > G.result[c].filter((x) => !x.lo).length ? `<button class="btn small ghost" data-a="gAdd" data-c="${c}">+ Ещё вариант</button>` : ''}`).join('')}
  </section>
  ${any ? `<section class="card">
    <h2>Оформление</h2>
    <label class="lbl">Название</label>
    <input class="input" data-in="gTitle" value="${esc(G.title)}">
    <label class="lbl">Шаблон</label>
    <div class="tpls">${Object.entries(TPL).map(([k, t]) => `<button class="tplc tpl-${k} ${G.tpl === k ? 'on' : ''}" data-a="gTpl" data-k="${k}"><span class="tplc-e">${t.e}</span><span class="tplc-n">${t.n}</span></button>`).join('')}</div>
    <label class="lbl">Как выбирают</label>
    <div class="seg">${[['each', '🍽️ Каждый своё'], ['one', '🗳️ Голосование: одно на всех']].map(([k, n]) => `<button class="${G.mode === k ? 'on' : ''}" data-a="gMode" data-k="${k}">${n}</button>`).join('')}</div>
    ${warns.length ? `<div class="warnbox">⚠️ Если выберут разные блюда, может не хватить:<br>${warns.map(esc).join('<br>')}</div>` : ''}
    <label class="lbl">Выбрать до <span class="muted small">(необязательно)</span></label>
    <input class="input" type="time" data-in="gDeadline" value="${esc(G.deadline)}">
    <label class="lbl">Приветствие</label>
    <input class="input" data-in="gNote" placeholder="Например: Жду тебя к восьми ❤️" value="${esc(G.note)}">
    <label class="lbl">От кого</label>
    <input class="input" data-in="host" placeholder="Твоё имя" value="${esc(S.settings.host)}">
    <div class="row gap wrap"><button class="btn wide" data-a="gPreview">👀 Предпросмотр</button><button class="btn primary wide" data-a="gCreate">📨 Собрать и отправить</button></div>
  </section>` : ''}`;
}
function genToMenu() {
  const items = [];
  COURSE_ORDER.forEach((c) => (G.result[c] || []).forEach((x) => {
    if (x.lo) items.push({ c, lo: true, loId: x.loId, n: x.n, al: x.al, fl: x.fl });
    else items.push({ c, rid: x.rid, tier: x.tier, used: x.used, opt: x.opt, miss: x.miss, amt: x.amt, al: x.al, fl: x.fl });
  }));
  let deadline = 0;
  if (G.deadline) { const [h, mi] = G.deadline.split(':').map(Number); const d = new Date(); d.setHours(h, mi, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); deadline = d.toISOString(); }
  return { id: uid(), created: new Date().toISOString(), meal: G.meal, title: G.title || defaultTitle(), tpl: G.tpl, mode: G.mode, deadline, note: G.note, host: S.settings.host, eaters: [...gEaters()], items, responses: [], status: 'sent' };
}

// ——— Рецепт ———
function sheetRecipe(rid, x) {
  const r = RID[rid]; if (!r) return;
  const amt = (x && x.amt) || {};
  const usedSet = new Set(x ? x.used.concat(x.opt || []) : []);
  const line = (slot, optional) => {
    const pick = slot.ids.find((id) => usedSet.has(id)) || slot.ids[0];
    const have = usedSet.has(pick);
    const alts = slot.ids.filter((id) => id !== pick && P(id)).map(pname);
    return `<li class="${have ? 'have' : optional ? 'opt' : 'need'}">${have ? '✓' : optional ? '○' : '🛒'} ${esc(pname(pick))} <span class="muted">${esc(amt[pick] || slot.amt)}</span>${alts.length ? `<span class="muted small"> · или ${esc(alts.join(', '))}</span>` : ''}</li>`;
  };
  const fav = S.favs.includes(rid);
  openSheet(`<h3>${esc(r.n)}</h3>
    <p class="muted">${esc(DB.cuisines[r.cu] || '')} · ⏱ ${r.time} мин · ${r.kcal} ккал${r.eq.length ? ' · ' + r.eq.map((e) => ({ stove: 'плита', oven: 'духовка/аэрогриль', blender: 'блендер' }[e] || e)).join(', ') : ''}</p>
    <p>${esc(r.desc)}</p>
    <h4>Ингредиенты</h4><ul class="ing">${r.req.map((s) => line(s, false)).join('')}${r.opt.map((s) => line(s, true)).join('')}<li class="muted small">+ соль, перец, масло</li></ul>
    <h4>Как готовить</h4><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="row between"><button class="btn" data-a="fav" data-id="${rid}">${fav ? '★ В избранном' : '☆ В избранное'}</button><button class="btn primary" data-a="closeSheet">Закрыть</button></div>`);
}

// ——— Меню (история) ———
function vMenus() {
  const ms = S.menus.slice().reverse();
  return `<header class="hdr"><div><h1>Мои меню</h1><p class="muted">История, ответы и что готовить</p></div><button class="btn primary small" data-a="tab" data-id="gen">+ Новое</button></header>
  ${ms.length ? ms.map((m) => { const nr = (m.responses || []).length, nn = (m.responses || []).filter((r) => !r.seen).length; return `
    <button class="card menu-row" data-a="openMenu" data-id="${m.id}">
      <div class="mr-e tpl-${m.tpl}">${TPL[m.tpl]?.e || '🍽️'}</div>
      <div class="grow"><b>${esc(m.title)}</b><div class="muted small">${fmtDate(m.created)} · ${DB.meals[m.meal]} · ${m.items.length} позиций</div></div>
      <div class="col-end">${nn ? `<span class="pill new">+${nn} новых</span>` : nr ? `<span class="pill">${plural(nr, 'ответ', 'ответа', 'ответов')}</span>` : '<span class="pill muted">ждём ответа</span>'}${m.status === 'done' ? '<span class="pill ok">приготовлено</span>' : m.status === 'cooking' ? '<span class="pill hot">готовлю</span>' : ''}</div>
    </button>`; }).join('') : `<div class="empty card"><div class="big">📜</div><p>Здесь появятся меню, которые ты отправишь. Начни с генератора.</p><button class="btn primary" data-a="tab" data-id="gen">✨ К генератору</button></div>`}
  <section class="card"><h2>Вставить ответ</h2><p class="muted small">Если ответная ссылка не открылась сама, вставь её сюда.</p>
    <div class="row gap"><input class="input grow" id="pasteReply" placeholder="Ссылка от гостя"><button class="btn" data-a="pasteReply">Добавить</button></div></section>`;
}
function tally(m) {
  const cnt = {}; (m.responses || []).forEach((r) => (r.s || []).forEach((i) => (cnt[i] = (cnt[i] || 0) + 1)));
  let cook = [];
  if (m.mode === 'one') {
    COURSE_ORDER.forEach((c) => {
      let best = -1, bn = 0;
      m.items.forEach((it, i) => { if (it.c === c && (cnt[i] || 0) > bn) { bn = cnt[i]; best = i; } });
      if (best >= 0) cook.push(best);
    });
  } else cook = Object.keys(cnt).map(Number).sort((a, b) => a - b);
  return { cnt, cook };
}
function itemName(it) { return it.lo ? it.n : RID[it.rid]?.n || '?'; }
function vMenu(id) {
  const m = S.menus.find((x) => x.id === id);
  if (!m) { UI.menuId = null; return vMenus(); }
  (m.responses || []).forEach((r) => (r.seen = true)); save();
  const { cnt, cook } = tally(m);
  const isFile = location.protocol === 'file:';
  const cookItems = cook.map((i) => m.items[i]).filter(Boolean);
  const dishes = cookItems.filter((it) => !it.lo && it.c !== 'drink');
  const maxT = Math.max(0, ...dishes.map((it) => RID[it.rid].time));
  const miss = [...new Set(cookItems.flatMap((it) => it.miss || []))];
  return `<header class="hdr"><button class="btn icon" data-a="backMenus">←</button><div class="grow"><h1>${esc(m.title)}</h1><p class="muted">${fmtDate(m.created)} · ${DB.meals[m.meal]} · ${TPL[m.tpl]?.n} · ${m.mode === 'one' ? 'голосование' : 'каждый своё'}${m.deadline ? ' · до ' + fmtTime(new Date(m.deadline)) : ''}</p></div></header>
  ${isFile ? `<div class="warnbox">ℹ️ Приложение открыто как файл на этом устройстве — ссылка откроется только здесь. Чтобы её могли открыть другие, приложение нужно разместить в интернете (это бесплатно, без хранения твоих данных).</div>` : ''}
  <section class="card">
    <div class="row gap wrap"><button class="btn primary wide" data-a="shareMenu" data-id="${m.id}">📨 Отправить ссылку</button><button class="btn" data-a="previewMenu" data-id="${m.id}">👀 Как увидит гость</button><button class="btn" data-a="qr" data-id="${m.id}">▦ QR-код</button></div>
  </section>
  <section class="card">
    <h2>Ответы ${m.responses.length ? `<span class="pill">${m.responses.length}</span>` : ''}</h2>
    ${m.responses.length ? m.responses.map((r) => {
      const conflicts = (r.s || []).map((i) => m.items[i]).filter((it) => it && (it.al || []).some((a) => (r.a || []).includes(a)));
      return `<div class="resp"><div class="row between"><b>${esc(r.g || 'Гость')}</b><span class="muted small">${fmtTime(new Date(r.t))}</span></div>
      <ul>${(r.s || []).map((i) => m.items[i] ? `<li>${DB.courses[m.items[i].c].e} ${esc(itemName(m.items[i]))}</li>` : '').join('')}</ul>
      ${r.c ? `<p class="comment">💬 ${esc(r.c)}</p>` : ''}
      ${(r.a || []).length ? `<p class="small">🛡️ Не ест: ${r.a.map((a) => DB.allergens[a]?.e + ' ' + DB.allergens[a]?.n).join(', ')}</p>` : ''}
      ${conflicts.length ? `<div class="warnbox">⚠️ В выбранном есть то, что гость не ест: ${conflicts.map((it) => esc(itemName(it))).join(', ')}</div>` : ''}</div>`;
    }).join('') : `<p class="muted small">Пока никто не выбрал. Когда гость нажмёт «Отправить выбор», тебе придёт ссылка — открой её, и ответ появится здесь.</p>`}
  </section>
  ${cookItems.length ? `<section class="card">
    <h2>👩‍🍳 Что готовить</h2>
    ${cookItems.map((it) => `<div class="cook-row"><span>${DB.courses[it.c].e} <b>${esc(itemName(it))}</b>${m.mode === 'each' || cnt[m.items.indexOf(it)] > 1 ? ` <span class="pill">×${cnt[m.items.indexOf(it)]}</span>` : ''}</span>${it.lo ? '<span class="muted small">разогреть</span>' : `<button class="btn small ghost" data-a="recipeM" data-m="${m.id}" data-i="${m.items.indexOf(it)}">Рецепт</button>`}</div>`).join('')}
    ${miss.length ? `<div class="badge buy">🛒 Не хватает: ${esc(plist(miss))} <button class="btn small" data-a="missToShop" data-id="${m.id}">В покупки</button></div>` : ''}
    ${dishes.length > 1 ? `<h4>⏱ Таймлайн</h4><ol class="timeline">${dishes.slice().sort((a, b) => RID[b.rid].time - RID[a.rid].time).map((it) => { const off = maxT - RID[it.rid].time; return `<li><b>${off ? 'через ' + off + ' мин' : 'Сразу'}</b> — начни «${esc(RID[it.rid].n)}» (${RID[it.rid].time} мин)</li>`; }).join('')}<li><b>через ${maxT} мин</b> — всё готово, подаём 🎉</li></ol>` : ''}
    <div class="row gap wrap">
      ${m.status !== 'done' ? `<button class="btn" data-a="statusCooking" data-id="${m.id}">🔥 Сообщить «Готовлю»</button><button class="btn primary" data-a="cooked" data-id="${m.id}">✓ Приготовлено</button>` : '<span class="pill ok">Приготовлено — продукты списаны</span>'}
    </div>
  </section>` : ''}
  <section class="card"><h2>Позиции меню</h2>
    ${COURSE_ORDER.map((c) => { const its = m.items.map((it, i) => [it, i]).filter(([it]) => it.c === c); if (!its.length) return ''; return `<h3 class="course-h">${DB.courses[c].e} ${DB.courses[c].n}</h3>${its.map(([it, i]) => `<div class="cook-row"><span>${esc(itemName(it))}</span><span class="muted small">${cnt[i] ? '✓ ' + cnt[i] : ''}</span></div>`).join('')}`; }).join('')}
    <div class="row between"><button class="btn small" data-a="pasteFocus">Вставить ответ вручную</button><button class="btn small danger" data-a="delMenu" data-id="${m.id}">Удалить меню</button></div>
    <div id="pasteBox"></div>
  </section>`;
}
async function importReply(str) {
  const i = str.indexOf('#r='); if (i < 0) { toast('Это не ответная ссылка'); return false; }
  let r; try { r = await unpack(str.slice(i + 3)); } catch (e) { toast('Ссылка повреждена'); return false; }
  const m = S.menus.find((x) => x.id === r.i);
  if (!m) { toast('Это ответ на меню, которого нет на этом устройстве'); return false; }
  m.responses = m.responses || [];
  if (!m.responses.some((x) => x.t === r.t && x.g === r.g)) { m.responses.push({ g: r.g, s: r.s, c: r.c, a: r.a, t: r.t, seen: false }); save(); toast(`🎉 ${r.g || 'Гость'} выбрал(а) блюда!`); }
  else toast('Этот ответ уже добавлен');
  UI.tab = 'menus'; UI.menuId = m.id; render();
  return true;
}
function sheetCooked(m) {
  const { cook } = tally(m);
  const its = cook.map((i) => [m.items[i], i]).filter(([it]) => it && !it.lo && it.c !== 'drink');
  SH = { kind: 'cooked', id: m.id, left: {} };
  its.forEach(([, i]) => (SH.left[i] = 0));
  drawCooked(m, its);
}
function drawCooked(m, its) {
  openSheet(`<h3>✓ Приготовлено!</h3>
    <p class="muted">Использованные продукты спишутся из холодильника (на один уровень: много → немного → на донышке → закончилось).</p>
    ${its.length ? `<h4>Осталось что-то?</h4>${its.map(([it, i]) => `<div class="row between cook-row"><span>${esc(itemName(it))}</span><div class="row gap"><button class="btn icon" data-a="ckL" data-i="${i}" data-d="-1">−</button><b>${SH.left[i]}</b><button class="btn icon" data-a="ckL" data-i="${i}" data-d="1">+</button></div></div>`).join('')}<p class="muted small">Порции попадут в «Готовую еду».</p>` : ''}
    <div class="row between"><button class="btn" data-a="closeSheet">Отмена</button><button class="btn primary" data-a="ckDone">Готово</button></div>`);
}
function applyCooked() {
  const m = S.menus.find((x) => x.id === SH.id); if (!m) return;
  const { cnt, cook } = tally(m);
  cook.forEach((i) => {
    const it = m.items[i]; if (!it) return;
    if (it.lo) {
      const lo = S.leftovers.find((l) => l.id === it.loId);
      if (lo) lo.portions = Math.max(0, lo.portions - (m.mode === 'each' ? cnt[i] : 1));
      return;
    }
    (it.used || []).concat(it.opt || []).forEach((pid) => {
      const v = S.pantry[pid]; if (!v || P(pid).cat === 'base') return;
      v.q -= 1; v.soon = false; if (v.q <= 0) delete S.pantry[pid];
    });
  });
  Object.entries(SH.left).forEach(([i, n]) => {
    if (n > 0) { const it = m.items[i]; S.leftovers.push({ id: uid(), name: itemName(it), rid: it.rid, c: it.c === 'drink' ? 'main' : it.c, portions: n, date: new Date().toISOString(), al: it.al || [], fl: it.fl || [] }); }
  });
  S.leftovers = S.leftovers.filter((l) => l.portions > 0);
  m.status = 'done'; save(); closeSheet(); toast('Приятного аппетита! Холодильник обновлён'); render();
}

// ——— Покупки ———
function vShop() {
  const q = (UI.sq || '').trim().toLowerCase();
  const sugg = q ? Object.keys(DB.products).filter((id) => P(id).n.toLowerCase().includes(q)).slice(0, 8) : [];
  return `<header class="hdr"><div><h1>Список покупок</h1><p class="muted">Отметила купленное — продукт сам попадёт в холодильник</p></div></header>
  <section class="card">
    <div class="row gap"><input class="input grow" data-in="sq" placeholder="Что купить?" value="${esc(UI.sq || '')}"><button class="btn" data-a="shopAddFree">+</button></div>
    <div id="shopSugg" class="chips">${sugg.map((id) => `<button class="chip" data-a="shopAdd" data-id="${id}">${P(id).e} ${esc(P(id).n)}</button>`).join('')}</div>
  </section>
  <section class="card">
    ${S.shop.length ? S.shop.map((x, i) => `<label class="shop-row"><input type="checkbox" data-a="shopDone" data-i="${i}"><span>${x.pid ? P(x.pid).e + ' ' : ''}${esc(x.pid ? P(x.pid).n : x.name)}</span>${x.from ? `<span class="muted small">${esc(x.from)}</span>` : ''}<button class="btn icon ghost" data-a="shopDel" data-i="${i}">✕</button></label>`).join('')
    : '<div class="empty"><div class="big">🛒</div><p>Список пуст. Недостающее для выбранных блюд можно добавить сюда одной кнопкой.</p></div>'}
  </section>`;
}

// ——— Едоки и настройки ———
function vPeople() {
  const e = S.settings.equip;
  const EQ = [['stove', '🔥 Плита'], ['oven', '♨️ Духовка'], ['airfryer', '🌀 Аэрогриль'], ['multicooker', '🍲 Мультиварка'], ['blender', '🌪️ Блендер'], ['microwave', '📡 Микроволновка']];
  return `<header class="hdr"><div><h1>Едоки и настройки</h1><p class="muted">Аллергии, принципы и вкусы каждого</p></div></header>
  <section class="card">
    <div class="row between"><h2>👥 Кто у нас ест</h2><button class="btn small" data-a="personEdit">+ Добавить</button></div>
    ${S.people.length ? S.people.map((p) => `<button class="person" data-a="personEdit" data-id="${p.id}"><span class="pe">${p.emoji || '🙂'}</span><span class="grow"><b>${esc(p.name)}</b><span class="muted small">${[
      ...(p.al || []).map((a) => DB.allergens[a].e + ' ' + DB.allergens[a].n),
      ...(p.pr || []).map((x) => DB.principles[x].n),
      ...(p.dis || []).length ? ['не любит: ' + plist(p.dis)] : [],
      ['не ест острое', 'чуть острого', 'средне острое', 'любит острое'][p.spice ?? 3],
    ].map(esc).join(' · ')}</span></span><span>›</span></button>`).join('')
    : `<p class="muted small">Добавь себя, партнёра, детей или частых гостей. Генератор не предложит то, что кому-то из выбранных нельзя.</p>`}
  </section>
  <section class="card">
    <h2>🍳 Техника на кухне</h2>
    <div class="chips">${EQ.map(([k, n]) => `<button class="chip ${e[k] ? 'on' : ''}" data-a="equip" data-k="${k}">${n}</button>`).join('')}</div>
    <p class="muted small">Без духовки не предложу запекание (аэрогриль её заменяет), без блендера — супы-пюре и смузи.</p>
    <label class="lbl">Как подписывать меню</label>
    <input class="input" data-in="host" placeholder="Твоё имя" value="${esc(S.settings.host)}">
  </section>
  <section class="card">
    <h2>💾 Данные</h2>
    <p class="muted small">Всё хранится только на этом устройстве. Сделай резервную копию, чтобы не потерять при очистке браузера или перенести на другой телефон.</p>
    <div class="row gap wrap"><button class="btn" data-a="exportData">⬇️ Сохранить копию</button><label class="btn">⬆️ Восстановить<input type="file" accept="application/json" hidden data-in="importData"></label><button class="btn danger" data-a="resetData">Сбросить всё</button></div>
    <p class="muted small">В базе ${DB.recipes.filter((r) => r.course !== 'drink').length} блюд и ${DB.recipes.filter((r) => r.course === 'drink').length} напитков из ${Object.keys(DB.cuisines).length} кухонь.</p>
  </section>`;
}
function sheetPerson(id) {
  const p = id ? S.people.find((x) => x.id === id) : null;
  SH = { kind: 'person', id: p ? p.id : null, name: p ? p.name : '', emoji: p ? p.emoji : '🙂', al: new Set(p ? p.al : []), pr: new Set(p ? p.pr : []), dis: new Set(p ? p.dis : []), spice: p ? p.spice ?? 3 : 2, q: '' };
  drawPerson();
}
function drawPerson() {
  const q = SH.q.trim().toLowerCase();
  const res = q ? Object.keys(DB.products).filter((id) => P(id).n.toLowerCase().includes(q) && !SH.dis.has(id)).slice(0, 10) : [];
  openSheet(`<h3>${SH.id ? 'Изменить' : 'Новый едок'}</h3>
    <div class="row gap"><div class="emojis">${['🙂', '😊', '👩', '👨', '👧', '👦', '👵', '👴', '🐱', '❤️', '🌟', '🦊'].map((e) => `<button class="${SH.emoji === e ? 'on' : ''}" data-a="pEmoji" data-e="${e}">${e}</button>`).join('')}</div></div>
    <input class="input" data-in="pName" placeholder="Имя" value="${esc(SH.name)}">
    <label class="lbl">⛔ Аллергии и непереносимость <span class="muted small">(никогда не предложу)</span></label>
    <div class="chips">${Object.entries(DB.allergens).map(([k, a]) => `<button class="chip ${SH.al.has(k) ? 'on danger' : ''}" data-a="pAl" data-k="${k}">${a.e} ${a.n}</button>`).join('')}</div>
    <label class="lbl">🌱 Принципы питания</label>
    <div class="chips">${Object.entries(DB.principles).map(([k, a]) => `<button class="chip ${SH.pr.has(k) ? 'on' : ''}" data-a="pPr" data-k="${k}">${a.e} ${a.n}</button>`).join('')}</div>
    <label class="lbl">🌶️ Острота</label>
    <div class="seg">${['Не ест', 'Чуть-чуть', 'Средне', 'Любит'].map((n, i) => `<button class="${SH.spice === i ? 'on' : ''}" data-a="pSpice" data-v="${i}">${n}</button>`).join('')}</div>
    <label class="lbl">😕 Не любит <span class="muted small">(постараюсь избегать)</span></label>
    <div class="chips">${[...SH.dis].map((id) => `<button class="chip on" data-a="pDisDel" data-id="${id}">${P(id).e} ${esc(P(id).n)} ✕</button>`).join('')}</div>
    <input class="input" data-in="pq" placeholder="Найти продукт: лук, кинза…" value="${esc(SH.q)}">
    <div class="chips" id="pRes">${res.map((id) => `<button class="chip" data-a="pDisAdd" data-id="${id}">${P(id).e} ${esc(P(id).n)}</button>`).join('')}</div>
    <div class="row between">${SH.id ? '<button class="btn danger" data-a="pDel">Удалить</button>' : '<button class="btn" data-a="closeSheet">Отмена</button>'}<button class="btn primary" data-a="pSave">Сохранить</button></div>`);
}

// ——— Страница гостя ———
const GS = { menu: null, sel: {}, al: new Set(), name: '', comment: '', preview: false, sent: false };
function renderGuest(menu, preview) {
  GS.menu = menu; GS.preview = !!preview; GS.sel = {}; GS.al = new Set(); GS.sent = false;
  drawGuest();
}
function guestHTML() {
  const m = GS.menu;
  const closed = m.deadline && new Date(m.deadline) < new Date();
  const menuAl = [...new Set(m.items.flatMap((it) => it.al || []))];
  const courses = COURSE_ORDER.filter((c) => m.items.some((it) => it.c === c));
  if (GS.sent) return `<div class="g-wrap tpl-${m.tpl}"><div class="g-paper g-thanks"><div class="g-orn">✦</div><h1 class="g-title">Спасибо!</h1><p>Выбор отправлен${m.host ? ' — ' + esc(m.host) + ' уже знает, что готовить' : ''}.</p><p class="g-muted">Если сообщение не ушло, нажми ещё раз.</p><button class="g-btn" data-a="gsSend">Отправить ещё раз</button></div></div>`;
  return `<div class="g-wrap tpl-${m.tpl}">
    ${GS.preview ? '<div class="g-preview-bar">👀 Предпросмотр — так увидит гость <button data-a="closePreview">Закрыть</button></div>' : ''}
    <div class="g-paper">
      <div class="g-orn">${{ romantic: '❦', family: '🏡', minimal: '—', bistro: '✻', festive: '✨' }[m.tpl] || '✦'}</div>
      <div class="g-kicker">${DB.meals[m.meal] || 'Меню'}${m.host ? ' · от ' + esc(m.host) : ''}</div>
      <h1 class="g-title">${esc(m.title)}</h1>
      ${m.note ? `<p class="g-note">${esc(m.note)}</p>` : ''}
      ${m.deadline ? `<p class="g-dl">${closed ? 'Приём выборов закрыт' : 'Выбери до ' + fmtTime(new Date(m.deadline))}</p>` : ''}
      ${menuAl.length ? `<div class="g-al"><div class="g-muted">Есть что-то, что ты не ешь? Отметь — такие блюда я подсвечу.</div><div class="g-chips">${menuAl.map((a) => `<button class="g-chip ${GS.al.has(a) ? 'on' : ''}" data-a="gsAl" data-k="${a}">${DB.allergens[a].e} ${DB.allergens[a].n}</button>`).join('')}</div></div>` : ''}
      ${courses.map((c) => `<section class="g-sec"><h2 class="g-h">${DB.courses[c].n}</h2><div class="g-sub">выбери одно${m.mode === 'one' ? ' — побеждает большинство' : ''}</div>
        ${m.items.filter((it) => it.c === c).map((it) => { const bad = (it.al || []).filter((a) => GS.al.has(a)); const on = GS.sel[c] === it.idx; return `
          <button class="g-item ${on ? 'on' : ''} ${bad.length ? 'bad' : ''}" data-a="gsPick" data-c="${c}" data-i="${it.idx}" ${closed ? 'disabled' : ''}>
            <span class="g-check">${on ? '✓' : ''}</span>
            <span class="g-body"><span class="g-n">${esc(it.n)}${it.lo ? ' <em class="g-tag">готово</em>' : ''}</span>
            <span class="g-d">${esc(it.desc || '')}</span>
            ${it.ing && it.ing.length ? `<span class="g-ing">${esc(it.ing.join(' · '))}</span>` : ''}
            <span class="g-meta">${it.c !== 'drink' ? '⏱ ' + it.time + ' мин' : ''}${it.kcal && it.c !== 'drink' ? ' · ' + it.kcal + ' ккал' : ''}${it.spice ? ' · ' + '🌶️'.repeat(it.spice) : ''} ${(it.al || []).map((a) => DB.allergens[a].e).join('')}</span>
            ${bad.length ? `<span class="g-warn">Содержит: ${bad.map((a) => DB.allergens[a].n.toLowerCase()).join(', ')}</span>` : ''}</span>
          </button>`; }).join('')}</section>`).join('')}
      ${closed ? '' : `<section class="g-sec">
        <input class="g-input" data-in="gsName" placeholder="Как тебя зовут?" value="${esc(GS.name)}">
        <textarea class="g-input" data-in="gsComment" rows="2" placeholder="Пожелания: без лука, побольше соуса…">${esc(GS.comment)}</textarea>
        <button class="g-btn" data-a="gsSend" ${GS.preview ? 'disabled' : ''}>${GS.preview ? 'Кнопка отправки (в предпросмотре неактивна)' : 'Отправить выбор'}</button>
      </section>`}
      <div class="g-foot">Меню собрано в приложении «Домашнее меню»</div>
    </div></div>`;
}
function drawGuest() {
  const host = GS.preview ? $('#preview') : $('#app');
  host.innerHTML = guestHTML();
  if (GS.preview) host.classList.add('open');
}
async function guestSend() {
  const m = GS.menu;
  const s = Object.values(GS.sel);
  if (!s.length) { toast('Выбери хотя бы одно блюдо'); return; }
  const r = { i: m.id, g: GS.name.trim() || 'Гость', s, c: GS.comment.trim(), a: [...GS.al], t: Date.now() };
  const url = baseUrl() + '#r=' + (await pack(r));
  const lines = s.map((i) => { const it = m.items.find((x) => x.idx === i); return it ? `${DB.courses[it.c].e} ${it.n}` : ''; }).filter(Boolean);
  const text = `🍽 «${m.title}» — выбор от ${r.g}:\n${lines.join('\n')}${r.c ? '\n💬 ' + r.c : ''}${r.a.length ? '\n⚠️ Не ем: ' + r.a.map((a) => DB.allergens[a].n.toLowerCase()).join(', ') : ''}\n\nОтметить в приложении 👇`;
  GS.sent = true; drawGuest();
  await shareText('Мой выбор', text, url);
}

// ——— действия ———
const A = {
  tab(el) { UI.tab = el.dataset.id; if (UI.tab !== 'menus') UI.menuId = null; if (UI.tab === 'menus') UI.menuId = null; render(); window.scrollTo(0, 0); },
  closeSheet() { closeSheet(); render(); },
  copyShare() { const ta = $('#shareTa'); ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); } toast('Скопировано'); },
  // холодильник
  toggleProd(el) { const id = el.dataset.id; if (S.pantry[id]) delete S.pantry[id]; else { S.pantry[id] = { q: 3 }; toast(`${P(id).e} ${P(id).n} — в холодильнике`); } save(); render(); },
  toggleBase(el) { const id = el.dataset.id; if (S.pantry[id]) delete S.pantry[id]; else S.pantry[id] = { q: 3 }; save(); render(); },
  prod(el) { sheetProduct(el.dataset.id); },
  setQ(el) { S.pantry[el.dataset.id].q = +el.dataset.q; save(); sheetProduct(el.dataset.id); },
  setSoon(el) { S.pantry[el.dataset.id].soon = el.checked; save(); },
  removeProd(el) { delete S.pantry[el.dataset.id]; save(); closeSheet(); render(); },
  loAdd() { sheetLoAdd(); },
  loPick(el) {
    const r = RID[el.dataset.id]; SH.rid = r.id; SH.q = r.n; SH.c = r.course === 'drink' ? 'main' : r.course;
    const first = r.req.map((s) => s.ids[0]); SH.al = new Set(alOf(first)); SH.fl = new Set(flOf(first).filter((f) => f !== 'animal'));
    drawLoSheet();
  },
  loC(el) { SH.c = el.dataset.c; drawLoSheet(); },
  loP(el) { SH.portions = Math.max(1, SH.portions + +el.dataset.d); drawLoSheet(); },
  loAl(el) { const k = el.dataset.k; SH.al.has(k) ? SH.al.delete(k) : SH.al.add(k); drawLoSheet(); },
  loFl(el) { const k = el.dataset.k; SH.fl.has(k) ? SH.fl.delete(k) : SH.fl.add(k); drawLoSheet(); },
  loSave() {
    const name = SH.q.trim(); if (!name) { toast('Напиши, что осталось'); return; }
    S.leftovers.push({ id: uid(), name, rid: SH.rid, c: SH.c, portions: SH.portions, date: new Date().toISOString(), al: [...SH.al], fl: [...SH.fl] });
    save(); closeSheet(); toast('🍱 Добавлено в готовую еду'); render();
  },
  loStep(el) { const l = S.leftovers.find((x) => x.id === el.dataset.id); if (!l) return; l.portions += +el.dataset.d; if (l.portions <= 0) S.leftovers = S.leftovers.filter((x) => x !== l); save(); render(); },
  // генератор
  gMeal(el) { G.meal = el.dataset.k; G.title = ''; render(); },
  gEater(el) { const e = gEaters(), id = el.dataset.id; e.has(id) ? e.delete(id) : e.add(id); render(); },
  gCourse(el) { const c = el.dataset.c; G.courses.has(c) ? G.courses.delete(c) : G.courses.add(c); render(); },
  gTime(el) { G.time = +el.dataset.t === 90 ? 999 : +el.dataset.t; render(); },
  gCu(el) { const k = el.dataset.k; G.cuisines.has(k) ? G.cuisines.delete(k) : G.cuisines.add(k); render(); },
  gToggleProducts() { G.showProducts = !G.showProducts; render(); },
  gMark(el) { const id = el.dataset.id; G.mark[id] = !G.mark[id] ? 'must' : G.mark[id] === 'must' ? 'skip' : undefined; if (!G.mark[id]) delete G.mark[id]; render(); },
  gBuy(el) { G.buy = +el.dataset.v; render(); },
  gLo(el) { G.useLo = el.checked; },
  gRun() { if (!G.courses.size) { toast('Выбери хотя бы один раздел'); return; } genRun(); render(); setTimeout(() => { const r = document.querySelectorAll('.card')[1]; r && r.scrollIntoView({ behavior: 'smooth' }); }, 50); },
  gReplace(el) { genReplace(el.dataset.c, +el.dataset.i); render(); },
  gRemove(el) { G.result[el.dataset.c].splice(+el.dataset.i, 1); render(); },
  gAdd(el) {
    const c = el.dataset.c; const shown = new Set(G.result[c].map((x) => x.rid));
    const next = G.ranked[c].find((x) => !shown.has(x.rid)); if (next) { G.result[c].push(next); G.seen[c].add(next.rid); } render();
  },
  gTpl(el) { const old = defaultTitle(); G.tpl = el.dataset.k; if (!G.title || G.title === old) G.title = defaultTitle(); render(); },
  gMode(el) { G.mode = el.dataset.k; render(); },
  gPreview() { const m = genToMenu(); renderGuest(resolvePayload(menuToPayload(m)), true); },
  async gCreate() {
    const m = genToMenu(); S.menus.push(m); save();
    UI.tab = 'menus'; UI.menuId = m.id; G.result = null; G.title = ''; render(); window.scrollTo(0, 0);
    await A.shareMenu({ dataset: { id: m.id } });
  },
  recipe(el) { const c = el.dataset.c, i = el.dataset.i; const x = c != null && G.result && G.result[c] ? G.result[c][+i] : null; sheetRecipe(el.dataset.id, x); },
  recipeM(el) { const m = S.menus.find((x) => x.id === el.dataset.m); const it = m.items[+el.dataset.i]; sheetRecipe(it.rid, it); },
  fav(el) { const id = el.dataset.id; S.favs = S.favs.includes(id) ? S.favs.filter((x) => x !== id) : S.favs.concat(id); save(); toast(S.favs.includes(id) ? '★ Будет чаще попадаться в меню' : 'Убрано из избранного'); closeSheet(); render(); },
  // меню
  openMenu(el) { UI.menuId = el.dataset.id; render(); window.scrollTo(0, 0); },
  backMenus() { UI.menuId = null; render(); },
  async shareMenu(el) {
    const m = S.menus.find((x) => x.id === el.dataset.id); if (!m) return;
    const url = await menuLink(m);
    await shareText(m.title, `${m.host ? m.host + ' приглашает' : 'Приглашаю'}: «${m.title}» 🍽\nВыбери, что тебе приготовить 👇`, url);
  },
  async previewMenu(el) { const m = S.menus.find((x) => x.id === el.dataset.id); renderGuest(resolvePayload(menuToPayload(m)), true); },
  closePreview() { $('#preview').classList.remove('open'); $('#preview').innerHTML = ''; },
  async qr(el) {
    const m = S.menus.find((x) => x.id === el.dataset.id); const url = await menuLink(m);
    openSheet(`<h3>QR-код меню</h3><div id="qrBox" class="qrbox">Загружаю…</div><p class="muted small">Можно показать гостю с экрана или распечатать.</p><button class="btn primary wide" data-a="closeSheet">Закрыть</button>`);
    try {
      if (!window.QRCode) await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
      $('#qrBox').innerHTML = ''; new QRCode($('#qrBox'), { text: url, width: 260, height: 260, correctLevel: QRCode.CorrectLevel.L });
    } catch (e) { $('#qrBox').textContent = 'Не получилось построить QR-код (нужен интернет или ссылка слишком длинная).'; }
  },
  async statusCooking(el) {
    const m = S.menus.find((x) => x.id === el.dataset.id); const { cook } = tally(m);
    const t = Math.max(5, ...cook.map((i) => m.items[i]).filter((it) => it && !it.lo && it.c !== 'drink').map((it) => RID[it.rid].time));
    m.status = 'cooking'; save(); render();
    await shareText('Готовлю', `🔥 Готовлю «${m.title}»! Будет готово примерно к ${fmtTime(new Date(Date.now() + t * 60000))}`, '');
  },
  cooked(el) { sheetCooked(S.menus.find((x) => x.id === el.dataset.id)); },
  ckL(el) { const i = el.dataset.i; SH.left[i] = Math.max(0, SH.left[i] + +el.dataset.d); const m = S.menus.find((x) => x.id === SH.id); const { cook } = tally(m); drawCooked(m, cook.map((j) => [m.items[j], j]).filter(([it]) => it && !it.lo && it.c !== 'drink')); },
  ckDone() { applyCooked(); },
  missToShop(el) {
    const m = S.menus.find((x) => x.id === el.dataset.id); const { cook } = tally(m); let n = 0;
    cook.forEach((i) => (m.items[i].miss || []).forEach((pid) => { if (!S.shop.some((x) => x.pid === pid && !x.done)) { S.shop.push({ pid, from: itemName(m.items[i]) }); n++; } }));
    save(); toast(n ? `Добавлено в покупки: ${n}` : 'Уже в списке'); render();
  },
  delMenu(el) { if (!confirm('Удалить это меню?')) return; S.menus = S.menus.filter((x) => x.id !== el.dataset.id); UI.menuId = null; save(); render(); },
  pasteFocus() { $('#pasteBox').innerHTML = `<div class="row gap"><input class="input grow" id="pasteReply" placeholder="Вставь ответную ссылку"><button class="btn" data-a="pasteReply">Добавить</button></div>`; $('#pasteReply').focus(); },
  async pasteReply() { const v = ($('#pasteReply') || {}).value || ''; if (v) await importReply(v); },
  // покупки
  shopAdd(el) { S.shop.push({ pid: el.dataset.id }); UI.sq = ''; save(); render(); },
  shopAddFree() { const v = (UI.sq || '').trim(); if (!v) return; const exact = Object.keys(DB.products).find((id) => P(id).n.toLowerCase() === v.toLowerCase()); S.shop.push(exact ? { pid: exact } : { name: v }); UI.sq = ''; save(); render(); },
  shopDone(el) {
    const x = S.shop[+el.dataset.i]; if (!x) return;
    if (x.pid) { S.pantry[x.pid] = { q: 3 }; toast(`${P(x.pid).e} ${P(x.pid).n} — в холодильнике`); }
    S.shop.splice(+el.dataset.i, 1); save(); setTimeout(render, 250);
  },
  shopDel(el) { S.shop.splice(+el.dataset.i, 1); save(); render(); },
  // едоки
  personEdit(el) { sheetPerson(el.dataset.id); },
  pEmoji(el) { SH.emoji = el.dataset.e; drawPerson(); },
  pAl(el) { const k = el.dataset.k; SH.al.has(k) ? SH.al.delete(k) : SH.al.add(k); drawPerson(); },
  pPr(el) { const k = el.dataset.k; SH.pr.has(k) ? SH.pr.delete(k) : SH.pr.add(k); drawPerson(); },
  pSpice(el) { SH.spice = +el.dataset.v; drawPerson(); },
  pDisAdd(el) { SH.dis.add(el.dataset.id); SH.q = ''; drawPerson(); },
  pDisDel(el) { SH.dis.delete(el.dataset.id); drawPerson(); },
  pSave() {
    const name = SH.name.trim(); if (!name) { toast('Введи имя'); return; }
    const data = { name, emoji: SH.emoji, al: [...SH.al], pr: [...SH.pr], dis: [...SH.dis], spice: SH.spice };
    if (SH.id) Object.assign(S.people.find((p) => p.id === SH.id), data);
    else { const id = uid(); S.people.push({ id, ...data }); gEaters().add(id); }
    save(); closeSheet(); render();
  },
  pDel() { if (!confirm('Удалить едока?')) return; S.people = S.people.filter((p) => p.id !== SH.id); gEaters().delete(SH.id); save(); closeSheet(); render(); },
  equip(el) { const k = el.dataset.k; S.settings.equip[k] = !S.settings.equip[k]; save(); render(); },
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'домашнее-меню-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  resetData() { if (!confirm('Удалить все данные: холодильник, едоков, меню? Это нельзя отменить.')) return; S = defaultState(); G.eaters = null; save(); render(); },
  // гость
  gsAl(el) { const k = el.dataset.k; GS.al.has(k) ? GS.al.delete(k) : GS.al.add(k); drawGuest(); },
  gsPick(el) { const c = el.dataset.c, i = +el.dataset.i; GS.sel[c] = GS.sel[c] === i ? undefined : i; if (GS.sel[c] === undefined) delete GS.sel[c]; drawGuest(); },
  gsSend() { if (!GS.preview) guestSend(); },
};

// ——— события ———
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (el && A[el.dataset.a]) {
    if (el.tagName === 'INPUT' && el.type === 'checkbox') { A[el.dataset.a](el, e); return; }
    e.preventDefault(); A[el.dataset.a](el, e); return;
  }
  if (e.target.id === 'sheet') { closeSheet(); render(); }
});
document.addEventListener('toggle', (e) => {
  const d = e.target; if (d.tagName !== 'DETAILS' || !d.dataset.cat) return;
  d.open ? UI.openCats.add(d.dataset.cat) : UI.openCats.delete(d.dataset.cat);
}, true);
document.addEventListener('input', (e) => {
  const el = e.target, k = el.dataset && el.dataset.in; if (!k) return;
  const v = el.value;
  if (k === 'fsearch') { UI.fq = v; $('#fresults').innerHTML = fSearchResults(); }
  else if (k === 'loq') {
    SH.q = v; SH.rid = null; const q = v.trim().toLowerCase();
    const res = q ? DB.recipes.filter((r) => r.course !== 'drink' && r.n.toLowerCase().includes(q)).slice(0, 6) : [];
    $('#loRes').innerHTML = res.map((r) => `<button class="pick" data-a="loPick" data-id="${r.id}">${DB.courses[r.course].e} ${esc(r.n)}</button>`).join('');
  }
  else if (k === 'pName') SH.name = v;
  else if (k === 'pq') {
    SH.q = v; const q = v.trim().toLowerCase();
    const res = q ? Object.keys(DB.products).filter((id) => P(id).n.toLowerCase().includes(q) && !SH.dis.has(id)).slice(0, 10) : [];
    $('#pRes').innerHTML = res.map((id) => `<button class="chip" data-a="pDisAdd" data-id="${id}">${P(id).e} ${esc(P(id).n)}</button>`).join('');
  }
  else if (k === 'gTitle') G.title = v;
  else if (k === 'gDeadline') G.deadline = v;
  else if (k === 'gNote') G.note = v;
  else if (k === 'host') { S.settings.host = v; save(); }
  else if (k === 'sq') {
    UI.sq = v; const q = v.trim().toLowerCase();
    const sugg = q ? Object.keys(DB.products).filter((id) => P(id).n.toLowerCase().includes(q)).slice(0, 8) : [];
    $('#shopSugg').innerHTML = sugg.map((id) => `<button class="chip" data-a="shopAdd" data-id="${id}">${P(id).e} ${esc(P(id).n)}</button>`).join('');
  }
  else if (k === 'gsName') GS.name = v;
  else if (k === 'gsComment') GS.comment = v;
});
document.addEventListener('change', (e) => {
  const el = e.target; if (!(el.dataset && el.dataset.in === 'importData') || !el.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => {
    try { const d = JSON.parse(fr.result); if (!d.pantry || !d.menus) throw 0; if (!confirm('Заменить текущие данные копией?')) return; S = d; G.eaters = null; save(); toast('Данные восстановлены'); render(); }
    catch (er) { toast('Это не файл копии «Домашнего меню»'); }
  };
  fr.readAsText(el.files[0]);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.in === 'sq') A.shopAddFree();
  if (e.key === 'Escape' && $('#sheet').classList.contains('open')) { closeSheet(); render(); }
});

// ——— запуск ———
async function boot() {
  const h = location.hash;
  if (h.startsWith('#m=')) {
    document.body.classList.add('guest');
    try { renderGuest(resolvePayload(await unpack(h.slice(3))), false); }
    catch (e) { $('#app').innerHTML = '<div class="empty"><div class="big">😿</div><p>Ссылка на меню повреждена. Попроси прислать её ещё раз.</p></div>'; }
    return;
  }
  render();
  if (h.startsWith('#r=')) { await importReply(h); history.replaceState(null, '', baseUrl()); }
}
window.addEventListener('hashchange', () => location.reload());
boot();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
