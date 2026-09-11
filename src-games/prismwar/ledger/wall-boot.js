/**
 * wall-boot.js — the Prismwar Ledger Wall. Bundled by the arcade build
 * (esbuild → wall.bundle.js); never shipped raw because of the bare import.
 *
 * WHAT THIS IS. A shared list of ledger cards kept in a playhtml room. playhtml
 * state is an unauthenticated CRDT: anyone can open devtools and rewrite it.
 * The page says so out loud. It is a social wall, not a leaderboard.
 *
 * HOW A CARD ARRIVES. The game links here with `#post=<base64url ledger text>`.
 * The hash never reaches a server. We decode it, validate its SHAPE (it must
 * look like the five-line card the game prints), render a preview, and only a
 * click on "Post to the wall" writes it into the shared list. Nothing is posted
 * by merely following the link.
 *
 * SAFETY. Every string off the network or out of the hash is set with
 * textContent, never innerHTML. Posts are clamped in count and length. The
 * element id `prismwar-wall` IS the sync key — renaming it orphans the wall.
 */
import { playhtml } from 'playhtml';

if (location.hostname === 'dhsea-arcade.pages.dev') {
  location.replace('https://play.dhseadev.online' + location.pathname + location.search + location.hash);
}

const MAX_POSTS = 150, MAX_LEN = 1200, MAX_LINES = 7, COOLDOWN_MS = 60_000;
const LEDGER_PAGE = 'https://dhseadev.online/prismwar-ledger/';
const $ = s => document.querySelector(s);

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function b64urlDecode(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  try { const bin = atob(s); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); } catch { return ''; }
}

/** Parse the game's ledger text into fields. Returns null when the shape is wrong. */
export function parseCard(text) {
  if (typeof text !== 'string' || text.length > MAX_LEN) return null;
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 4 || lines.length > MAX_LINES) return null;
  const head = /^PRISMWAR LEDGER · (.{1,24}) · (\d{4}-\d{2}-\d{2})$/.exec(lines[0]); if (!head) return null;
  const col = /^Collection (\d+)\/(\d+) \((\d+)%\) · Packs opened (\d+) · Dust (\d+)$/.exec(lines[1]); if (!col) return null;
  const rec = /^Record (\d+)W-(\d+)L · Achievements (\d+)\/(\d+) · Ascendants (\d+)\/(\d+)$/.exec(lines[2]); if (!rec) return null;
  const dk = /^Decks: (.*)$/.exec(lines[3]); if (!dk) return null;
  const sigLine = lines.find(l => /^Sig PWL1-/.test(l)); if (!sigLine) return null;
  const sig = sigLine.slice(4); if (!/^PWL1-X?[0-9a-z]{7}$/.test(sig)) return null;
  const modified = lines.includes('Save was modified outside the game') || sig.startsWith('PWL1-X');
  const decks = dk[1] === '—' ? [] : dk[1].split(', ').slice(0, 12).map(s => { if (/^\+\d{1,3} more$/.test(s)) return { name: s, colors: [] }; const m = /^(.{1,40}) \(([WUBRGP/]{1,11})\)$/.exec(s); return m ? { name: m[1], colors: m[2].split('/') } : { name: s.slice(0, 40), colors: [] }; });
  return { name: head[1], date: head[2], owned: +col[1], total: +col[2], pct: +col[3], packs: +col[4], dust: +col[5], wins: +rec[1], losses: +rec[2], ach: +rec[3], achTotal: +rec[4], asc: +rec[5], ascTotal: +rec[6], decks, sig, modified, text };
}

function renderCard(p) {
  const main = p.decks[0] && p.decks[0].colors[0] || 'P';
  const c = el('article', 'lc ' + (/^[WUBRGP]$/.test(main) ? main : 'P'));
  c.setAttribute('aria-label', `Ledger card of ${p.name}`);
  const stripes = el('div', 'stripes'); for (const k of ['W', 'U', 'B', 'R', 'G', 'P']) { const i = el('i'); i.style.background = `var(--${k})`; stripes.append(i); }
  c.append(stripes, el('div', 'title', 'Prismwar Ledger'));
  const who = el('div', 'who'); who.append(el('b', '', p.name), el('span', '', p.date)); c.append(who);
  const s1 = el('div', 'stat'); s1.append(el('span', '', `Collection ${p.owned}/${p.total} (${p.pct}%)`), el('span', '', `Packs ${p.packs}`), el('span', '', `Dust ${p.dust}`));
  const s2 = el('div', 'stat'); s2.append(el('span', '', `Record ${p.wins}W-${p.losses}L`), el('span', '', `Achievements ${p.ach}/${p.achTotal}`), el('span', '', `Ascendants ${p.asc}/${p.ascTotal}`));
  c.append(s1, s2);
  const d = el('div', 'decks', p.decks.length ? 'Decks ' : 'No decks listed'); for (const k of p.decks) d.append(el('span', '', `${k.name}${k.colors.length ? ' · ' + k.colors.join('/') : ''}`)); c.append(d);
  c.append(el('div', 'sig' + (p.modified ? ' bad' : ''), 'Sig ' + p.sig));
  if (p.modified) c.append(el('span', 'flag', 'modified save'));
  return c;
}

function toast(msg, link) {
  const t = $('#toast'); t.replaceChildren(el('span', '', msg));
  if (link) { const a = el('a', '', link.text); a.href = link.href; a.target = '_blank'; a.rel = 'noopener'; t.append(a); }
  t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, link ? 12000 : 5000);
}
function lastPost() { try { return Number(localStorage.getItem('prismwar:wall:last')) || 0; } catch { return 0; } }
function markPost() { try { localStorage.setItem('prismwar:wall:last', String(Date.now())); } catch { /* private mode */ } }

let pending = null;
let wallSetData = null;   // set by onMount; null until playhtml has synced the room
const postBtn = $('#post');
function setPostReady(ready) { postBtn.disabled = !ready; postBtn.textContent = ready ? 'Post to the wall' : 'Connecting to the wall…'; }
setPostReady(false);
{
  const m = /[#&]post=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (m) {
    pending = parseCard(b64urlDecode(m[1]));
    if (pending) { $('#preview').replaceChildren(renderCard(pending)); $('#compose').hidden = false; $('#post').focus(); }
    else toast('That link did not carry a valid ledger card. Open the game\'s Ledger tab and use "Post to the Ledger wall".');
  }
  $('#discard').addEventListener('click', () => { pending = null; $('#compose').hidden = true; history.replaceState(null, '', location.pathname); });
}

setTimeout(() => { if (/Connecting/.test($('#status').textContent)) $('#status').textContent = 'Still connecting — the wall syncs through api.playhtml.fun. If your network blocks it, posting will not work here; the PNG card from the game still shares fine.'; }, 8000);

playhtml.init({
  room: 'prismwar-ledger',
  extraCapabilities: {
    'can-wall': {
      defaultData: { posts: [] },
      updateElement: ({ data, element }) => {
        const posts = Array.isArray(data && data.posts) ? data.posts.slice(0, MAX_POSTS) : [];
        const cards = posts.map(p => parseCard(p && p.t)).filter(Boolean);
        element.replaceChildren(...(cards.length ? cards.map(renderCard) : [el('div', 'empty', 'No cards yet. Be the first: open Prismwar, go to the Ledger tab, and post yours.')]));
        $('#count').textContent = cards.length === 1 ? '1 card' : cards.length + ' cards';
        $('#status').textContent = 'Connected. Cards appear here as players post them; the newest sit first.';
      },
      onMount: ({ getElement, setData }) => {   // onMount, not additionalSetup; getElement(), not element
        getElement();
        wallSetData = setData;   // a re-mount after a playhtml room reset replaces it; the click listener is attached once, below
        setPostReady(true);
      },
    },
  },
});

postBtn.addEventListener('click', () => {
  if (!pending || !wallSetData || postBtn.disabled) return;   // busy / not-yet-synced guard
  const wait = COOLDOWN_MS - (Date.now() - lastPost());
  if (wait > 0) { toast(`Easy — one card a minute. Try again in ${Math.ceil(wait / 1000)}s.`); return; }
  const card = pending; postBtn.disabled = true;
  try {
    wallSetData(d => {
      if (!Array.isArray(d.posts)) d.posts = [];
      // Same player + same Sig means the same save state: replace, don't stack.
      const dup = d.posts.findIndex(p => p && typeof p.t === 'string' && p.t.includes('Sig ' + card.sig) && p.t.startsWith('PRISMWAR LEDGER · ' + card.name + ' ·'));
      if (dup >= 0) d.posts.splice(dup, 1);
      d.posts.unshift({ t: card.text.slice(0, MAX_LEN), at: Date.now() });
      // splice, never pop(): the synced array proxy throws on pop() (it assigns .length), which froze the wall at MAX_POSTS.
      if (d.posts.length > MAX_POSTS) d.posts.splice(MAX_POSTS, d.posts.length - MAX_POSTS);
    });
  } catch (err) {
    postBtn.disabled = false;
    toast('The wall did not accept that post — try again in a moment.');
    console.error('[prismwar wall] post failed', err);
    return;
  }
  pending = null; markPost(); $('#compose').hidden = true; postBtn.disabled = false;
  history.replaceState(null, '', location.pathname);
  toast('Posted to the wall.', { href: LEDGER_PAGE, text: 'Read about the Ledger on dhseadev.online ↗' });
  document.getElementById('prismwar-wall').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
