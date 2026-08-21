/**
 * Bottom sheets: the seat detail (notebook + whispers), the codex, settings,
 * and the post-game transparency view.
 *
 * The NOTEBOOK is the highest-value feature in the build. Physical players do
 * this with a sheet of paper, and without it a 380px panel asks the human to
 * hold eight claim-histories in working memory while eight opponents hold
 * theirs perfectly. That asymmetry is what makes a solo deduction game feel
 * unfair in a way players cannot articulate.
 */

import { el, mount, clear, guarded, announce } from './dom.js';
import { GLYPH } from './circle.js';
import { ROLES, label } from '../engine/roles.js';
import { MODELS, DEFAULT_MODEL, GROQ_KEYS_URL } from '../ai/llm.js';
import * as Speech from './speech.js';

const sheetEl = () => document.getElementById('sheet');
const bodyEl = () => document.getElementById('sheetbody');

let lastFocus = null;

export function openSheet(build) {
  const sh = sheetEl(); const body = bodyEl();
  lastFocus = document.activeElement;
  clear(body);
  body.append(build(closeSheet));
  sh.setAttribute('open', '');
  const first = body.querySelector('button,select,input,textarea');
  (first || body).focus?.();
  sh.onclick = (e) => { if (e.target === sh) closeSheet(); };
  document.addEventListener('keydown', escClose);
}

export function closeSheet() {
  const sh = sheetEl();
  sh.removeAttribute('open');
  document.removeEventListener('keydown', escClose);
  lastFocus?.focus?.();
}

function escClose(e) { if (e.key === 'Escape') closeSheet(); }

function head(title, close, sub) {
  return el('div', { class: 'sheethead' }, [
    el('div', {}, [
      el('h3', { id: 'sheettitle', text: title }),
      sub ? el('div', { class: 'faint', text: sub }) : null,
    ]),
    el('button', { class: 'closex', type: 'button', 'aria-label': 'Close', onclick: close, text: '✕' }),
  ]);
}

// ─────────────────────────────────────────────────────────────── SEAT SHEET

export function seatSheet(ctrl, seat, onChange, onSpeak) {
  return (close) => {
    const s = ctrl.seats[seat];
    const note = ctrl.note(seat);
    const claim = ctrl.claims()[seat];
    const lines = ctrl.transcript().filter((l) => l.seat === seat);
    const thread = ctrl.whispers[seat] || [];
    const isMe = seat === ctrl.game.state.humanSeat;

    const wrap = el('div', {}, [
      head(s.name + (isMe ? ' — you' : ''), close,
        s.alive ? 'Alive' : `An Echo${s.finalWordSpent ? ' · Final Word spent' : ' · Final Word unspent'}`),
    ]);

    if (claim) {
      wrap.append(el('div', { class: 'kv' }, [
        el('span', { class: 'k', text: 'Claims to hold' }),
        el('span', { class: 'v' }, [el('span', { class: 'role-chip', text: label(claim) })]),
      ]));
    }

    if (!isMe) {
      // ── Notebook
      wrap.append(el('h2', { text: 'Your notebook', style: { marginTop: '14px' } }));

      const alignRow = el('div', { class: 'segrow' },
        [['lantern', `${GLYPH.lantern} Lantern`], ['unsure', `${GLYPH.unsure} Unsure`], ['gloaming', `${GLYPH.gloaming} Gloaming`]]
          .map(([val, text]) => el('button', {
            class: `seg ${val}`, type: 'button', text,
            'aria-pressed': note.alignment === val ? 'true' : 'false',
            onclick: async (e) => {
              const next = note.alignment === val ? null : val;
              await ctrl.setNote(seat, { alignment: next });
              alignRow.querySelectorAll('.seg').forEach((b) => b.setAttribute('aria-pressed', 'false'));
              if (next) e.currentTarget.setAttribute('aria-pressed', 'true');
              note.alignment = next;
              announce(`${s.name} marked ${next || 'unmarked'}`);
              onChange?.();
            },
          })));
      wrap.append(el('div', { class: 'field' }, [el('label', { text: 'Read' }), alignRow]));

      const roleSel = el('select', {
        'aria-label': 'Suspected calling',
        onchange: async (e) => {
          await ctrl.setNote(seat, { roleGuess: e.target.value || null, roleGuessLabel: e.target.value ? label(e.target.value) : null });
          onChange?.();
        },
      }, [
        el('option', { value: '', text: '— no guess —' }),
        ...Object.values(ROLES).filter((r) => !r.hidden).map((r) =>
          el('option', { value: r.id, text: r.name, selected: note.roleGuess === r.id })),
      ]);
      wrap.append(el('div', { class: 'field' }, [el('label', { text: 'Suspected calling' }), roleSel]));

      const ta = el('textarea', {
        placeholder: 'What they said, when they said it, what did not add up…',
        oninput: () => { clearTimeout(ta._t); ta._t = setTimeout(() => ctrl.setNote(seat, { text: ta.value }).then(onChange), 350); },
      });
      ta.value = note.text || '';
      wrap.append(el('div', { class: 'field' }, [el('label', { text: 'Note' }), ta]));

      // ── Whispers
      if (s.alive && ctrl.game.state.phase.kind === 'day') {
        wrap.append(el('h2', { text: 'Whisper', style: { marginTop: '14px' } }));
        const feed = el('div', { class: 'feed' },
          thread.map((m) => el('div', { class: `line whisper ${m.from === 'human' ? 'mine' : ''}` }, [
            el('div', { class: 'who', text: m.from === 'human' ? 'You' : s.name }),
            el('div', { class: 'txt', text: m.text }),
          ])));
        wrap.append(feed);

        const input = el('input', { type: 'text', placeholder: `Say something to ${s.name}…`, maxlength: '300' });
        const send = el('button', { class: 'btn sm primary', type: 'button', text: 'Whisper' });
        send.onclick = guarded(send, async () => {
          const v = input.value.trim();
          if (!v) return;
          input.value = '';
          feed.append(el('div', { class: 'line whisper mine' }, [
            el('div', { class: 'who', text: 'You' }), el('div', { class: 'txt', text: v }),
          ]));
          const reply = await ctrl.whisper(seat, v);
          feed.append(el('div', { class: 'line whisper' }, [
            el('div', { class: 'who', text: s.name }), el('div', { class: 'txt', text: reply }),
          ]));
          if (onSpeak) onSpeak(seat, reply);
          feed.lastChild.scrollIntoView({ block: 'nearest' });
          announce(`${s.name} replied`);
        });
        input.onkeydown = (e) => { if (e.key === 'Enter') send.click(); };
        wrap.append(el('div', { class: 'field', style: { marginTop: '8px' } }, [
          input, el('div', { style: { height: '6px' } }), send,
        ]));
      }
    }

    // ── What they have said in public
    if (lines.length) {
      wrap.append(el('h2', { text: 'Said aloud', style: { marginTop: '14px' } }));
      wrap.append(el('div', { class: 'feed' },
        lines.slice(-6).map((l) => el('div', { class: 'line' }, [
          el('div', { class: 'who', text: `Reading ${l.day}` }),
          el('div', { class: 'txt', text: l.text }),
        ]))));
    }
    return wrap;
  };
}

// ─────────────────────────────────────────────────────────────── CODEX

export function codexSheet(highlightId) {
  return (close) => {
    const wrap = el('div', {}, [head('The Quiet Ward', close, '22 callings · First Codex')]);
    const groups = [
      ['Wardens', 'warden', 'Lantern souls with a calling that helps.'],
      ['Strays', 'stray', 'Lantern souls whose calling hinders.'],
      ['Sworn', 'sworn', 'Gloaming souls who serve.'],
      ['The Hollow', 'hollow', 'One of you came through wrong.'],
    ];
    for (const [title, type, blurb] of groups) {
      wrap.append(el('h2', { text: title, style: { marginTop: '14px' } }));
      wrap.append(el('p', { class: 'faint', text: blurb }));
      for (const r of Object.values(ROLES).filter((x) => x.type === type)) {
        wrap.append(el('div', {
          class: 'card',
          style: { marginBottom: '7px', borderColor: r.id === highlightId ? 'var(--lantern-dim)' : '' },
        }, [
          el('h3', { text: r.name }),
          el('p', { class: 'narration', style: { fontSize: '13px', margin: '0' }, text: r.ability }),
        ]));
      }
    }
    wrap.append(el('h2', { text: 'The order of a Vespers', style: { marginTop: '16px' } }));
    wrap.append(el('p', { class: 'faint', text: 'Public knowledge. Knowing it does not make you a cheat; not knowing it just makes you worse at a game you are trying to learn.' }));
    wrap.append(el('div', { class: 'card' }, [
      el('div', { class: 'kv' }, [el('span', { class: 'k', text: 'First Vespers' }), el('span', { class: 'v', text: 'Blightbinder → Veilwalker → Threadreader → Cataloguer → Inquisitor → Hearthkeeper → Resonant → Glassreader → Bondservant' })]),
      el('div', { class: 'kv' }, [el('span', { class: 'k', text: 'After' }), el('span', { class: 'v', text: 'Blightbinder → Wardsmith → Veilwalker → the Hollow → Beastcaller → Resonant → Glassreader → Ash-Reader → Bondservant' })]),
    ]));

    wrap.append(el('h2', { text: 'How a Reading ends', style: { marginTop: '16px' } }));
    wrap.append(el('div', { class: 'card' }, [
      el('p', { class: 'faint', text: 'You may Name once each Reading, and each soul may be Named once. Every Naming is voted separately. To Mark a soul the vote needs at least half the living AND strictly more than the current leader. Equalling the leader clears the Mark and nobody is Sealed. At most one Sealing a day.' }),
      el('p', { class: 'faint', text: 'An Echo keeps one Final Word — a single vote for the rest of the game — and may never Name.' }),
    ]));
    return wrap;
  };
}

// ─────────────────────────────────────────────────────────────── SETTINGS

export const DIFFICULTY_PRESETS = {
  novice: { claimQuality: 3, deduction: 3.0, coordination: 1.0 },
  adept: { claimQuality: 2, deduction: 2.0, coordination: 2.0 },
  veteran: { claimQuality: 2, deduction: 1.2, coordination: 2.6 },
};

/** A segmented control that keeps its own pressed state consistent. */
function segment(options, current, onPick, extraClass = '') {
  const row = el('div', { class: 'segrow' });
  for (const [val, text] of options) {
    row.append(el('button', {
      class: `seg ${extraClass}`, type: 'button', text,
      'aria-pressed': current === val ? 'true' : 'false',
      onclick: (e) => {
        row.querySelectorAll('.seg').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        onPick(val);
      },
    }));
  }
  return row;
}

export function settingsSheet(settings, save, opts = {}) {
  return (close) => {
    const wrap = el('div', {}, [head('Settings', close)]);
    const set = async (patch) => { Object.assign(settings, patch); await save(settings); };
    const rerender = () => document.dispatchEvent(new CustomEvent('veilfall:rerender'));

    // ── Guidance ──────────────────────────────────────────────────────────
    wrap.append(el('h2', { text: 'Guidance' }));
    wrap.append(el('p', {
      class: 'faint',
      text: 'Suggested actions restate the rule in force — what you CAN do right now. They never tell you who to suspect, so they cannot solve the game for you.',
    }));
    wrap.append(el('div', { class: 'field' }, [
      el('label', { text: 'Suggested action' }),
      segment([['on', 'Show'], ['off', 'Hide']], settings.showSuggestions ? 'on' : 'off',
        (v) => { set({ showSuggestions: v === 'on' }); rerender(); }),
    ]));
    wrap.append(el('div', { class: 'field' }, [
      el('label', { text: 'Ask for a nudge' }),
      segment([['on', 'Offer'], ['off', 'Never']], settings.showNudges ? 'on' : 'off',
        (v) => { set({ showNudges: v === 'on' }); rerender(); }),
      el('p', { class: 'faint', style: { marginTop: '6px' },
        text: 'A nudge is never pushed at you and never names a suspect — it asks the question you might not have thought to ask.' }),
    ]));
    wrap.append(el('button', {
      class: 'btn ghost sm', type: 'button', text: '↺ Show the first-run tutorial again',
      style: { width: '100%' },
      onclick: () => { set({ tutorialSeen: [], introSeen: false }); rerender(); close(); },
    }));

    // ── Table ─────────────────────────────────────────────────────────────
    wrap.append(el('h2', { text: 'The table', style: { marginTop: '18px' } }));
    wrap.append(el('div', { class: 'field' }, [
      el('label', { text: 'Seating' }),
      segment([['ring', '◯ Ring'], ['list', '☰ List']], settings.seatLayout,
        (v) => { set({ seatLayout: v }); rerender(); }),
    ]));
    wrap.append(el('div', { class: 'field' }, [
      el('label', { text: 'Ring spread' }),
      el('input', {
        type: 'range', min: '0.8', max: '1.2', step: '0.05', value: String(settings.seatSize ?? 1),
        'aria-label': 'Ring spread',
        oninput: (e) => { set({ seatSize: Number(e.target.value) }); rerender(); },
      }),
    ]));
    wrap.append(el('div', { class: 'field' }, [
      el('label', { text: 'Narration' }),
      segment([['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']],
        settings.narrationSpeed || 'normal', (v) => set({ narrationSpeed: v })),
    ]));
    wrap.append(el('div', { class: 'field' }, [
      el('label', { text: 'Motion' }),
      segment([['on', 'Animate'], ['off', 'Reduce']], settings.reduceMotion ? 'off' : 'on',
        (v) => {
          set({ reduceMotion: v === 'off' });
          document.documentElement.dataset.motion = v === 'off' ? 'off' : '';
        }),
    ]));

    // ── Read aloud (browser speech — actual audio) ────────────────────────
    wrap.append(el('h2', { text: 'Read aloud', style: { marginTop: '18px' } }));
    wrap.append(el('p', {
      class: 'faint',
      text: 'Speaks the game out loud using your system\u2019s own voices. Free, offline, no key. Each soul gets its own voice, pitch and pace so you can tell who is talking without looking.',
    }));
    wrap.append(el('div', { class: 'field' }, [
      el('label', { text: 'Speech' }),
      segment([['off', 'Silent'], ['narration', 'Narration'], ['all', 'Everyone']],
        settings.readAloud || 'off',
        (v) => { set({ readAloud: v }); opts.onReadAloud?.(v); }),
      el('p', { class: 'faint', style: { marginTop: '6px' },
        text: 'Narration reads the Archivist only. Everyone also reads what each soul says aloud in the Reading.' }),
    ]));
    if (opts.speechStatus) {
      wrap.append(el('div', {
        class: opts.speechStatus.ok ? 'usagebox' : 'err',
        text: opts.speechStatus.ok
          ? `${opts.speechStatus.english} English voices available (using ${opts.speechStatus.sample}).`
          : opts.speechStatus.reason,
      }));
    }

    // ── Improvised dialogue (Groq — TEXT, not audio) ──────────────────────
    wrap.append(el('h2', { text: 'Improvised dialogue', style: { marginTop: '18px' } }));
    wrap.append(el('p', {
      class: 'faint',
      text: 'This is TEXT, not sound — it changes the WORDS your opponents write, not whether you hear them. For audio, use Read aloud above.',
    }));
    wrap.append(el('p', {
      class: 'faint',
      text: 'VEILFALL plays completely without a key; opponents speak from a written script. Adding a key lets a language model rewrite their lines in their own voice — never changing what they know, claim, target, or vote for.',
    }));

    wrap.append(el('a', {
      class: 'linkout', href: GROQ_KEYS_URL, target: '_blank', rel: 'noopener noreferrer',
      style: { marginBottom: '10px' },
    }, ['✦ Get a free Groq key — no card needed']));
    wrap.append(el('p', {
      class: 'faint',
      text: 'Groq\u2019s free tier is genuinely free: sign in, create a key, paste it below. The free allowance is roughly 30 requests and 8,000 tokens a minute, which VEILFALL stays inside on purpose — it spends the budget on the lines that carry information and lets the rest speak in the offline voice.',
    }));

    // The key input deliberately does NOT auto-activate on blur. Storing a key
    // silently was the original defect — it saved, nothing changed, and there
    // was no way to tell whether it had worked. Activation is an explicit act
    // with an explicit result.
    const keyIn = el('input', {
      type: 'password', placeholder: 'gsk_…', value: settings.groqKey || '',
      'aria-label': 'Groq API key', autocomplete: 'off', spellcheck: 'false',
      oninput: () => { status.textContent = ''; status.className = 'usagebox'; activate.disabled = !keyIn.value.trim(); },
    });
    wrap.append(el('div', { class: 'field' }, [el('label', { text: 'Groq API key' }), keyIn]));

    const modelSel = el('select', {
      'aria-label': 'Voice model',
      onchange: (e) => set({ model: e.target.value }),
    }, MODELS.map((m) => el('option', {
      value: m.id, text: `${m.label} — ${m.note}`,
      selected: (settings.model || DEFAULT_MODEL) === m.id,
    })));
    wrap.append(el('div', { class: 'field' }, [el('label', { text: 'Voice model' }), modelSel]));

    const status = el('div', { class: 'usagebox', role: 'status', 'aria-live': 'polite' });
    const activate = el('button', {
      class: 'btn primary', type: 'button', text: '✦ Activate improvised dialogue',
      disabled: !(settings.groqKey || '').trim(),
    });

    activate.onclick = guarded(activate, async () => {
      const key = keyIn.value.trim();
      if (!key) return;
      status.className = 'usagebox';
      status.textContent = 'Reaching Groq…';

      await set({ groqKey: key, model: modelSel.value, tier: 'kindled' });
      const res = await (opts.onActivate ? opts.onActivate({ key, model: modelSel.value }) : null);

      if (!res) { status.textContent = 'Could not start the voices here.'; return; }
      if (res.ok) {
        status.className = 'usagebox';
        status.innerHTML = '';
        status.append(
          el('div', { style: { color: 'var(--lantern)' }, text: `✓ Improvised dialogue active — ${res.model} answered in ${res.ms} ms.` }),
          res.sample ? el('div', { class: 'faint', style: { marginTop: '4px', fontStyle: 'italic' }, text: `“${res.sample}”` }) : null,
          el('div', { class: 'faint', style: { marginTop: '4px' }, text: 'This applies to the game already in progress — no need to restart.' }),
        );
        activate.textContent = '✓ Improvised dialogue active';
        announce('Improvised dialogue active. This changes the written words, not audio.');
      } else {
        status.className = 'err';
        status.textContent = res.error || 'That did not work.';
        activate.textContent = '✦ Try again';
        announce('Improvised dialogue could not be activated.');
      }
    });

    wrap.append(el('div', { class: 'field' }, [activate, el('div', { style: { height: '8px' } }), status]));

    // Live state, so the panel never leaves the player guessing.
    wrap.append(el('div', { class: 'kv' }, [
      el('span', { class: 'k', text: 'Dialogue' }),
      el('span', {
        class: 'v',
        style: { color: opts.voicesActive ? 'var(--lantern)' : 'var(--ink-dim)' },
        text: opts.voicesActive ? 'Improvised — Kindled' : 'Scripted — Warded (the game is complete either way)',
      }),
    ]));

    if ((settings.groqKey || '').trim()) {
      wrap.append(el('button', {
        class: 'btn ghost sm', type: 'button', text: 'Remove key and go back offline',
        style: { width: '100%', marginTop: '8px' },
        onclick: async () => {
          keyIn.value = '';
          await set({ groqKey: '', tier: 'warded' });
          opts.onActivate?.({ key: '', model: modelSel.value });
          rerender();
          close();
        },
      }));
    }

    wrap.append(el('p', {
      class: 'faint',
      text: 'The key is stored in this browser\u2019s local storage for play.dhseadev.online. Anyone with access to this browser profile can read it, and so can any other page on this site. If that is not acceptable, leave it blank — the game is complete without it.',
    }));

    if (opts.usage) {
      const u = opts.usage;
      wrap.append(el('div', { class: 'card', style: { marginTop: '8px' } }, [
        el('div', { class: 'usagebox' }, [
          `This game: ${u.calls} calls, ${u.inputTokens + u.outputTokens} tokens`,
          el('br'),
          `Budget declines (fell back to the offline voice): ${u.declined}`,
          el('br'),
          `Cache hit rate: ${Math.round((u.cacheHitRate || 0) * 100)}%`,
          u.disabledReason ? el('br') : null,
          u.disabledReason ? el('span', { style: { color: 'var(--warn)' }, text: u.disabledReason }) : null,
        ]),
      ]));
    }

    // ── Credits ───────────────────────────────────────────────────────────
    wrap.append(el('div', { class: 'credits' }, [
      el('div', { class: 'made' }, [
        'Made by ',
        el('a', { href: 'https://dhseadev.online', target: '_blank', rel: 'noopener noreferrer', text: 'DHSeaDev' }),
      ]),
      el('div', { class: 'fine', text: 'VEILFALL is an original work. Its setting, callings, rules text, art and title belong to this project and to no other game.' }),
      el('div', { class: 'fine', style: { marginTop: '6px' }, text: 'Offline opponents run entirely on your machine. Voices, when enabled, are generated by Groq using your own key.' }),
    ]));

    wrap.append(el('div', { style: { height: '10px' } }));
    wrap.append(el('button', { class: 'btn ghost', type: 'button', text: 'Close', onclick: close }));
    return wrap;
  };
}

// ─────────────────────────────────────────────────────────────── TRANSPARENCY

export function transparencySheet(summary) {
  return (close) => {
    const wrap = el('div', {}, [head('What they were thinking', close, 'Every opponent, revealed')]);
    for (const t of summary.transparency) {
      const truth = ROLES[t.trueRole];
      wrap.append(el('div', { class: 'card', style: { marginBottom: '8px' } }, [
        el('h3', { text: `${t.name} — ${truth.name}` }),
        el('div', { class: 'kv' }, [
          el('span', { class: 'k', text: 'Team' }),
          el('span', { class: 'v', text: t.team === 'gloaming' ? `${GLYPH.gloaming} Gloaming` : `${GLYPH.lantern} Lantern` }),
        ]),
        t.claimed ? el('div', { class: 'kv' }, [
          el('span', { class: 'k', text: 'Claimed' }),
          el('span', { class: 'v', text: label(t.claimed) + (t.bluff === t.claimed ? ' (a lie)' : '') }),
        ]) : null,
        el('div', { class: 'kv' }, [
          el('span', { class: 'k', text: 'Manner' }),
          el('span', {
            class: 'v',
            text: [
              t.persona.talkative > 0.6 ? 'talkative' : t.persona.talkative < 0.3 ? 'quiet' : null,
              t.persona.paranoid > 0.6 ? 'paranoid' : null,
              t.persona.assertive > 0.6 ? 'forceful' : null,
              t.persona.precise > 0.6 ? 'precise' : null,
            ].filter(Boolean).join(', ') || 'even-handed',
          }),
        ]),
        t.reads?.length ? el('div', {}, [
          el('div', { class: 'faint', style: { marginTop: '6px' }, text: 'Who they suspected, most first:' }),
          ...t.reads.slice(0, 3).map((r) => el('div', { class: 'kv' }, [
            el('span', { class: 'k', text: r.name }),
            el('span', { class: 'v', text: `${r.suspicion > 0 ? '+' : ''}${r.suspicion}${r.why?.length ? ` — ${r.why[0]}` : ''}` }),
          ])),
        ]) : null,
      ]));
    }
    return wrap;
  };
}

export { mount };
