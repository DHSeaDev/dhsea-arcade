/**
 * Engine facade. The ONLY surface the UI and the AI layer are allowed to touch.
 *
 * Nothing in this module calls a model. The model never returns game state.
 */

import { createRng, makeSeedPhrase, hashSeed } from './rng.js';
import { createGame, compositionFor, MIN_PLAYERS, MAX_PLAYERS } from './setup.js';
import { ROLES, TEAM, TYPE } from './roles.js';
import { livingCount, isImpaired } from './status.js';
import * as Night from './night.js';
import * as Day from './day.js';
import { checkWin } from './deaths.js';

export class Game {
  /**
   * @param {object} opts
   * @param {number} opts.playerCount
   * @param {string} [opts.seed]
   * @param {string[]} [opts.names]
   * @param {string} [opts.playerName]
   * @param {string} [opts.forcePlayerRole]
   */
  constructor(opts) {
    const seedPhrase = opts.seed || `VEIL-${Date.now().toString(16).toUpperCase()}`;
    this.rng = createRng(hashSeed(seedPhrase));
    this.state = createGame({
      playerCount: opts.playerCount,
      rng: this.rng,
      seedPhrase,
      names: opts.names,
      playerName: opts.playerName,
      forcePlayerRole: opts.forcePlayerRole,
    });
  }

  /** Rehydrate from persisted state. */
  static restore(snapshot) {
    const g = Object.create(Game.prototype);
    g.state = snapshot;
    g.rng = createRng(hashSeed(snapshot.seed));
    g.rng.setState(snapshot.rngState);
    return g;
  }

  snapshot() {
    this.state.rngState = this.rng.getState();
    return JSON.parse(JSON.stringify(this.state));
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  get phase() { return this.state.phase; }
  get ended() { return this.state.phase.kind === 'ended'; }
  get result() { return this.state.result; }
  get human() { return this.state.seats[this.state.humanSeat]; }
  get living() { return livingCount(this.state); }
  seat(i) { return this.state.seats[i]; }

  /** The calling the human BELIEVES they hold. Never their true one. */
  humanRole() {
    const s = this.human;
    return ROLES[s.role === 'mistaken' ? s.perceivedRole : s.role];
  }

  /** What the human is permitted to know. The UI reads only this. */
  humanView() {
    const s = this.human;
    const believed = s.role === 'mistaken' ? s.perceivedRole : s.role;
    return {
      seat: s.seat,
      name: s.name,
      role: ROLES[believed],
      team: ROLES[believed].team,
      alive: s.alive,
      finalWordSpent: s.finalWordSpent,
      // NOTE: impairment is deliberately NOT exposed. A Blighted player must
      // not be told they are Blighted, and the Mistaken must never be told.
      seats: this.state.seats.map((x) => ({
        seat: x.seat, name: x.name, alive: x.alive,
        isHuman: x.isHuman, finalWordSpent: x.finalWordSpent,
      })),
      phase: this.state.phase,
      living: this.living,
      threshold: this.state.day ? Day.voteThreshold(this.state) : null,
    };
  }

  // ── Night ──────────────────────────────────────────────────────────────────
  beginNight() { Night.beginNight(this.state); return this; }
  advanceNight(aiChoose) { return Night.advanceNight(this.state, this.rng, aiChoose); }
  submitNightChoice(targets) { return Night.submitNightChoice(this.state, this.rng, targets); }
  nightReveal(seatIdx) { return this.state.night?.reveals?.[seatIdx] ?? null; }

  // ── Day ────────────────────────────────────────────────────────────────────
  beginDay() { Day.beginDay(this.state); return this; }
  canName(i) { return Day.canName(this.state, i); }
  canBeNamed(i) { return Day.canBeNamed(this.state, i); }
  canVote(i) { return Day.canVote(this.state, i); }
  openNaming(nominator, nominee) { return Day.openNaming(this.state, this.rng, nominator, nominee); }
  pendingVoters() { return Day.pendingVoters(this.state); }
  castVote(seat, yes) { return Day.castVote(this.state, seat, yes); }
  closeTally() { return Day.closeTally(this.state); }
  useHexbreaker(seat, target) { return Day.useHexbreaker(this.state, this.rng, seat, target); }
  endDay() { return Day.endDay(this.state, this.rng); }
  threshold() { return Day.voteThreshold(this.state); }

  // ── Registry (Archivist-only; post-game reveal) ────────────────────────────
  registry() {
    return {
      seed: this.state.seed,
      seats: this.state.seats.map((s) => ({
        seat: s.seat, name: s.name, role: s.role, perceivedRole: s.perceivedRole,
        team: ROLES[s.role].team, type: ROLES[s.role].type,
        alive: s.alive, impaired: isImpaired(this.state, s.seat),
      })),
      mirageSeat: this.state.registry.mirageSeat,
      bluffs: this.state.registry.bluffs,
      modifiers: this.state.registry.modifiers,
      log: this.state.log,
      result: this.state.result,
    };
  }

  checkWin(ctx) { return checkWin(this.state, ctx); }
}

export {
  createRng, makeSeedPhrase, hashSeed, compositionFor,
  MIN_PLAYERS, MAX_PLAYERS, ROLES, TEAM, TYPE, Night, Day,
};
