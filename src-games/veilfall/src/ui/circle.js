/**
 * The Circle — the persistent seating view.
 *
 * A ring, not a list. Four of the thirteen Warden callings read ADJACENCY, and
 * one reads *living* adjacency specifically, so a linear list hides the exact
 * information the game runs on. The ring also has to survive 380px, so it ships
 * with a list fallback and a size control rather than one fixed geometry.
 *
 * Alignment is never encoded by colour alone — every state carries a glyph.
 */

import { el, clear } from './dom.js';

export const GLYPH = {
  lantern: '◆',
  gloaming: '▼',
  unsure: '●',
  note: '✎',
  dead: '☠',
  marked: '◈',
  spent: '·',
};

const ALIGN_CLASS = { lantern: 'g-lantern', gloaming: 'g-gloaming', unsure: 'g-unsure' };

/**
 * @param {object} o
 * @param {object[]} o.seats
 * @param {number} o.humanSeat
 * @param {Record<number,object>} o.notes
 * @param {number|null} o.marked
 * @param {number[]} o.selected
 * @param {number[]} o.selectable   - empty = nothing is pickable right now
 * @param {'ring'|'list'} o.layout
 * @param {number} o.size           - 0.8 .. 1.3
 * @param {(seat:number)=>void} o.onPick
 * @param {(seat:number)=>void} o.onOpen
 * @param {string} [o.hubTop]
 * @param {string} [o.hubLabel]
 */
export function renderCircle(o) {
  const {
    seats, humanSeat, notes = {}, marked = null, selected = [], selectable = [],
    layout = 'ring', size = 1, onPick, onOpen, hubTop, hubLabel,
  } = o;

  const wrap = el('div', { class: layout === 'ring' ? 'circlewrap' : 'circlewrap compact' });
  const pickable = new Set(selectable);

  const seatNode = (s, i) => {
    const note = notes[s.seat] || {};
    const isSel = selected.includes(s.seat);
    const canPick = pickable.has(s.seat);
    const cls = [
      'seat',
      s.seat === humanSeat && 'me',
      !s.alive && 'dead',
      marked === s.seat && 'marked',
      isSel && 'selected',
    ].filter(Boolean).join(' ');

    const glyphs = [];
    if (!s.alive) glyphs.push(el('span', { class: 'g-unsure', text: GLYPH.dead, title: 'An Echo' }));
    if (!s.alive && s.finalWordSpent) glyphs.push(el('span', { class: 'g-unsure', text: GLYPH.spent, title: 'Final Word spent' }));
    if (note.alignment) {
      glyphs.push(el('span', {
        class: ALIGN_CLASS[note.alignment] || 'g-unsure',
        text: GLYPH[note.alignment] || GLYPH.unsure,
        title: `You marked them ${note.alignment}`,
      }));
    }
    if (note.text) glyphs.push(el('span', { class: 'g-note', text: GLYPH.note, title: 'You have a note' }));
    if (marked === s.seat) glyphs.push(el('span', { class: 'g-gloaming', text: GLYPH.marked, title: 'Marked for Sealing' }));

    const initial = (s.name || '?').trim()[0]?.toUpperCase() ?? '?';
    const token = el('div', { class: 'token' }, [
      initial,
      note.roleGuess ? el('span', { class: 'badge', text: '?', title: `You suspect: ${note.roleGuessLabel || note.roleGuess}` }) : null,
    ]);

    const label = [
      s.name,
      s.seat === humanSeat ? '(you)' : '',
      s.alive ? 'alive' : 'an Echo',
      note.alignment ? `marked ${note.alignment}` : '',
      canPick ? 'selectable' : '',
    ].filter(Boolean).join(', ');

    const node = el('button', {
      class: cls, type: 'button',
      'aria-label': label,
      'aria-pressed': isSel ? 'true' : 'false',
      onclick: (ev) => {
        ev.preventDefault();
        if (canPick && onPick) onPick(s.seat);
        else if (onOpen) onOpen(s.seat);
      },
      oncontextmenu: (ev) => { ev.preventDefault(); onOpen?.(s.seat); },
    }, [token, el('div', { class: 'nm', text: s.name }), el('div', { class: 'glyphs' }, glyphs)]);

    if (layout === 'ring') {
      const n = seats.length;
      const a = (-90 + (360 / n) * i) * (Math.PI / 180);
      const rx = 37 * size, ry = 37 * size;
      node.style.left = `${50 + rx * Math.cos(a)}%`;
      node.style.top = `${50 + ry * Math.sin(a)}%`;
    }
    return node;
  };

  if (layout === 'ring') {
    wrap.append(el('div', { class: 'ringline' }));
    wrap.append(el('div', { class: 'hub' }, [
      el('div', { class: 'n', text: hubTop ?? String(seats.filter((s) => s.alive).length) }),
      el('div', { class: 'l', text: hubLabel ?? 'souls remain' }),
    ]));
    seats.forEach((s, i) => wrap.append(seatNode(s, i)));
  } else {
    const list = el('div', { class: 'seatlist' });
    seats.forEach((s, i) => list.append(seatNode(s, i)));
    wrap.append(list);
  }
  return wrap;
}

/** Live vote meter: threshold marker, running fill, per-soul chips. */
export function renderTally({ tally, threshold, living, votes = [], seats }) {
  const pct = Math.min(100, (tally / Math.max(1, living)) * 100);
  const threshPct = Math.min(100, (threshold / Math.max(1, living)) * 100);

  const bar = el('div', { class: 'tallybar' }, [
    el('div', { class: 'tallyfill', style: { width: `${pct}%` } }),
    el('div', { class: 'threshmark', style: { left: `${threshPct}%` } }),
  ]);

  const chips = el('div', { class: 'votegrid' },
    votes.map((v) => el('div', {
      class: `votechip ${v.blocked ? 'blocked' : v.vote ? 'yes' : 'no'}`,
      title: v.blocked ? `Bound — could not raise a hand` : v.vote ? 'Hand raised' : 'Abstained',
    }, [
      el('span', { text: v.blocked ? '⛓' : v.vote ? '✋' : '·' }),
      seats[v.seat]?.name ?? `#${v.seat}`,
    ])));

  return el('div', {}, [
    el('div', { class: 'kv' }, [
      el('span', { class: 'k', text: 'Hands raised' }),
      el('span', { class: 'v', text: `${tally} of ${threshold} needed · ${living} living` }),
    ]),
    bar,
    chips,
  ]);
}

export { clear };
