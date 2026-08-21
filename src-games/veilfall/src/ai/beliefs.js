/**
 * The belief record — the thing prior art was missing.
 *
 * Every opponent carries an inspectable model of what it knows, what it thinks,
 * and why. Votes are chosen from THIS, never from the transcript tail, because
 * reading the transcript tail is exactly how measured vote-herding happens.
 *
 * The model never writes this structure. It only reads a rendered slice of it.
 */

import { ROLES, TYPE, TEAM, label } from '../engine/roles.js';

/** Evidence weights. Higher = moves suspicion further. */
const W = {
  HARD_INFO: 4.0,       // my own calling told me this
  CLAIM_COLLISION: 2.5, // two souls hard-claimed the same unique calling
  CONFIRMED_DEAD: 3.0,  // a death confirmed or refuted a claim
  ACCUSED_ME: 1.2,
  VOTED_WITH_EVIL: 0.8,
  DEFENDED_SUSPECT: 0.6,
  NO_CLAIM: 0.9,        // silence is mildly suspicious, not damning
  SURVIVED_NIGHT: 0.35, // the Hollow does not kill its own
};

export function createBeliefs(state, seatIdx, persona) {
  const me = state.seats[seatIdx];
  const myRole = ROLES[me.role === 'mistaken' ? me.perceivedRole : me.role];

  const about = {};
  for (const s of state.seats) {
    if (s.seat === seatIdx) continue;
    about[s.seat] = {
      seat: s.seat,
      evil: 0,            // signed suspicion; negative = trusted
      roleGuess: null,
      claimedRole: null,
      evidence: [],       // {w, why, phase} — pruned when never cited
      trustedBy: [],
    };
  }

  return {
    seat: seatIdx,
    team: myRole.team,
    type: myRole.type,
    knownRole: myRole.id,
    about,
    /** Hard knowledge handed down by the engine. Never inferred. */
    hardFacts: [],
    /** Every public claim this agent has made. Checked before making a new one. */
    commitments: [],
    /** The bluff this agent has been assigned, if evil. */
    bluff: null,
    persona,
  };
}

/** Seed evil agents with what they actually know, and assign a bluff. */
export function seedEvilKnowledge(beliefs, state, rng) {
  if (beliefs.team !== TEAM.GLOAMING) return beliefs;

  const sworn = state.seats.filter((s) => ROLES[s.role].type === TYPE.SWORN);
  const hollow = state.seats.find((s) => ROLES[s.role].type === TYPE.HOLLOW);

  for (const s of [...sworn, ...(hollow ? [hollow] : [])]) {
    if (s.seat === beliefs.seat) continue;
    beliefs.about[s.seat].evil = 10;
    beliefs.about[s.seat].roleGuess = s.role;
    beliefs.about[s.seat].evidence.push({ w: W.HARD_INFO, why: 'we walk together', phase: 'setup', hard: true });
  }
  // Everyone else is known-good to an evil agent, which is a real advantage.
  for (const [seatStr, b] of Object.entries(beliefs.about)) {
    if (b.evil === 10) continue;
    b.evil = -3;
    b.evidence.push({ w: W.HARD_INFO, why: 'not one of ours', phase: 'setup', hard: true });
    void seatStr;
  }

  // Bluff assignment is deterministic and made ONCE. Hoping an agent invents a
  // good lie at generation time is the measured failure (deception in 31% of turns).
  const inPlay = new Set(state.seats.map((s) => s.role));
  const pool = state.registry.bluffs.length
    ? state.registry.bluffs
    : Object.keys(ROLES).filter((id) => ROLES[id].team === TEAM.LANTERN && !inPlay.has(id));
  beliefs.bluff = pool.length ? rng.pick(pool) : 'resonant';
  return beliefs;
}

/**
 * Fold this agent's own night information into its beliefs.
 *
 * `skill` (0..1, from the deduction knob) is how well this agent USES what it
 * was told. It belongs here and not at the voting stage: a vote-stage noise
 * term of +/-1.4 could never overcome a belief swing of +/-4, which is why the
 * difficulty slider measured flat across its whole range before this change.
 * A weak agent under-weights real information and sometimes reads it backwards
 * — which is what a weak player actually does.
 */
export function ingestReveal(beliefs, state, reveal, phaseLabel, skill = 1) {
  if (!reveal) return beliefs;
  const conf = 0.35 + 0.65 * Math.max(0, Math.min(1, skill));
  const add = (seat, w, why) => {
    const b = beliefs.about[seat];
    if (!b) return;
    b.evil += w * conf;
    b.evidence.push({ w: w * conf, why, phase: phaseLabel, hard: true });
  };

  const d = reveal.delivered || {};
  switch (reveal.roleId) {
    case 'resonant': {
      const nbrs = d.neighbours || [];
      if (d.count === 0) nbrs.forEach((n) => add(n, -W.HARD_INFO, 'my ward was quiet beside them'));
      if (d.count === 2) nbrs.forEach((n) => add(n, W.HARD_INFO, 'my ward screamed on both sides'));
      if (d.count === 1) nbrs.forEach((n) => add(n, W.HARD_INFO * 0.4, 'one of my two neighbours is Gloaming'));
      break;
    }
    case 'inquisitor':
      (d.seats || []).forEach((s) => add(s, W.HARD_INFO * 0.6, `one of these two is ${label(d.role, { article: true })}`));
      beliefs.hardFacts.push({ kind: 'sworn-pair', seats: d.seats, role: d.role });
      break;
    case 'threadreader':
      (d.seats || []).forEach((s) => add(s, -W.HARD_INFO * 0.5, `one of these two is ${label(d.role, { article: true })}`));
      beliefs.hardFacts.push({ kind: 'warden-pair', seats: d.seats, role: d.role });
      break;
    case 'cataloguer':
      if (!d.none) beliefs.hardFacts.push({ kind: 'stray-pair', seats: d.seats, role: d.role });
      else beliefs.hardFacts.push({ kind: 'no-strays' });
      break;
    case 'hearthkeeper':
      beliefs.hardFacts.push({ kind: 'evil-pairs', count: d.count });
      break;
    case 'glassreader':
      if (d.yes) (d.targets || []).forEach((s) => add(s, W.HARD_INFO * 0.8, 'the glass lit on one of these two'));
      else (d.targets || []).forEach((s) => add(s, -W.HARD_INFO * 0.7, 'the glass stayed dark'));
      break;
    case 'ashReader':
      if (d.seat != null) {
        beliefs.hardFacts.push({ kind: 'sealed-role', seat: d.seat, role: d.role });
        if (ROLES[d.role] && ROLES[d.role].team === TEAM.GLOAMING) {
          beliefs.about[d.seat] && (beliefs.about[d.seat].evil += W.CONFIRMED_DEAD);
        }
      }
      break;
    case 'beastcaller':
      if (d.seat != null && ROLES[d.role]) {
        add(d.seat, ROLES[d.role].team === TEAM.GLOAMING ? W.CONFIRMED_DEAD : -W.CONFIRMED_DEAD, 'the wings told me');
      }
      break;
    default:
      break;
  }
  return beliefs;
}

/** A public claim was made. Every agent hears it and updates. */
export function ingestClaim(beliefs, { speaker, claimedRole, allClaims }) {
  if (speaker === beliefs.seat) return beliefs;
  const b = beliefs.about[speaker];
  if (!b) return beliefs;

  b.claimedRole = claimedRole;
  if (!b.roleGuess) b.roleGuess = claimedRole;

  // Collision: two souls hard-claiming the same unique calling. One is lying.
  const collisions = Object.values(allClaims).filter((c) => c === claimedRole).length;
  if (collisions > 1) {
    b.evil += W.CLAIM_COLLISION;
    b.evidence.push({ w: W.CLAIM_COLLISION, why: `two souls claim ${label(claimedRole, { article: true })}`, phase: 'day' });
  }

  // A claim that contradicts my own hard knowledge is worth a great deal.
  for (const f of beliefs.hardFacts) {
    if (f.kind === 'warden-pair' && f.seats?.includes(speaker) && claimedRole !== f.role) {
      // Not necessarily a lie — but it narrows the pair.
      b.evil += 0.3;
    }
    if (f.kind === 'sworn-pair' && f.seats?.includes(speaker)) {
      b.evil += W.HARD_INFO * 0.3;
      b.evidence.push({ w: W.HARD_INFO * 0.3, why: 'my calling put them in a bad pair', phase: 'day' });
    }
  }
  return beliefs;
}

export function ingestAccusation(beliefs, { accuser, accused }) {
  if (accused === beliefs.seat) {
    const b = beliefs.about[accuser];
    if (b) {
      b.evil += W.ACCUSED_ME * (0.5 + beliefs.persona.paranoid);
      b.evidence.push({ w: W.ACCUSED_ME, why: 'they came for me', phase: 'day' });
    }
  }
  return beliefs;
}

export function ingestDeath(beliefs, state, { seat, cause }) {
  const b = beliefs.about[seat];
  if (!b) return beliefs;
  if (cause === 'unmade') {
    // The Hollow rarely eats its own. Weak evidence, correctly weighted as weak.
    b.evil -= W.SURVIVED_NIGHT * 2;
    b.evidence.push({ w: -W.SURVIVED_NIGHT * 2, why: 'the Hollow took them', phase: 'night' });
  }
  void state;
  return beliefs;
}

/**
 * Prune evidence never cited. Without this the record grows without bound over
 * a long game and every agent slowly becomes the same agent.
 */
export function pruneEvidence(beliefs, keep = 6) {
  for (const b of Object.values(beliefs.about)) {
    if (b.evidence.length <= keep) continue;
    const hard = b.evidence.filter((e) => e.hard);
    const soft = b.evidence.filter((e) => !e.hard)
      .sort((x, y) => Math.abs(y.w) - Math.abs(x.w))
      .slice(0, Math.max(0, keep - hard.length));
    b.evidence = [...hard, ...soft];
  }
  return beliefs;
}

/** Ranked suspicion over living souls. The vote reads this. */
export function ranked(beliefs, state) {
  return Object.values(beliefs.about)
    .filter((b) => state.seats[b.seat].alive)
    .map((b) => ({ ...b, score: b.evil }))
    .sort((a, b) => b.score - a.score);
}

/** The single strongest reason this agent distrusts a seat, for speech. */
export function topReason(beliefs, seat) {
  const b = beliefs.about[seat];
  if (!b || !b.evidence.length) return null;
  return b.evidence.slice().sort((x, y) => Math.abs(y.w) - Math.abs(x.w))[0];
}

export { W as EVIDENCE_WEIGHTS };
