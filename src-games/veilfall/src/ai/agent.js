/**
 * The opponent table.
 *
 * Owns every AI decision in the game. Two rules hold throughout:
 *
 *   - DECISIONS COME FROM THE BELIEF RECORD, never from the transcript tail.
 *     Reading the tail is exactly how measured vote-herding happens: agents
 *     repeat the last speaker unless directly accused.
 *   - ANY LIST SHOWN TO A MODEL IS SHUFFLED. Positional bias in option lists is
 *     measured and real; ordering souls by seat hands the model a thumb on the
 *     scale.
 */

import { ROLES, TEAM, TYPE } from '../engine/roles.js';
import { makePersona, willSpeak, namingAppetite } from './persona.js';
import {
  createBeliefs, seedEvilKnowledge, ingestReveal, ingestClaim,
  ingestAccusation, ingestDeath, pruneEvidence, ranked,
} from './beliefs.js';
import { computeIntent, renderIntent, commit } from './speech.js';
import { permittedFacts, checkUtterance } from './security.js';

export class Table {
  /**
   * @param {import('../engine/engine.js').Game} game
   * @param {object} [opts]
   * @param {{claimQuality:number,deduction:number,coordination:number}} [opts.difficulty]
   * @param {object} [opts.llm] - Tier 2 phraser; absent = Tier 1
   */
  constructor(game, opts = {}) {
    this.game = game;
    this.rng = game.rng;
    this.difficulty = opts.difficulty || { claimQuality: 2, deduction: 2, coordination: 2 };
    this.llm = opts.llm || null;
    this.agents = new Map();
    this.claims = {};      // seat -> claimed role, public
    this.transcript = [];  // {day, seat, text, intent}
    this.blocked = [];     // utterances the legality filter rejected

    for (const s of game.state.seats) {
      if (s.isHuman) continue;
      const persona = makePersona(this.rng, s.seat, this.difficulty);
      const b = createBeliefs(game.state, s.seat, persona);
      seedEvilKnowledge(b, game.state, this.rng);
      this.agents.set(s.seat, b);
    }
    this.assignDistinctBluffs();
  }

  /**
   * The Gloaming agrees who is claiming what, ONCE, at setup.
   *
   * Each evil agent previously drew its bluff independently from a three-deep
   * pool, so with two or three Sworn the same calling was routinely claimed
   * twice — which trips the claim-collision weight and hands the Lantern a free
   * read. Measured: this was the dominant term in the win rate, larger than
   * either difficulty knob. Evil teams that talk before the game do not walk
   * into a collision, and neither should these.
   *
   * Where the pool is too small to give everyone a distinct bluff, the
   * remainder fall back to callings genuinely not in play — still never a
   * duplicate of a fellow's.
   */
  assignDistinctBluffs() {
    const evil = Array.from(this.agents.values()).filter((b) => b.team === TEAM.GLOAMING);
    if (evil.length < 2) return;

    const inPlay = new Set(this.game.state.seats.map((s) => s.role));
    const taken = new Set();
    const primary = this.rng.shuffle(this.game.state.registry.bluffs.slice());
    const spare = this.rng.shuffle(
      Object.keys(ROLES).filter(
        (id) => ROLES[id].team === TEAM.LANTERN && !ROLES[id].hidden && !inPlay.has(id)
      )
    );

    for (const b of evil) {
      const pick = primary.find((x) => !taken.has(x))
        ?? spare.find((x) => !taken.has(x))
        ?? b.bluff;
      taken.add(pick);
      b.bluff = pick;
    }
  }

  agent(seat) { return this.agents.get(seat); }

  /** Snapshot for persistence. Beliefs are plain data by design. */
  serialize() {
    return {
      agents: Array.from(this.agents.entries()).map(([seat, b]) => [seat, b]),
      claims: this.claims,
      transcript: this.transcript,
      blocked: this.blocked,
      difficulty: this.difficulty,
    };
  }

  static hydrate(game, data, opts = {}) {
    const t = Object.create(Table.prototype);
    t.game = game;
    t.rng = game.rng;
    t.difficulty = data.difficulty || { claimQuality: 2, deduction: 2, coordination: 2 };
    t.llm = opts.llm || null;
    t.agents = new Map(data.agents.map(([seat, b]) => [Number(seat), b]));
    t.claims = data.claims || {};
    t.transcript = data.transcript || [];
    t.blocked = data.blocked || [];
    return t;
  }

  // ── NIGHT ──────────────────────────────────────────────────────────────────

  /** The chooser handed to the engine. Pure function of the belief record. */
  chooser() {
    return ({ state, seat, roleId, targets }) => {
      const b = this.agents.get(seat);
      const n = ROLES[roleId]?.targets || 1;
      if (!b) return this.rng.sample(targets, Math.min(n, targets.length));
      return this.nightChoice(b, state, roleId, targets, n);
    };
  }

  nightChoice(b, state, roleId, targets, count) {
    const susp = ranked(b, state).filter((x) => targets.includes(x.seat));
    const trusted = susp.slice().reverse();
    const noise = () => (this.rng.next() - 0.5) * (3 - this.difficulty.deduction);

    const byThreat = () => {
      // One threat model, shared with the evil vote, so the night kill and the
      // day Sealing can never disagree about who is dangerous.
      const scored = targets.map((t) => ({
        seat: t,
        score: this.threatOf(t) + (b.about[t]?.evil === 10 ? -100 : 0) + noise(),
      }));
      return scored.sort((a, c) => c.score - a.score)[0]?.seat ?? targets[0];
    };

    switch (roleId) {
      case 'hollowOne': {
        // Consider the starpass: if the Hollow is Marked and an heir exists,
        // dying on its own terms is better than dying on the table's.
        const marked = state.day?.marked;
        const heirs = state.seats.filter(
          (s) => s.alive && ROLES[s.role].type === TYPE.SWORN && s.seat !== b.seat
        );
        if (marked === b.seat && heirs.length && this.rng.chance(0.5 + this.difficulty.coordination * 0.15)) {
          return [b.seat];
        }
        const focus = state.night?.gloamingFocus;
        const scored = targets
          .map((t) => ({
            seat: t,
            score: this.threatOf(t)
              + (b.about[t]?.evil === 10 ? -100 : 0)
              + (t === focus ? -1.5 : 0)   // already Blighted; hit someone else
              + noise(),
          }))
          .sort((a, c) => c.score - a.score);
        return [scored[0]?.seat ?? targets[0]];
      }
      case 'blightbinder': {
        // The Blightbinder acts BEFORE the Hollow in the order, so it takes
        // the top threat and leaves the next for the kill. Spending both of
        // the Gloaming's night abilities on one soul is the coordination
        // failure that made evil lose the measured balance sweep.
        const scored = targets
          .map((t) => ({ seat: t, score: this.threatOf(t) + (b.about[t]?.evil === 10 ? -100 : 0) + noise() }))
          .sort((a, c) => c.score - a.score);
        state.night.gloamingFocus = scored[0]?.seat ?? null;
        return [scored[0]?.seat ?? targets[0]];
      }
      case 'wardsmith': {
        // Protect the loudest confirmed-sounding good soul, else the most trusted.
        const claimedPower = targets.filter((t) => {
          const c = this.claims[t];
          return c && ROLES[c] && ROLES[c].type === TYPE.WARDEN;
        });
        if (claimedPower.length) return [this.rng.pick(claimedPower)];
        return [trusted[0]?.seat ?? targets[0]];
      }
      case 'glassreader':
        return susp.slice(0, 2).map((x) => x.seat).length === 2
          ? susp.slice(0, 2).map((x) => x.seat)
          : this.rng.sample(targets, 2);
      case 'beastcaller':
        return [susp[0]?.seat ?? this.rng.pick(targets)];
      case 'bondservant':
        return [trusted[0]?.seat ?? this.rng.pick(targets)];
      default:
        return this.rng.sample(targets, Math.min(count, targets.length));
    }
  }

  /** Deduction knob (1..3) as a 0..1 skill scalar. */
  get skill() { return Math.max(0, Math.min(1, (this.difficulty.deduction - 0.5) / 2.5)); }

  /** Fold each agent's own night information into its beliefs. */
  ingestNight() {
    const state = this.game.state;
    const reveals = state.night?.reveals || {};
    const skill = this.skill;
    for (const [seat, b] of this.agents) {
      const r = reveals[seat];
      if (r) {
        // A weak agent sometimes reads its own information backwards. This is
        // the difference between a bad player and a blind one, and it is what
        // makes the easy setting actually easy rather than merely noisier.
        const misread = this.rng.chance((1 - skill) * 0.3);
        ingestReveal(b, state, r, `night ${state.night.number}`, misread ? -skill : skill);
      }
      pruneEvidence(b);
    }
    for (const d of state.night?.deaths || []) {
      for (const [, b] of this.agents) ingestDeath(b, state, d);
    }
  }

  // ── DAY ────────────────────────────────────────────────────────────────────

  /**
   * One round of discourse. Returns the utterances produced this round.
   * Tier 2 replaces phrasing only — the intent is already fixed.
   */
  async discourse({ rounds = 1, pressure = 0 } = {}) {
    const state = this.game.state;
    const out = [];

    // Lines already spoken this day, so no two souls echo a template
    // word for word. Scoped to the day: a callback across days reads as a
    // person repeating themselves, which is fine; two people saying the exact
    // same sentence in one room is not.
    const said = new Set();

    for (let r = 0; r < rounds; r++) {
      // Shuffled speaking order. Seat order would make the first seat the
      // agenda-setter every single day.
      const order = this.rng.shuffle(
        Array.from(this.agents.keys()).filter((s) => state.seats[s].alive)
      );

      for (const seat of order) {
        const b = this.agents.get(seat);
        if (!willSpeak(b.persona, this.rng, { pressure })) continue;

        const intent = computeIntent(b, state, this.rng, { phase: 'day' });
        if (!intent) continue;

        let rendered = renderIntent(intent, b, state, this.rng, { avoid: said });
        if (!rendered) continue;

        // ── Tier 2: the model rephrases the SAME intent. It cannot change it.
        if (this.llm) {
          const phrased = await this.llm.phrase({
            beliefs: b, state, intent, fallback: rendered.text,
          });
          if (phrased) {
            const permitted = permittedFacts(b, state);
            const check = checkUtterance(phrased, permitted, state, seat);
            if (check.ok) rendered = { ...rendered, text: phrased };
            else this.blocked.push({ seat, text: phrased, violations: check.violations, day: state.day?.number });
          }
        }

        // Layer 3 applies to Tier 1 output too. Templates are leak-free by
        // construction, but a construction argument is not evidence.
        const permitted = permittedFacts(b, state);
        const finalCheck = checkUtterance(rendered.text, permitted, state, seat);
        if (!finalCheck.ok) {
          this.blocked.push({ seat, text: rendered.text, violations: finalCheck.violations, day: state.day?.number, tier1: true });
          continue;
        }

        commit(b, intent, state);
        if (intent.kind === 'claim') {
          this.claims[seat] = intent.role;
          for (const [, other] of this.agents) {
            ingestClaim(other, { speaker: seat, claimedRole: intent.role, allClaims: this.claims });
          }
        }
        if (intent.kind === 'accuse') {
          for (const [, other] of this.agents) {
            ingestAccusation(other, { accuser: seat, accused: intent.target });
          }
        }

        const line = { day: state.day?.number ?? 0, seat, name: state.seats[seat].name, text: rendered.text, intent };
        this.transcript.push(line);
        state.day?.transcript?.push(line);
        out.push(line);
      }
    }
    return out;
  }

  /** A public claim by the human. Every agent hears it. */
  hearHumanClaim(seat, roleId) {
    this.claims[seat] = roleId;
    for (const [, b] of this.agents) {
      ingestClaim(b, { speaker: seat, claimedRole: roleId, allClaims: this.claims });
    }
  }

  hearHumanAccusation(accuser, accused) {
    for (const [, b] of this.agents) ingestAccusation(b, { accuser, accused });
  }

  // ── NAMING ─────────────────────────────────────────────────────────────────

  /** Which agent, if any, opens a Naming — and against whom. */
  proposeNaming() {
    const state = this.game.state;
    const candidates = [];

    for (const [seat, b] of this.agents) {
      if (!state.seats[seat].alive) continue;
      if (!this.game.canName(seat).ok) continue;
      const susp = ranked(b, state).filter((x) => this.game.canBeNamed(x.seat).ok);
      if (!susp.length) continue;
      const target = susp[0];
      const appetite = namingAppetite(b.persona);
      // Evil will Name a good soul readily; good needs actual suspicion.
      const isEvil = b.team === TEAM.GLOAMING;
      const drive = isEvil
        ? appetite * 0.9 + 0.25
        : appetite * 0.7 + Math.max(0, target.score) * 0.22;
      candidates.push({ seat, target: target.seat, drive: drive + (this.rng.next() - 0.5) * 0.3 });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.drive - a.drive);
    const best = candidates[0];
    const dayNo = state.day?.number ?? 1;
    // Day 1 is quieter; later days force the issue.
    const gate = dayNo === 1 ? 0.85 : 0.55;
    return best.drive > gate ? best : null;
  }

  // ── VOTING ─────────────────────────────────────────────────────────────────

  /**
   * How much of a problem is this soul FOR THE GLOAMING? Loud, credible, and
   * information-bearing souls are worth removing; quiet ones are not.
   * Shared by the night kill and the evil vote so the two cannot disagree.
   */
  threatOf(seat) {
    const claimed = this.claims[seat];
    const meta = claimed ? ROLES[claimed] : null;
    let t = 0;
    if (meta && meta.type === TYPE.WARDEN) t += 1.2;
    if (['glassreader', 'inquisitor', 'resonant', 'ashReader'].includes(claimed)) t += 0.8;
    if (['chancellor', 'hexbreaker'].includes(claimed)) t += 1.2;
    t += Math.min(1.2, this.transcript.filter((x) => x.seat === seat).length * 0.3);
    return t;
  }

  /**
   * Does this agent raise a hand? Read from the belief record ONLY.
   *
   * Deliberately does NOT read the running tally. Passing the tally in is how
   * agents learn to follow the room, and following the room is the single most
   * measured failure mode in this genre. The anti-herding test asserts this by
   * stuffing the tally and requiring the answer not to move.
   *
   * NOTE on the two scales: `about[x].evil` means "how much I SUSPECT x". For an
   * evil agent that field is hard knowledge (10 = my fellow, negative = known
   * not-mine), which is the opposite of a voting preference — knowing a soul is
   * Lantern makes them a BETTER Sealing target, not a worse one. The two teams
   * therefore score from different quantities on purpose.
   */
  willVote(seat, nominee) {
    const b = this.agents.get(seat);
    const state = this.game.state;
    if (!b) return false;

    const target = b.about[nominee];
    if (!target) return false;

    // Never Seal our own. The coordination knob is how disciplined they are.
    if (target.evil === 10) {
      return this.rng.chance(Math.max(0, 0.22 - this.difficulty.coordination * 0.07));
    }

    const isEvil = b.team === TEAM.GLOAMING;
    const day = state.day?.number ?? 1;
    const living = state.seats.filter((s) => s.alive).length;

    let score;
    if (isEvil) {
      // Any Lantern soul is a good day for the Gloaming; a loud one is better.
      score = 1.55 + this.difficulty.coordination * 0.3 + this.threatOf(nominee) * 0.45;

      // THE RESCUE. If one of ours is currently Marked, piling onto a LATER
      // Naming either replaces the Mark with a Lantern soul or ties the
      // high-water count, which clears the Mark entirely and Seals nobody.
      // This reads `marked` and `highest` — public mechanical state a real
      // player uses — and never `current.tally`, which is the running count
      // that produces follow-the-room behaviour.
      const marked = state.day?.marked;
      if (marked != null && b.about[marked]?.evil === 10) {
        score += 2.4 + this.difficulty.coordination * 0.4;
      }
    } else {
      score = target.evil;
    }

    // Paranoid agents vote more; committed agents stand by what they said.
    score += (b.persona.paranoid - 0.5) * 1.4;
    if (b.commitments.some((c) => c.kind === 'accuse' && c.target === nominee)) score += 2.2;
    if (b.commitments.some((c) => c.kind === 'defend' && c.target === nominee)) score -= 3.0;

    // A table that never Seals loses by attrition, and everyone knows it.
    score += (day - 1) * 0.45;
    if (living <= 5) score += 0.9;
    if (living <= 3) score += 0.9;

    // Deduction knob = signal-to-noise in the read.
    const noise = (this.rng.next() - 0.5) * (4 - this.difficulty.deduction * 1.2);
    return score + noise > 1.4;
  }

  /** Post-game: what each agent actually knew, thought, and did. */
  transparency() {
    const state = this.game.state;
    return Array.from(this.agents.entries()).map(([seat, b]) => ({
      seat,
      name: state.seats[seat].name,
      trueRole: state.seats[seat].role,
      team: b.team,
      claimed: this.claims[seat] || null,
      bluff: b.bluff,
      persona: {
        talkative: b.persona.talkative, paranoid: b.persona.paranoid,
        assertive: b.persona.assertive, precise: b.persona.precise,
      },
      reads: ranked(b, state === null ? state : this.game.state)
        .map((r) => ({
          seat: r.seat, name: state.seats[r.seat].name,
          suspicion: Math.round(r.score * 10) / 10,
          why: r.evidence.slice(0, 2).map((e) => e.why),
        })),
      commitments: b.commitments,
    }));
  }
}

export { TEAM, TYPE, ROLES };
