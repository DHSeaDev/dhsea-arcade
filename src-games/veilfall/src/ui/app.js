/**
 * VEILFALL — side panel application.
 *
 * Renders exactly one BEAT at a time. The Controller owns all state; this file
 * owns none. Every handler that advances the game is re-entrancy guarded,
 * because the panel can be clicked faster than a beat resolves.
 */

import { el, mount, clear, guarded, announce, stream, sleep, reducedMotion } from './dom.js';
import { renderCircle, renderTally, GLYPH } from './circle.js';
import {
  openSheet, closeSheet, seatSheet, codexSheet, settingsSheet,
  transparencySheet, DIFFICULTY_PRESETS,
} from './sheets.js';
import { Controller, BEAT } from '../controller.js';
import { store } from '../storage.js';
import { ROLES, label } from '../engine/roles.js';
import { makeSigil } from './sigil.js';
import { LlmVoices, DEFAULT_MODEL } from '../ai/llm.js';
import { suggestion, nudge, pendingTutorial, TUTORIAL_STEPS } from './guide.js';
import * as Speech from './speech.js';

const $main = () => document.getElementById('main');
const $footer = () => document.getElementById('footer');

let ctrl = null;
let settings = {};
let selected = [];
let streamer = null;
let nudgeShown = null;

// ═════════════════════════════════════════════════════════════════ BOOT

/** Tier 2 is built only when a key exists. No key, no network, full game. */
let llm = null;
function makeLlm() {
  if (!settings.groqKey) { llm = null; return null; }
  llm = new LlmVoices({
    apiKey: settings.groqKey,
    model: settings.model || DEFAULT_MODEL,
    onError: (m) => {
      console.warn('[veilfall] voices unavailable, falling back:', m);
      announce('The voices have gone quiet. The game continues in its own voice.');
    },
  });
  return llm;
}

/**
 * Everything the settings sheet needs to show and change voice state.
 *
 * `onActivate` is what fixes the original defect: it builds the client, proves
 * it with a real call, and — critically — binds it onto the game that is ALREADY
 * RUNNING. Storing the key was never the missing piece; wiring it was.
 */
function voiceOpts() {
  return {
    speechStatus: Speech.status(),
    onReadAloud: (mode) => { if (mode === 'off') Speech.stop(); },
    usage: llm?.usage(),
    voicesActive: !!ctrl?.voicesActive,
    onActivate: async ({ key, model }) => {
      settings.groqKey = key;
      settings.model = model || settings.model;
      if (!key) { llm = null; ctrl?.setVoices(null); return { ok: true, model: '—', ms: 0 }; }
      makeLlm();
      const res = await llm.test();
      // Attach on success only. A refused key must not sit on a live table
      // burning a request per line just to fail.
      ctrl?.setVoices(res.ok ? llm : null);
      if (!res.ok) llm = null;
      return res;
    },
  };
}

async function boot() {
  settings = await store.loadSettings();
  if (settings.reduceMotion) document.documentElement.dataset.motion = 'off';
  // Voices load asynchronously and the first getVoices() returns []. Warming
  // them here means Settings can report honestly what this machine actually has.
  Speech.loadVoices().catch(() => {});

  ctrl = await Controller.resume({ settings, llm: makeLlm() });
  if (ctrl) {
    // A finished game resumes into its own summary rather than a dead board.
    render();
  } else if (!settings.introSeen) {
    renderIntro();
  } else {
    renderLobby();
  }
  document.addEventListener('veilfall:rerender', () => render());
  document.addEventListener('keydown', hotkeys);
}

function hotkeys(e) {
  if (e.target.matches('input,textarea,select')) return;
  if (e.key === 'c' || e.key === 'C') { openSheet(codexSheet(ctrl?.myRole()?.id)); }
  if (e.key === 'Enter' && !document.getElementById('sheet').hasAttribute('open')) {
    const primary = $main().querySelector('.btn.primary') || $footer().querySelector('.btn.primary');
    primary?.click();
  }
  if (e.key === ' ' && streamer) { e.preventDefault(); streamer.skip(); }
}

// ═════════════════════════════════════════════════════════════════ CHROME

function setHeader() {
  const pill = document.getElementById('phasepill');
  const note = document.getElementById('phasenote');
  const count = document.getElementById('alivecount');
  const seed = document.getElementById('seedtag');

  if (!ctrl) {
    pill.className = 'pill'; pill.textContent = '—';
    note.textContent = ''; count.textContent = ''; seed.textContent = '';
    return;
  }
  const p = ctrl.game.state.phase;
  const kind = p.kind === 'night' ? 'night' : p.kind === 'day' ? 'day' : '';
  pill.className = `pill ${kind}`;
  pill.textContent = p.kind === 'night' ? `Vespers ${p.number}`
    : p.kind === 'day' ? `Reading ${p.number}`
    : p.kind === 'ended' ? 'Ended' : 'The Gate';
  const me = ctrl.me;
  note.textContent = me.alive ? '' : `${GLYPH.dead} an Echo`;
  count.textContent = `${ctrl.game.living} of ${ctrl.seats.length}`;
  seed.textContent = ctrl.game.state.seed;
}

function toolbar(extra = []) {
  const tools = el('div', { class: 'toolbar' }, [
    el('button', {
      class: 'tool', type: 'button', onclick: () => openSheet(codexSheet(ctrl?.myRole()?.id)),
      title: 'Codex (C)',
    }, [el('span', { class: 'ic', text: '📖' }), 'Codex']),
    el('button', {
      class: 'tool', type: 'button', title: 'Your calling',
      onclick: () => ctrl && openSheet(myRoleSheet()),
    }, [el('span', { class: 'ic', text: '◆' }), 'You']),
    el('button', {
      class: 'tool', type: 'button', onclick: () => openSheet(settingsSheet(settings, (s) => store.saveSettings(s), voiceOpts())),
    }, [el('span', { class: 'ic', text: '⚙' }), 'Settings']),
    el('button', {
      class: 'tool', type: 'button', onclick: newGamePrompt,
    }, [el('span', { class: 'ic', text: '✦' }), 'New']),
  ]);
  return mount($footer(), ...extra, tools);
}

function myRoleSheet() {
  return (close) => {
    const r = ctrl.myRole();
    return el('div', {}, [
      el('div', { class: 'sheethead' }, [
        el('h3', { id: 'sheettitle', text: 'Your calling', style: { flex: '1' } }),
        el('button', { class: 'closex', type: 'button', text: '✕', onclick: close, 'aria-label': 'Close' }),
      ]),
      roleCard(r),
      el('div', { style: { height: '10px' } }),
      el('button', { class: 'btn ghost', type: 'button', text: 'Open the Codex', onclick: () => { close(); openSheet(codexSheet(r.id)); } }),
    ]);
  };
}

function roleCard(r) {
  return el('div', { class: 'rolecard' }, [
    makeSigil(r.id),
    el('div', { class: 'rname', text: r.name }),
    el('div', { class: 'rteam', text: r.team === 'lantern' ? `${GLYPH.lantern} Lantern` : `${GLYPH.gloaming} Gloaming` }),
    el('div', { class: 'rability', text: r.ability }),
    r.flavour ? el('div', { class: 'rflavour', text: r.flavour }) : null,
  ]);
}

// ═════════════════════════════════════════════════════════════════ INTRO

/**
 * Shown once, on the very first launch.
 *
 * Deliberately short and deliberately NOT a rules screen. The evidence says
 * upfront manuals lose to instruction at the moment of need, so this sets the
 * fiction and the shape of a turn, and leaves every actual rule to the
 * contextual steps that fire when that rule first matters.
 */
function renderIntro() {
  setHeader();
  const begin = el('button', { class: 'btn primary', type: 'button', text: 'Step through the Gate' });
  begin.onclick = guarded(begin, async () => {
    settings.introSeen = true;
    await store.saveSettings(settings);
    renderLobby();
  });

  mount($main(),
    el('section', { class: 'intro' }, [
      makeSigil('hollowOne', 96),
      el('h2', { text: 'Veilfall' }),
      el('p', { class: 'lede', text: 'Nine souls were called through the Vellum Gate to hold the ward at Threshold Academy. Nine answered. One of them came through wrong.' }),
      el('p', { class: 'sub', text: 'It is wearing a name it does not remember taking, and it will empty this hall one night at a time. You are one of the nine. Find it first.' }),
    ]),
    el('section', {}, [
      el('h2', { text: 'How a day goes' }),
      el('div', { class: 'beats' }, [
        el('div', { class: 'beat' }, [el('span', { class: 'n', text: '1' }),
          el('span', { class: 't' }, [el('b', { text: 'Vespers.' }), ' Everyone sleeps. Callings act in a fixed order. The Hollow takes someone.'])]),
        el('div', { class: 'beat' }, [el('span', { class: 'n', text: '2' }),
          el('span', { class: 't' }, [el('b', { text: 'The Reading.' }), ' The living talk. You can whisper privately, speak to the room, and write in your notebook.'])]),
        el('div', { class: 'beat' }, [el('span', { class: 'n', text: '3' }),
          el('span', { class: 't' }, [el('b', { text: 'The Naming and the Tally.' }), ' Someone is accused, hands go up, and at most one soul is Sealed.'])]),
      ]),
      el('p', { class: 'faint', text: 'You will only ever see your own calling. Everyone else has one too, and none of you can see each other\u2019s. The rest of the rules arrive as you meet them — nothing here needs memorising first.' }),
    ]),
    el('section', {}, [
      el('div', { class: 'card' }, [
        el('p', { class: 'faint', style: { margin: '0' }, text: 'Plays completely offline. No account, no key, nothing leaves your machine unless you choose to add a Groq key in Settings for improvised dialogue.' }),
      ]),
    ]),
  );
  mount($footer(), begin, el('div', { class: 'toolbar' }, [
    el('button', {
      class: 'tool', type: 'button', onclick: () => openSheet(codexSheet()),
    }, [el('span', { class: 'ic', text: '📖' }), 'The callings']),
    el('button', {
      class: 'tool', type: 'button',
      onclick: () => openSheet(settingsSheet(settings, (x) => store.saveSettings(x), voiceOpts())),
    }, [el('span', { class: 'ic', text: '⚙' }), 'Settings']),
  ]));
}

// ═════════════════════════════════════════════════════════════════ LOBBY

function renderLobby() {
  setHeader();
  const nSel = el('select', { 'aria-label': 'Number of souls' },
    [7, 8, 9, 10, 11, 12].map((n) => el('option', { value: String(n), text: `${n} souls`, selected: n === 9 })));
  const dSel = el('select', { 'aria-label': 'Difficulty' }, [
    el('option', { value: 'novice', text: 'Novice — your allies read well' }),
    el('option', { value: 'adept', text: 'Adept — an even table', selected: true }),
    el('option', { value: 'veteran', text: 'Veteran — you are mostly on your own' }),
  ]);
  const nameIn = el('input', { type: 'text', value: settings.playerName || 'You', maxlength: '18', 'aria-label': 'Your name' });
  const seedIn = el('input', { type: 'text', placeholder: 'leave blank for a new fate', 'aria-label': 'Seed' });

  const start = el('button', { class: 'btn primary', type: 'button', text: 'Step through the Gate' });
  start.onclick = guarded(start, async () => {
    const seed = seedIn.value.trim() || `VEIL-${Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}-${Date.now().toString(16).slice(-4).toUpperCase()}`;
    settings.playerName = nameIn.value.trim() || 'You';
    await store.saveSettings(settings);
    ctrl = await Controller.create({
      playerCount: Number(nSel.value),
      seed,
      playerName: settings.playerName,
      difficulty: DIFFICULTY_PRESETS[dSel.value],
      settings,
      llm: makeLlm(),
    });
    selected = [];
    render();
  });

  const saved = el('div');
  store.loadGame().then((snap) => {
    if (!snap?.game || snap.game.phase?.kind === 'ended') return;
    const resume = el('button', { class: 'btn', type: 'button', text: '↩ Return to your game' });
    resume.onclick = guarded(resume, async () => {
      ctrl = await Controller.resume({ settings, llm: makeLlm() });
      if (ctrl) render(); else announce('That game could not be reopened.');
    });
    mount(saved, resume, el('div', { style: { height: '8px' } }));
  });

  mount($main(),
    el('section', {}, [
      el('div', { class: 'card arcane' }, [
        el('h3', { text: 'The Vellum Gate' }),
        el('p', { class: 'narration', text: 'Nine of you were called to hold the ward at Threshold Academy. Nine of you answered. One of you came through wrong, and it is wearing a name it does not remember taking.' }),
        el('p', { class: 'faint', text: 'Find it before it empties the hall. You have your calling, your notebook, and whatever the others are willing to tell you — which is not the same as the truth.' }),
      ]),
    ]),
    saved,
    el('section', {}, [
      el('div', { class: 'field' }, [el('label', { text: 'Your name' }), nameIn]),
      el('div', { class: 'field' }, [el('label', { text: 'The table' }), nSel]),
      el('div', { class: 'field' }, [el('label', { text: 'Difficulty' }), dSel]),
      el('div', { class: 'field' }, [el('label', { text: 'Seed (optional — same seed, same fate)' }), seedIn]),
      start,
    ]),
  );
  toolbar();
}

async function newGamePrompt() {
  if (ctrl && !ctrl.ended) {
    openSheet((close) => el('div', {}, [
      el('h3', { id: 'sheettitle', text: 'Abandon this game?' }),
      el('p', { class: 'faint', text: 'The Reading in progress will be lost. There is no going back to it.' }),
      el('div', { class: 'btnrow' }, [
        el('button', { class: 'btn ghost', type: 'button', text: 'Keep playing', onclick: close }),
        el('button', {
          class: 'btn danger', type: 'button', text: 'Abandon',
          onclick: async () => { await store.clearGame(); ctrl = null; nudgeShown = null; close(); renderLobby(); },
        }),
      ]),
    ]));
  } else {
    await store.clearGame(); ctrl = null; renderLobby();
  }
}

// ═════════════════════════════════════════════════════════════════ SPEECH

/**
 * Read-aloud is strictly presentational: it speaks text the game has ALREADY
 * decided to show. It never gates a beat, never delays a transition, and any
 * failure is silence rather than a stall.
 */
function speakNarration(text) {
  if (!text || settings.readAloud === 'off' || !settings.readAloud) return;
  Speech.say(text, Speech.narratorProfile());
}

function speakLine(line) {
  if (settings.readAloud !== 'all' || !line?.text) return;
  const persona = ctrl?.table?.agent?.(line.seat)?.persona;
  const seat = ctrl.seats[line.seat];
  Speech.say(line.text, Speech.profileFor(seat, persona), { prefix: seat.name });
}

// ═════════════════════════════════════════════════════════════════ RENDER

function circle(opts = {}) {
  return renderCircle({
    seats: ctrl.seats,
    humanSeat: ctrl.game.state.humanSeat,
    notes: ctrl.notes,
    marked: ctrl.game.state.day?.marked ?? null,
    selected,
    layout: settings.seatLayout === 'list' ? 'list' : 'ring',
    size: settings.seatSize ?? 1,
    onOpen: (s) => openSheet(seatSheet(ctrl, s, () => render(), (seat, text) => {
      // A whisper is dialogue too; silence here is jarring once the room talks.
      if (settings.readAloud === 'all') speakLine({ seat, text });
    })),
    ...opts,
  });
}

function advanceBtn(text, input, cls = 'primary') {
  const b = el('button', { class: `btn ${cls}`, type: 'button', text });
  b.onclick = guarded(b, async () => {
    Speech.stop();       // never let the previous beat talk over the next one
    await ctrl.advance(input);
    selected = [];
    nudgeShown = null;   // a nudge is about the moment, not the game
    render();
  });
  return b;
}

function render() {
  if (!ctrl) return settings.introSeen ? renderLobby() : renderIntro();
  setHeader();
  streamer = null;
  const b = ctrl.beat;
  const painted = paint(b);
  injectGuidance(b);
  return painted;
}

/**
 * The guidance layer, prepended to whatever screen just mounted.
 *
 * Order is deliberate: an unseen tutorial step first (it teaches the mechanic
 * that is on screen right now), then the procedural suggestion, then the pull
 * for a strategic nudge. Nothing here blocks the action behind it.
 */
function injectGuidance(b) {
  if (!ctrl) return;
  const host = $main();
  const stack = [];

  const pending = pendingTutorial(b, ctrl, settings.tutorialSeen || []);
  if (pending.length) {
    const step = pending[0];
    const idx = (settings.tutorialSeen || []).length + 1;
    const got = el('button', { class: 'btn sm primary', type: 'button', text: 'Got it' });
    got.onclick = guarded(got, async () => {
      settings.tutorialSeen = [...(settings.tutorialSeen || []), step.id];
      await store.saveSettings(settings);
      render();
    });
    const skip = el('button', {
      class: 'btn sm ghost', type: 'button', text: 'Skip all',
      onclick: async () => {
        settings.tutorialSeen = TUTORIAL_STEPS.map((x) => x.id);
        await store.saveSettings(settings);
        render();
      },
    });
    stack.push(el('div', { class: 'tut', role: 'note' }, [
      el('h4', { text: step.title }),
      el('p', { text: step.body }),
      el('div', { class: 'row' }, [got, skip, el('span', { class: 'step', text: `${idx} of ${TUTORIAL_STEPS.length}` })]),
    ]));
  }

  if (settings.showSuggestions !== false) {
    const text = suggestion(b, ctrl);
    if (text) {
      stack.push(el('div', { class: 'suggest', role: 'note' }, [
        el('span', { class: 'ic', text: '▸', 'aria-hidden': 'true' }),
        el('span', { text }),
        el('button', {
          class: 'x', type: 'button', title: 'Hide suggested actions', 'aria-label': 'Hide suggested actions',
          text: '✕',
          onclick: async () => { settings.showSuggestions = false; await store.saveSettings(settings); render(); },
        }),
      ]));
    }
  }

  if (settings.showNudges !== false && ctrl.game.state.phase.kind === 'day' && !ctrl.ended) {
    if (nudgeShown) {
      stack.push(el('div', { class: 'nudgetext', role: 'note', text: nudgeShown }));
    } else {
      const n = nudge(ctrl);
      if (n) {
        const btn = el('button', {
          class: 'nudgebtn', type: 'button', text: '？ Ask for a nudge',
          onclick: () => { nudgeShown = n.text; render(); },
        });
        stack.push(btn);
      }
    }
  }

  for (const node of stack.reverse()) host.prepend(node);
}

function paint(b) {
  switch (b.kind) {
    case BEAT.REVEAL: return screenReveal();
    case BEAT.NIGHT_OPEN: return screenNightOpen();
    case BEAT.NIGHT_ACTION: return screenNightAction(b);
    case BEAT.NIGHT_RESULT: return screenNightResult(b);
    case BEAT.DAY_RECAP: return screenDayRecap(b);
    case BEAT.DISCOURSE: return screenDiscourse(b);
    case BEAT.NAMING_OPEN: return screenNamingOpen(b);
    case BEAT.NAMING_MADE: return screenNamingMade(b);
    case BEAT.VOTE: return screenVote(b);
    case BEAT.VOTE_RESULT: return screenVoteResult(b);
    case BEAT.SEALING: return screenSealing(b);
    case BEAT.ENDED: return screenEnded();
    default: return screenNightOpen();
  }
}

// ── Reveal ──────────────────────────────────────────────────────────────────
function screenReveal() {
  const r = ctrl.myRole();
  mount($main(),
    el('section', {}, [
      el('p', { class: 'faint', style: { textAlign: 'center' }, text: 'The summoning takes. You open your eyes in the Lantern Yard.' }),
      roleCard(r),
    ]),
    el('section', {}, [
      el('div', { class: 'card' }, [
        el('p', { class: 'faint', text: 'You know your own calling and nothing else. Everyone else is a stranger with a story. Tap any soul to open your notebook on them — you will want it.' }),
      ]),
    ]),
  );
  toolbar([advanceBtn('Let the first Vespers fall')]);
}

// ── Night ───────────────────────────────────────────────────────────────────
const NIGHT_LINES = [
  'The lamps gutter one by one along the Long Stair.',
  'Somewhere below, a seal is drawn and broken and drawn again.',
  'The ward hums. It has been humming since you arrived, and tonight it is louder.',
  'Threshold Academy sleeps the way a held breath sleeps.',
  'Chalk dust settles. Something walks the Underhalls that was not called.',
];

function screenNightOpen() {
  const n = ctrl.game.phase.number;
  const text = `${NIGHT_LINES[(n - 1) % NIGHT_LINES.length]} ${n === 1 ? 'No one dies on the first Vespers. That is the only mercy the Gate offers.' : 'Vespers falls.'}`;
  const p = el('p', { class: 'narration' });
  mount($main(),
    el('section', {}, [el('div', { class: 'card arcane' }, [el('h2', { text: `Vespers ${n}` }), p])]),
    el('section', {}, [circle({ hubTop: '☾', hubLabel: 'the hall sleeps' })]),
  );
  streamer = stream(p, text, settings.narrationSpeed);
  speakNarration(text);
  toolbar([advanceBtn('Close your eyes')]);
}

function screenNightAction(b) {
  const a = b.awaiting;
  const r = ROLES[a.roleId];
  const need = a.count;

  const submit = el('button', { class: 'btn primary', type: 'button', disabled: true });
  const refreshBtn = () => {
    submit.textContent = selected.length < need
      ? `Choose ${need - selected.length} more`
      : need === 1 ? `Choose ${ctrl.seats[selected[0]].name}` : 'Read them both';
    submit.disabled = selected.length !== need;
  };
  submit.onclick = guarded(submit, async () => {
    if (selected.length !== need) return;
    const picks = selected.slice();
    selected = [];
    await ctrl.advance(picks);
    render();
  });

  const draw = () => {
    mount($main(),
      el('section', {}, [
        el('div', { class: 'card arcane' }, [
          el('h2', { text: `Vespers ${ctrl.game.phase.number}` }),
          el('h3', { text: r.name }),
          el('p', { class: 'narration', text: r.ability }),
          el('p', { class: 'faint', text: need === 1 ? 'Choose one soul.' : 'Choose two souls.' }),
        ]),
      ]),
      el('section', {}, [circle({
        selectable: a.targets,
        onPick: (s) => {
          if (selected.includes(s)) selected = selected.filter((x) => x !== s);
          else if (selected.length < need) selected = [...selected, s];
          else selected = [...selected.slice(1), s];
          announce(`${ctrl.seats[s].name} ${selected.includes(s) ? 'chosen' : 'released'}`);
          draw();
        },
      })]),
    );
    refreshBtn();
    toolbar([submit]);
  };
  draw();
}

/** Turn a delivered reveal into the sentence the player actually reads. */
function revealText(rev) {
  if (!rev) return null;
  const nm = (s) => ctrl.seats[s]?.name ?? `#${s}`;
  const d = rev.delivered || {};
  switch (rev.kind === 'info' ? rev.roleId : rev.kind) {
    case 'swornMeet':
      return `You are not alone. ${d.fellows.map(nm).join(' and ') || 'No one else'} walks with you, and the Hollow wears ${nm(d.hollow)}.`;
    case 'hollowMeet':
      return `Your Sworn are ${d.sworn.map(nm).join(' and ')}. If you must lie, lie as the ${d.bluffs.map((x) => label(x)).join(', the ')}.`;
    case 'registry':
      return `The Registry lies open. You read it all.`;
    case 'resonant':
      return d.count === 0 ? 'Both your living neighbours are quiet. The ward does not stir.'
        : d.count === 1 ? 'One of your two living neighbours is Gloaming.'
        : 'Both your living neighbours are Gloaming. The ward will not stop screaming.';
    case 'threadreader':
      return `One of ${nm(d.seats[0])} or ${nm(d.seats[1])} holds the ${label(d.role)}.`;
    case 'cataloguer':
      return d.none ? 'No Stray walks here.' : `One of ${nm(d.seats[0])} or ${nm(d.seats[1])} is the ${label(d.role)}.`;
    case 'inquisitor':
      return `One of ${nm(d.seats[0])} or ${nm(d.seats[1])} is the ${label(d.role)}.`;
    case 'hearthkeeper':
      return `${d.count === 0 ? 'No' : d.count} pair${d.count === 1 ? '' : 's'} of neighbouring souls read Gloaming.`;
    case 'glassreader':
      return `You read ${nm(d.targets[0])} and ${nm(d.targets[1])}. The glass ${d.yes ? 'lit' : 'stayed dark'}.`;
    case 'ashReader':
      return d.seat != null ? `${nm(d.seat)} held the ${label(d.role)}.` : null;
    case 'beastcaller':
      return `As you go, the wings tell you: ${nm(d.seat)} holds the ${label(d.role)}.`;
    case 'action':
      if (rev.roleId === 'hollowOne') {
        return d.starpass ? 'You unmade yourself. Something of you steps into another.'
          : d.blocked ? `You reached for ${nm(d.target)} and found something in the way.`
          : `${nm(d.target)} is Unmade.`;
      }
      if (rev.roleId === 'wardsmith') return `You drew a line around ${nm(d.target)}.`;
      if (rev.roleId === 'blightbinder') return `${nm(d.target)} will not trust what they hear tomorrow.`;
      if (rev.roleId === 'bondservant') return `You have bound yourself to ${nm(d.master)}.`;
      return null;
    default: return null;
  }
}

function screenNightResult(b) {
  const text = revealText(b.reveal);
  const p = el('p', { class: 'narration' });
  const deaths = b.deaths || [];

  mount($main(),
    el('section', {}, [
      el('div', { class: 'card arcane' }, [
        el('h2', { text: `Vespers ${b.night}` }),
        text ? p : el('p', { class: 'faint', text: 'You slept, and nothing came to you. Not everyone is given something.' }),
      ]),
    ]),
    deaths.length ? el('section', {}, [
      el('div', { class: 'card' }, [
        el('h2', { text: 'Before dawn' }),
        ...deaths.map((d) => el('p', { class: 'narration', text: `${ctrl.seats[d.seat].name} is Unmade.` })),
      ]),
    ]) : null,
    el('section', {}, [circle({ hubTop: '☾', hubLabel: 'vespers ends' })]),
  );
  if (text) { streamer = stream(p, text, settings.narrationSpeed); speakNarration(text); }
  toolbar([advanceBtn('Open your eyes')]);
}

// ── Day ─────────────────────────────────────────────────────────────────────
function screenDayRecap(b) {
  const deaths = b.recap?.deaths || [];
  mount($main(),
    el('section', {}, [
      el('div', { class: 'card' }, [
        el('h2', { text: `Reading ${b.day}` }),
        deaths.length
          ? el('div', {}, deaths.map((d) => el('p', {
              class: 'narration',
              text: `${d.name} did not come to the Reading. No one will say how.`,
            })))
          : el('p', { class: 'narration', text: 'Everyone came to the Reading. That is its own kind of news.' }),
        el('p', { class: 'faint', text: 'The Archivist says who is gone and nothing else. Never how, never what they held.' }),
      ]),
    ]),
    el('section', {}, [circle({ hubTop: '☀', hubLabel: 'the reading' })]),
  );
  speakNarration(deaths.length
    ? deaths.map((d) => `${d.name} did not come to the Reading.`).join(' ')
    : 'Everyone came to the Reading.');
  toolbar([advanceBtn('Let them talk')]);
}

function screenDiscourse(b) {
  const all = ctrl.transcript().filter((l) => l.day === ctrl.game.phase.number);
  const feed = el('div', { class: 'feed' }, all.map((l) => el('div', {
    class: `line ${l.human ? 'mine' : ''}`,
  }, [
    el('div', { class: 'who' }, [
      l.name,
      ctrl.claims()[l.seat] ? el('span', { class: 'role-chip', style: { fontSize: '9px', padding: '1px 6px' }, text: label(ctrl.claims()[l.seat]) }) : null,
    ]),
    el('div', { class: 'txt', text: l.text }),
  ])));

  const say = el('input', { type: 'text', placeholder: 'Say something to the room…', maxlength: '300', 'aria-label': 'Speak publicly' });
  const sayBtn = el('button', { class: 'btn sm', type: 'button', text: 'Speak' });
  sayBtn.onclick = guarded(sayBtn, async () => {
    const v = say.value.trim(); if (!v) return;
    say.value = '';
    await ctrl.sayPublic(v);
    render();
  });
  say.onkeydown = (e) => { if (e.key === 'Enter') sayBtn.click(); };

  const hexRow = ctrl.canUseHexbreaker()
    ? el('button', {
        class: 'btn danger', type: 'button', text: '✦ Break the hex — once, publicly',
        onclick: () => openSheet(hexbreakerSheet()),
      })
    : null;

  mount($main(),
    el('section', {}, [circle({ hubTop: '☀', hubLabel: `reading ${ctrl.game.phase.number}` })]),
    el('section', {}, [
      el('h2', { text: 'The room' }),
      all.length ? feed : el('p', { class: 'faint', text: 'Nobody has spoken yet.' }),
    ]),
    el('section', {}, [
      el('div', { style: { display: 'flex', gap: '6px' } }, [
        el('div', { style: { flex: '1' } }, [say]), sayBtn,
      ]),
    ]),
    hexRow ? el('section', {}, [hexRow]) : null,
  );

  // Speak only the lines produced THIS round — re-reading the backlog on every
  // render would talk over itself and repeat everything said so far.
  for (const line of b.lines || []) speakLine(line);

  const more = el('button', { class: 'btn', type: 'button', text: b.canSpeakMore ? 'Let them keep talking' : 'They have said their piece' });
  more.disabled = !b.canSpeakMore;
  more.onclick = guarded(more, async () => { await ctrl.advance(); render(); });
  toolbar([el('div', { class: 'btnrow' }, [more, advanceBtn('Call for Namings', 'call-namings')])]);
}

function hexbreakerSheet() {
  return (close) => {
    let pick = null;
    const list = el('div', { class: 'seatlist' });
    const draw = () => {
      clear(list);
      for (const s of ctrl.seats.filter((x) => x.alive && !x.isHuman)) {
        list.append(el('button', {
          class: `seat ${pick === s.seat ? 'selected' : ''}`, type: 'button',
          onclick: () => { pick = s.seat; draw(); go.disabled = false; },
        }, [el('div', { class: 'token', text: s.name[0] }), el('div', { class: 'nm', text: s.name })]));
      }
    };
    const go = el('button', { class: 'btn danger', type: 'button', text: 'Say it out loud', disabled: true });
    go.onclick = guarded(go, async () => {
      const res = await ctrl.useHexbreaker(pick);
      close();
      announce(res.hit ? 'The hex breaks. It was the Hollow.' : 'Nothing happens.');
      render();
    });
    draw();
    return el('div', {}, [
      el('h3', { id: 'sheettitle', text: 'Break the hex' }),
      el('p', { class: 'faint', text: 'Once per game, in front of everyone. If they are the Hollow, they die where they stand. If they are not, you have told the whole room what you are.' }),
      list, el('div', { style: { height: '10px' } }), go,
      el('div', { style: { height: '6px' } }),
      el('button', { class: 'btn ghost', type: 'button', text: 'Not yet', onclick: close }),
    ]);
  };
}

function screenNamingOpen(b) {
  const pass = el('button', { class: 'btn ghost', type: 'button', text: 'Name no one today' });
  pass.onclick = guarded(pass, async () => { await ctrl.advance('pass'); selected = []; render(); });

  const confirm = el('button', { class: 'btn danger', type: 'button', text: 'Choose a soul', disabled: true });
  confirm.onclick = guarded(confirm, async () => {
    if (selected.length !== 1) return;
    const n = selected[0]; selected = [];
    await ctrl.advance({ nominee: n });
    render();
  });

  const draw = () => {
    mount($main(),
      el('section', {}, [
        el('div', { class: 'card' }, [
          el('h2', { text: 'The Naming' }),
          el('p', { class: 'narration', text: 'You may Name one soul today, and only one. Each soul may be Named once. Every Naming is voted on its own.' }),
          el('p', { class: 'faint', text: `A Mark needs ${ctrl.game.threshold()} of ${ctrl.game.living} living hands — and strictly more than whoever leads. Equal the leader and the Mark clears entirely.` }),
        ]),
      ]),
      el('section', {}, [circle({
        selectable: b.targets,
        onPick: (s) => {
          selected = selected[0] === s ? [] : [s];
          confirm.disabled = selected.length !== 1;
          confirm.textContent = selected.length ? `Name ${ctrl.seats[selected[0]].name}` : 'Choose a soul';
          draw();
        },
      })]),
    );
    toolbar([el('div', { class: 'btnrow' }, [pass, confirm])]);
  };
  draw();
}

function screenNamingMade(b) {
  mount($main(),
    el('section', {}, [
      el('div', { class: 'card' }, [
        el('h2', { text: 'The Naming' }),
        el('p', { class: 'narration', text: `${ctrl.seats[b.nominator].name} Names ${ctrl.seats[b.nominee].name}.` }),
        b.oathbound ? el('p', { class: 'narration', style: { color: 'var(--gloaming)' }, text: 'The oath answers before anyone can. The one who spoke is Sealed where they stand.' }) : null,
      ]),
    ]),
    el('section', {}, [circle({ hubTop: '⚖', hubLabel: 'a naming' })]),
  );
  toolbar([advanceBtn('Take the Tally')]);
}

function screenVote(b) {
  const can = ctrl.game.canVote(ctrl.game.state.humanSeat);
  const nominee = ctrl.seats[b.nominee];

  const yes = el('button', { class: 'btn danger', type: 'button', text: '✋ Raise your hand' });
  const no = el('button', { class: 'btn ghost', type: 'button', text: 'Keep it down' });
  const run = (v) => guarded(v ? yes : no, async () => { await ctrl.advance(v); render(); });
  yes.onclick = run(true); no.onclick = run(false);
  if (!can.ok) { yes.disabled = true; }

  mount($main(),
    el('section', {}, [
      el('div', { class: 'card' }, [
        el('h2', { text: 'The Tally' }),
        el('p', { class: 'narration', text: `${ctrl.seats[b.nominator].name} has Named ${nominee.name}.` }),
        el('div', { class: 'kv' }, [
          el('span', { class: 'k', text: 'To Mark them' }),
          el('span', { class: 'v', text: `${b.threshold} of ${ctrl.game.living} living hands` }),
        ]),
        ctrl.game.state.day.marked != null ? el('div', { class: 'kv' }, [
          el('span', { class: 'k', text: 'Currently Marked' }),
          el('span', { class: 'v', text: `${ctrl.seats[ctrl.game.state.day.marked].name} at ${ctrl.game.state.day.highest}` }),
        ]) : null,
        !can.ok ? el('p', { class: 'err', style: { marginTop: '8px' }, text:
          can.why === 'final-word-spent' ? 'Your Final Word is spent. You may not raise a hand again.'
          : can.why === 'bound-to-master' ? `You are bound to ${ctrl.seats[can.master].name}. You may only raise your hand if they do.`
          : 'You cannot vote in this Tally.' }) : null,
      ]),
    ]),
    el('section', {}, [circle({ hubTop: '⚖', hubLabel: nominee.name })]),
  );
  toolbar([el('div', { class: 'btnrow' }, [no, yes])]);
}

async function screenVoteResult(b) {
  const t = b.tally;
  const nominee = ctrl.seats[t.nominee];
  const outcome = {
    marked: `${nominee.name} is Marked.`,
    'tied-cleared': `A dead heat. The Mark clears — no one carries it now.`,
    insufficient: `Not enough hands. ${nominee.name} walks.`,
    'below-leader': `Not enough to take the Mark from whoever holds it.`,
  }[t.outcome];

  const host = el('div');
  mount($main(),
    el('section', {}, [el('div', { class: 'card' }, [el('h2', { text: 'The Tally' }), host])]),
    el('section', {}, [circle({ hubTop: String(t.tally), hubLabel: 'hands raised' })]),
  );

  // Reveal hands one at a time — the drama is free and it is the moment the
  // player learns most about who trusts whom.
  const shown = [];
  const speed = reducedMotion() ? 0
    : settings.narrationSpeed === 'instant' ? 0
    : settings.narrationSpeed === 'fast' ? 90 : 190;
  mount(host, renderTally({ tally: 0, threshold: t.threshold, living: ctrl.game.living, votes: [], seats: ctrl.seats }));
  for (const v of t.order) {
    shown.push(v);
    mount(host, renderTally({
      tally: shown.filter((x) => x.vote).length,
      threshold: t.threshold, living: ctrl.game.living, votes: shown, seats: ctrl.seats,
    }));
    if (speed) await sleep(speed);
  }
  host.append(el('p', { class: 'narration', style: { marginTop: '10px' }, text: outcome }));
  announce(outcome);
  speakNarration(outcome);
  toolbar([advanceBtn('Go on')]);
}

function screenSealing(b) {
  const sealed = b.sealed != null ? ctrl.seats[b.sealed] : null;
  mount($main(),
    el('section', {}, [
      el('div', { class: 'card' }, [
        el('h2', { text: 'Sealing' }),
        el('p', { class: 'narration', text: sealed
          ? `${sealed.name} is taken to the Vellum Gate and Sealed. The Archivist does not say what they held.`
          : 'No one is Sealed today. The ward holds one more night, whether that helps or not.' }),
      ]),
    ]),
    el('section', {}, [circle({ hubTop: '☀', hubLabel: 'the reading ends' })]),
  );
  speakNarration(sealed
    ? `${sealed.name} is taken to the Vellum Gate and Sealed.`
    : 'No one is Sealed today.');
  toolbar([advanceBtn('Let Vespers fall')]);
}

// ── End ─────────────────────────────────────────────────────────────────────
function screenEnded() {
  const s = ctrl.summary();
  const won = s.result.winner === 'lantern';
  const reason = {
    'hollow-destroyed': 'The Hollow is gone. The ward holds.',
    'ward-broken': 'Too few remain. The ward fails and the hall empties.',
    'sanctified-sealed': 'The anchor was burned. The ward had nothing left to hold to.',
    'chancellor-holds': 'Three stand, no one is Sealed, and the Chancellor simply refuses to leave.',
  }[s.result.reason] || '';

  const reveals = el('div', { class: 'card' }, [
    el('h2', { text: 'The Registry, opened' }),
    ...s.seats.map((x) => el('div', { class: 'kv' }, [
      el('span', { class: 'k' }, [
        x.team === 'gloaming' ? `${GLYPH.gloaming} ` : `${GLYPH.lantern} `,
        x.name, x.alive ? '' : ` ${GLYPH.dead}`,
      ]),
      el('span', { class: 'v' }, [
        label(x.role),
        x.role === 'mistaken' ? el('span', { class: 'faint', text: ` — believed the ${label(x.perceivedRole)}` }) : null,
      ]),
    ])),
    s.mirageSeat != null ? el('p', { class: 'faint', style: { marginTop: '8px' },
      text: `The Mirage was ${ctrl.seats[s.mirageSeat].name} — the glass always lit on them, and it was always wrong.` }) : null,
  ]);

  mount($main(),
    el('section', {}, [
      el('div', { class: 'card arcane', style: { textAlign: 'center' } }, [
        el('h3', { style: { fontSize: '20px', color: won ? 'var(--lantern)' : 'var(--gloaming)' },
          text: won ? 'The Lantern holds' : 'The Gloaming takes the hall' }),
        el('p', { class: 'narration', text: reason }),
        el('p', { class: 'faint', text: `You were the ${label(ctrl.me.role === 'mistaken' ? ctrl.me.perceivedRole : ctrl.me.role)}${ctrl.me.role === 'mistaken' ? ' — or you thought you were' : ''}. ${ctrl.me.alive ? 'You survived.' : 'You did not.'}` }),
      ]),
    ]),
    el('section', {}, [
      el('div', { class: 'card' }, [
        el('h2', { text: 'Your Reading' }),
        el('div', { class: 'kv' }, [el('span', { class: 'k', text: 'Days' }), el('span', { class: 'v', text: String(s.days) })]),
        el('div', { class: 'kv' }, [el('span', { class: 'k', text: 'Notebook reads' }), el('span', { class: 'v', text: s.guessed ? `${s.correct} of ${s.guessed} right — ${s.readAccuracy}%` : 'you took none' })]),
        el('div', { class: 'kv' }, [el('span', { class: 'k', text: 'Seed' }), el('span', { class: 'v', text: s.seed })]),
      ]),
    ]),
    el('section', {}, [reveals]),
    el('section', {}, [
      el('button', { class: 'btn', type: 'button', text: 'What were they thinking?', onclick: () => openSheet(transparencySheet(s)) }),
    ]),
  );

  const again = el('button', { class: 'btn primary', type: 'button', text: 'Step through again' });
  again.onclick = guarded(again, async () => { await store.clearGame(); ctrl = null; renderLobby(); });
  toolbar([again]);
}

boot();
