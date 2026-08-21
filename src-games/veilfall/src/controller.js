/**
 * Game controller — the only thing the UI talks to.
 *
 * Turns the engine's phase machine plus the AI table into a linear sequence of
 * BEATS the panel can render one at a time. A beat is the unit of persistence:
 * every beat boundary is a save point, because the side panel's document
 * lifetime across tab switches is not something the official docs guarantee.
 */

import { Game } from './engine/engine.js';
import { Table } from './ai/agent.js';
import { ROLES, TEAM, TYPE, label } from './engine/roles.js';
import { store, flush } from './storage.js';

export const BEAT = {
  REVEAL: 'reveal',
  NIGHT_OPEN: 'night-open',
  NIGHT_ACTION: 'night-action',
  NIGHT_RESULT: 'night-result',
  NIGHT_CLOSE: 'night-close',
  DAY_RECAP: 'day-recap',
  DISCOURSE: 'discourse',
  NAMING_OPEN: 'naming-open',
  NAMING_MADE: 'naming-made',
  VOTE: 'vote',
  VOTE_RESULT: 'vote-result',
  SEALING: 'sealing',
  ENDED: 'ended',
};

export class Controller {
  constructor({ game, table, notes = {}, settings = {} }) {
    this.game = game;
    this.table = table;
    this.notes = notes;
    this.settings = settings;
    this.beat = { kind: BEAT.REVEAL };
    this.listeners = new Set();
    this.busy = false;
    this.discourseRounds = 0;
    this.humanNamedToday = false;
    this.pendingVotes = [];
    this.whispers = {};
  }

  static async create(opts) {
    const game = new Game({
      playerCount: opts.playerCount,
      seed: opts.seed,
      playerName: opts.playerName || 'You',
    });
    const table = new Table(game, { difficulty: opts.difficulty, llm: opts.llm });
    const c = new Controller({ game, table, settings: opts.settings || {} });
    await c.save();
    return c;
  }

  static async resume({ llm, settings } = {}) {
    const snap = await store.loadGame();
    if (!snap || !snap.game) return null;
    try {
      const game = Game.restore(snap.game);
      const table = Table.hydrate(game, snap.table, { llm });
      const c = new Controller({ game, table, notes: snap.notes || {}, settings: settings || {} });
      c.beat = snap.beat || { kind: BEAT.REVEAL };
      c.discourseRounds = snap.discourseRounds || 0;
      c.humanNamedToday = snap.humanNamedToday || false;
      c.pendingVotes = snap.pendingVotes || [];
      c.whispers = snap.whispers || {};
      c.migrated = snap.__migrated || null;
      return c;
    } catch (e) {
      console.error('[veilfall] save could not be resumed', e);
      return null;
    }
  }

  /**
   * Attach or detach voices on a game that is already running.
   *
   * Without this, a key entered mid-session was stored and never wired: the
   * Table binds its llm at construction, so the setting changed and nothing
   * happened. Reported as "adding a Groq key seems to do nothing", and it was
   * exactly that.
   */
  setVoices(llm) {
    this.table.llm = llm || null;
    return this.table.llm;
  }
  get voicesActive() { return !!this.table.llm && !this.table.llm.disabled; }

  // ── Persistence ────────────────────────────────────────────────────────────
  async save() {
    await store.saveGame({
      game: this.game.snapshot(),
      table: this.table.serialize(),
      beat: this.beat,
      notes: this.notes,
      whispers: this.whispers,
      discourseRounds: this.discourseRounds,
      humanNamedToday: this.humanNamedToday,
      pendingVotes: this.pendingVotes,
      savedAt: Date.now(),
    });
  }
  async flushSave() { await this.save(); await flush(); }

  // ── Events ─────────────────────────────────────────────────────────────────
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.beat, this); }

  async setBeat(beat) {
    this.beat = beat;
    await this.save();
    this.emit();
    return beat;
  }

  // ── Views ──────────────────────────────────────────────────────────────────
  get view() { return this.game.humanView(); }
  get seats() { return this.game.state.seats; }
  get me() { return this.game.human; }
  get ended() { return this.game.ended; }

  myRole() { return this.game.humanRole(); }
  myReveal() { return this.game.nightReveal(this.game.state.humanSeat); }
  transcript() { return this.table.transcript; }
  claims() { return this.table.claims; }

  note(seat) {
    return this.notes[seat] || { roleGuess: null, alignment: null, confidence: 0, text: '', tag: null };
  }
  async setNote(seat, patch) {
    this.notes[seat] = { ...this.note(seat), ...patch };
    await this.save();
    this.emit();
  }

  // ── The single entry point the UI drives ───────────────────────────────────
  /**
   * Advance to the next beat that needs the human. Re-entrant-guarded: this
   * mutates state and may call the network, so a second concurrent call would
   * interleave two advances over one game.
   */
  async advance(input) {
    if (this.busy) return this.beat;
    this.busy = true;
    try {
      return await this._advance(input);
    } finally {
      this.busy = false;
    }
  }

  async _advance(input) {
    const g = this.game;
    if (g.ended) return this.setBeat({ kind: BEAT.ENDED, result: g.result });

    switch (this.beat.kind) {
      // ── Character reveal → first Vespers
      case BEAT.REVEAL:
      case BEAT.NIGHT_CLOSE:
      case BEAT.SEALING: {
        g.beginNight();
        return this.setBeat({ kind: BEAT.NIGHT_OPEN, night: g.phase.number });
      }

      case BEAT.NIGHT_OPEN: {
        const step = g.advanceNight(this.table.chooser());
        if (step.status === 'awaiting') {
          return this.setBeat({ kind: BEAT.NIGHT_ACTION, awaiting: step.awaiting });
        }
        return this.closeNight(step);
      }

      case BEAT.NIGHT_ACTION: {
        // input = array of chosen seats
        g.submitNightChoice(input || []);
        const step = g.advanceNight(this.table.chooser());
        if (step.status === 'awaiting') {
          return this.setBeat({ kind: BEAT.NIGHT_ACTION, awaiting: step.awaiting });
        }
        return this.closeNight(step);
      }

      case BEAT.NIGHT_RESULT: {
        this.table.ingestNight();
        if (g.ended) return this.setBeat({ kind: BEAT.ENDED, result: g.result });
        g.beginDay();
        this.discourseRounds = 0;
        this.humanNamedToday = false;
        return this.setBeat({ kind: BEAT.DAY_RECAP, recap: g.state.day.recap, day: g.phase.number });
      }

      case BEAT.DAY_RECAP:
      case BEAT.DISCOURSE: {
        // A discourse round, then hand control back so the human can speak,
        // whisper, take notes, or call for Namings.
        if (this.beat.kind === BEAT.DISCOURSE && input === 'call-namings') {
          return this.nextNaming();
        }
        const lines = await this.table.discourse({
          rounds: 1,
          pressure: Math.min(0.6, this.discourseRounds * 0.2),
        });
        this.discourseRounds++;
        const exhausted = this.discourseRounds >= 3;
        return this.setBeat({
          kind: BEAT.DISCOURSE, lines, round: this.discourseRounds,
          canSpeakMore: !exhausted, day: g.phase.number,
        });
      }

      case BEAT.NAMING_OPEN: {
        // input: {nominee} to Name, or 'pass'
        if (input && input !== 'pass' && input.nominee != null) {
          const humanSeat = g.state.humanSeat;
          g.openNaming(humanSeat, input.nominee);
          this.humanNamedToday = true;
          this.table.hearHumanAccusation(humanSeat, input.nominee);
          return this.beginVote(humanSeat, input.nominee);
        }
        return this.nextNaming({ humanPassed: true });
      }

      case BEAT.NAMING_MADE:
        return this.beginVote(this.beat.nominator, this.beat.nominee);

      case BEAT.VOTE: {
        // input = boolean, the human's hand
        const cur = g.state.day.current;
        if (cur && cur.votes[g.state.humanSeat] === undefined && g.canVote(g.state.humanSeat).ok) {
          g.castVote(g.state.humanSeat, !!input);
        }
        for (const voter of g.pendingVoters()) {
          if (voter === g.state.humanSeat) continue;
          g.castVote(voter, this.table.willVote(voter, cur.nominee));
        }
        const tally = g.closeTally();
        return this.setBeat({
          kind: BEAT.VOTE_RESULT, tally,
          marked: g.state.day.marked, threshold: tally.threshold,
        });
      }

      case BEAT.VOTE_RESULT:
        if (g.ended) return this.setBeat({ kind: BEAT.ENDED, result: g.result });
        return this.nextNaming();

      case BEAT.ENDED:
        return this.beat;

      default:
        return this.beat;
    }
  }

  async closeNight(step) {
    return this.setBeat({
      kind: BEAT.NIGHT_RESULT,
      reveal: this.myReveal(),
      deaths: step.result?.deaths ?? [],
      night: this.game.phase.number,
    });
  }

  /** Decide who Names next: the human if they still can, else an agent, else end the day. */
  async nextNaming(opts = {}) {
    const g = this.game;
    if (g.ended) return this.setBeat({ kind: BEAT.ENDED, result: g.result });

    const humanCanName = !this.humanNamedToday
      && g.canName(g.state.humanSeat).ok
      && !opts.humanPassed;

    if (humanCanName) {
      const targets = g.state.seats
        .filter((s) => g.canBeNamed(s.seat).ok && s.seat !== g.state.humanSeat)
        .map((s) => s.seat);
      if (targets.length) {
        return this.setBeat({ kind: BEAT.NAMING_OPEN, targets, day: g.phase.number });
      }
    }

    const proposal = this.table.proposeNaming();
    if (proposal) {
      g.openNaming(proposal.seat, proposal.target);
      if (g.ended) return this.setBeat({ kind: BEAT.ENDED, result: g.result });
      return this.setBeat({
        kind: BEAT.NAMING_MADE,
        nominator: proposal.seat, nominee: proposal.target,
        oathbound: g.state.day.namings.at(-1)?.oathboundFired || false,
      });
    }

    // Nobody else will Name. End the Reading.
    const res = g.endDay();
    if (g.ended) return this.setBeat({ kind: BEAT.ENDED, result: g.result, sealed: res.sealed });
    return this.setBeat({ kind: BEAT.SEALING, sealed: res.sealed, day: g.phase.number });
  }

  async beginVote(nominator, nominee) {
    return this.setBeat({
      kind: BEAT.VOTE,
      nominator, nominee,
      threshold: this.game.threshold(),
      canVote: this.game.canVote(this.game.state.humanSeat),
      day: this.game.phase.number,
    });
  }

  // ── Human speech ───────────────────────────────────────────────────────────
  async sayPublic(text) {
    const seat = this.game.state.humanSeat;
    const line = { day: this.game.phase.number, seat, name: this.me.name, text: String(text).slice(0, 400), human: true };
    this.table.transcript.push(line);
    this.game.state.day?.transcript?.push(line);
    // A claim in public text is heard as a claim.
    const claimed = detectClaim(text);
    if (claimed) this.table.hearHumanClaim(seat, claimed);
    await this.save();
    this.emit();
    return line;
  }

  async whisper(seat, text) {
    const thread = (this.whispers[seat] ||= []);
    thread.push({ from: 'human', text: String(text).slice(0, 400), day: this.game.phase.number });
    const b = this.table.agent(seat);
    let reply = null;
    if (b) {
      // Tier 2 first; ANY null — network error, timeout, or a reply the
      // legality filter rejected — falls back to the Tier 1 template. The
      // player always gets an answer, and it is never an unchecked one.
      if (this.table.llm) {
        reply = await this.table.llm.whisperReply({
          beliefs: b, state: this.game.state, text, table: this.table,
        });
      }
      if (!reply) reply = templateWhisper(b, this.game.state, this.table, this.game.rng);
      thread.push({ from: 'agent', text: reply, day: this.game.phase.number });
    }
    await this.save();
    this.emit();
    return reply;
  }

  // ── Hexbreaker (day action) ────────────────────────────────────────────────
  canUseHexbreaker() {
    const r = this.myRole();
    return r?.id === 'hexbreaker' && !this.me.usedOnce && this.me.alive
      && this.game.state.day && !this.game.state.day.hexbreakerUsed;
  }
  async useHexbreaker(target) {
    const res = this.game.useHexbreaker(this.game.state.humanSeat, target);
    await this.save();
    if (this.game.ended) return this.setBeat({ kind: BEAT.ENDED, result: this.game.result });
    this.emit();
    return res;
  }

  // ── End of game ────────────────────────────────────────────────────────────
  summary() {
    const reg = this.game.registry();
    const notes = this.notes;
    let correct = 0, guessed = 0;
    for (const s of reg.seats) {
      const n = notes[s.seat];
      if (!n || (!n.roleGuess && !n.alignment)) continue;
      guessed++;
      const alignOk = n.alignment && n.alignment === s.team;
      const roleOk = n.roleGuess && n.roleGuess === s.role;
      if (roleOk || (alignOk && !n.roleGuess)) correct++;
    }
    return {
      result: reg.result,
      seats: reg.seats,
      mirageSeat: reg.mirageSeat,
      bluffs: reg.bluffs,
      readAccuracy: guessed ? Math.round((correct / guessed) * 100) : null,
      guessed, correct,
      days: this.game.phase.number,
      transparency: this.table.transparency(),
      misinformation: collectMisinformation(this.game),
      blocked: this.table.blocked,
      log: reg.log,
      seed: reg.seed,
    };
  }
}

/** Every false thing the human was told, with the truth beside it. */
function collectMisinformation(game) {
  const out = [];
  const seat = game.state.humanSeat;
  for (const entry of game.state.log) {
    if (entry.t !== 'night-action' || entry.seat !== seat) continue;
    out.push({ night: entry.n, roleId: entry.roleId });
  }
  const truths = game.state.night?.truths?.[seat];
  const delivered = game.state.night?.reveals?.[seat];
  if (truths && delivered) {
    out.push({ night: game.state.night.number, truth: truths, delivered: delivered.delivered, impaired: delivered.impaired });
  }
  return out;
}

/** Detect a hard claim in free text, so agents hear the human claim. */
function detectClaim(text) {
  const lower = String(text).toLowerCase();
  if (!/\bi(?:'m| am)\b|\bi hold\b|\bthat's me\b/.test(lower)) return null;
  for (const [id, meta] of Object.entries(ROLES)) {
    if (meta.hidden) continue;
    if (lower.includes(meta.name.toLowerCase())) return id;
  }
  return null;
}

/** Tier 1 whisper reply. Reveals only what this agent may legitimately say. */
function templateWhisper(beliefs, state, table, rng) {
  const claim = beliefs.team === TEAM.GLOAMING ? beliefs.bluff : beliefs.knownRole;
  const claimName = claim ? label(claim) : 'nothing worth saying';
  const susp = Object.values(beliefs.about)
    .filter((b) => state.seats[b.seat].alive)
    .sort((a, b) => b.evil - a.evil)[0];
  const suspName = susp ? state.seats[susp.seat].name : null;

  const bank = [
    `Quietly, then: I hold the ${claimName}.`,
    suspName ? `Between us — I don't like ${suspName}.` : `Between us — I have nothing solid.`,
    `I'll tell you what I have if you go first.`,
    suspName ? `${claimName}. And keep an eye on ${suspName}.` : `${claimName}. That's all I've got.`,
    `I've been wrong before. Ask me again after Vespers.`,
  ];
  void table;
  return rng.pick(bank);
}

export { ROLES, TEAM, TYPE, label };
