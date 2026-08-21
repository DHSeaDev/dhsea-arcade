/**
 * Speech: intent first, phrasing second.
 *
 * This is CICERO's split. The engine computes a structured INTENT from the
 * belief record; only then is that intent turned into words. Tier 1 renders it
 * from templates; Tier 2 hands the same intent to a model to phrase. Because
 * the intent is computed identically either way, the model can change how a
 * sentence reads and can never change what an agent believes, claims or does.
 *
 * Every template slot is filled from the permitted-facts set, so Tier 1 output
 * is leak-free by construction rather than by inspection.
 */

import { ROLES, TEAM, TYPE, label } from '../engine/roles.js';
import { ranked, topReason } from './beliefs.js';

const pickBy = (rng, arr) => arr[rng.int(arr.length)];

// ── Intent computation ───────────────────────────────────────────────────────

/**
 * What does this agent want to say right now?
 * @returns {object|null} intent
 */
export function computeIntent(beliefs, state, rng, ctx = {}) {
  const me = state.seats[beliefs.seat];
  if (!me.alive && ctx.phase !== 'echo') return null;

  const isEvil = beliefs.team === TEAM.GLOAMING;
  const claimRole = isEvil ? beliefs.bluff : beliefs.knownRole;
  const suspicions = ranked(beliefs, state);
  const top = suspicions[0];
  const hasClaimed = beliefs.commitments.some((c) => c.kind === 'claim');
  const day = state.day?.number ?? 1;

  // ── Opening claim. Timing is staggered by persona so the whole table does
  // not claim on turn one — the measured failure where every agent announces
  // itself simultaneously.
  if (!hasClaimed) {
    const eagerness = beliefs.persona.assertive * 0.5 + beliefs.persona.talkative * 0.5;
    const dayPressure = (day - 1) * 0.35;
    if (rng.chance(Math.min(0.9, eagerness * 0.5 + dayPressure + 0.15))) {
      let withInfo = null;
      if (!isEvil && beliefs.hardFacts.length) {
        withInfo = beliefs.hardFacts[beliefs.hardFacts.length - 1];
      } else if (isEvil) {
        withInfo = fabricateInfo(beliefs, state, rng);
        // A lie told out loud becomes something this agent must live with.
        // Recording it as a (flagged) hard fact does two jobs at once: the
        // legality filter now recognises the claim as one this soul is
        // entitled to make, and the agent will not contradict its own bluff
        // three turns later — cross-turn contradiction is a measured failure
        // mode, not a hypothetical one.
        if (withInfo) beliefs.hardFacts.push({ ...withInfo, fabricated: true });
      }
      return { kind: 'claim', speaker: beliefs.seat, role: claimRole, withInfo };
    }
  }

  // ── Evil: protect the Hollow by steering suspicion onto a good soul.
  if (isEvil && top) {
    const hollowSeat = Object.entries(beliefs.about)
      .find(([, b]) => b.evil === 10 && b.roleGuess && ROLES[b.roleGuess]?.type === TYPE.HOLLOW);
    const hollowUnderFire = hollowSeat
      && state.day?.namings?.some((n) => n.nominee === +hollowSeat[0] && !n.resolved);
    const goodTargets = suspicions.filter((s) => beliefs.about[s.seat].evil < 10);
    if (goodTargets.length && (hollowUnderFire || rng.chance(0.45))) {
      return {
        kind: 'accuse',
        speaker: beliefs.seat,
        target: pickBy(rng, goodTargets.slice(0, 3)).seat,
        reason: null, // evil has no honest reason; the template supplies pressure
        deflecting: !!hollowUnderFire,
      };
    }
  }

  // ── Good: press the strongest suspicion, if it is strong enough to be worth
  // saying out loud.
  if (!isEvil && top && top.score > 1.2) {
    const reason = topReason(beliefs, top.seat);
    if (rng.chance(0.35 + beliefs.persona.assertive * 0.45)) {
      return { kind: 'accuse', speaker: beliefs.seat, target: top.seat, reason };
    }
  }

  // ── Defend a soul this agent trusts and someone else has come for.
  const underFire = state.day?.namings?.filter((n) => !n.resolved).map((n) => n.nominee) ?? [];
  const trusted = suspicions.filter((s) => s.score < -1);
  const toDefend = trusted.find((t) => underFire.includes(t.seat));
  if (toDefend && rng.chance(0.5)) {
    return { kind: 'defend', speaker: beliefs.seat, target: toDefend.seat };
  }

  // ── Otherwise: hedge, ask, or note the state of the table.
  const moods = ['hedge', 'question', 'observe'];
  const mood = beliefs.persona.precise > 0.6 ? pickBy(rng, ['observe', 'question'])
    : pickBy(rng, moods);
  return {
    kind: mood,
    speaker: beliefs.seat,
    target: top ? top.seat : null,
    living: state.seats.filter((s) => s.alive).length,
  };
}

/** An evil agent's fabricated supporting detail. Deterministic, near-miss. */
function fabricateInfo(beliefs, state, rng) {
  const bluff = beliefs.bluff;
  const others = Object.values(beliefs.about).filter((b) => state.seats[b.seat].alive);
  if (!others.length) return null;
  const good = others.filter((b) => b.evil < 10);
  const pool = good.length ? good : others;

  switch (bluff) {
    case 'resonant':
      return { kind: 'evil-pairs-claim', count: rng.pick([0, 1, 1]) };
    case 'threadreader':
    case 'inquisitor':
    case 'cataloguer': {
      const two = rng.sample(pool.map((b) => b.seat), 2);
      return { kind: bluff === 'inquisitor' ? 'sworn-pair' : 'warden-pair', seats: two, role: bluff === 'inquisitor' ? 'blightbinder' : 'bulwark' };
    }
    case 'hearthkeeper':
      return { kind: 'evil-pairs', count: rng.pick([0, 1]) };
    case 'glassreader':
      return { kind: 'glass', targets: rng.sample(pool.map((b) => b.seat), 2), yes: rng.chance(0.3) };
    default:
      return null;
  }
}

/**
 * An evidence string is only safe to splice into an accusation if it names no
 * calling. Pair-info reasons ("one of these two is the Blightbinder") are true
 * and legal on their own, but the accusation frame ("Ilva — <reason>") rewrites
 * them into a binding assertion about ONE soul, which the speaker cannot make.
 * Shipped as a live defect before the legality filter caught it.
 */
function safeReason(reason) {
  if (!reason?.why) return null;
  const w = reason.why.toLowerCase();
  for (const meta of Object.values(ROLES)) {
    if (w.includes(meta.name.toLowerCase().replace(/^the /, ''))) return null;
  }
  return reason.why;
}

// ── Tier 1 rendering ─────────────────────────────────────────────────────────

const nameOf = (state, seat) => state.seats[seat]?.name ?? 'someone';
const roleName = (id) => label(id);

const T = {
  claim: [
    ({ r }) => `I hold the ${r}.`,
    ({ r }) => `I'll say it plainly — I'm the ${r}.`,
    ({ r }) => `The ${r}. That's me. Do with it what you like.`,
    ({ r }) => `Before this gets away from us: ${r}, here.`,
  ],
  claimPrecise: [
    ({ r }) => `I'm the ${r}, and I'd rather be on the record early than convenient later.`,
    ({ r }) => `${r}. I'll be consistent about it, so hold me to it.`,
  ],
  accuse: [
    ({ n }) => `I don't like ${n}.`,
    ({ n }) => `${n} is where I'd put my hand.`,
    ({ n }) => `Something's off about ${n}.`,
    ({ n }) => `I want ${n} to talk more, and I want it to be worse for them.`,
  ],
  // Only ever spliced with a reason that names no calling — see safeReason().
  accuseWithReason: [
    ({ n, why }) => `${n} — ${why}. That's enough for me.`,
    ({ n, why }) => `Look at ${n}. ${why}.`,
    ({ n, why }) => `${why}. So: ${n}.`,
  ],
  accuseDeflect: [
    ({ n }) => `We're about to spend the day on the wrong soul. It's ${n}.`,
    ({ n }) => `Everyone's looking the wrong way. ${n}.`,
    ({ n }) => `Slow down. ${n} has been quietly steering this the whole time.`,
  ],
  defend: [
    ({ n }) => `Not ${n}. I'd stake something on it.`,
    ({ n }) => `${n} reads clean to me. Spend the Sealing elsewhere.`,
    ({ n }) => `If ${n} is Gloaming I'll eat the ward.`,
  ],
  hedge: [
    () => `I don't have enough yet.`,
    () => `I'd rather wait one more Vespers than Seal wrong.`,
    () => `Nothing I'd defend in front of the Gate.`,
  ],
  question: [
    ({ n }) => `${n}, what did your night look like?`,
    ({ n }) => `Has anyone actually heard ${n} say anything?`,
    () => `Who's claiming, and who's waiting to see what's safe?`,
  ],
  observe: [
    ({ living }) => `${living} of us left. That number should be making someone nervous.`,
    () => `Two claims and no collisions yet. That won't hold.`,
    ({ living }) => `We can afford one bad Sealing. Not two, not at ${living}.`,
  ],
};

const INFO_LINE = {
  'warden-pair': (state, f) =>
    `One of ${nameOf(state, f.seats[0])} or ${nameOf(state, f.seats[1])} holds the ${roleName(f.role)}.`,
  'sworn-pair': (state, f) =>
    `One of ${nameOf(state, f.seats[0])} or ${nameOf(state, f.seats[1])} is the ${roleName(f.role)}.`,
  'stray-pair': (state, f) =>
    `One of ${nameOf(state, f.seats[0])} or ${nameOf(state, f.seats[1])} is the ${roleName(f.role)}.`,
  'no-strays': () => `No Stray walks here. That matters.`,
  'evil-pairs': (state, f) => `${f.count === 0 ? 'No' : f.count} pair${f.count === 1 ? '' : 's'} of neighbours read Gloaming to me.`,
  'evil-pairs-claim': (state, f) => `${f.count} of my neighbours is Gloaming.`,
  'sealed-role': (state, f) => `${nameOf(state, f.seat)} held the ${roleName(f.role)}.`,
  glass: (state, f) =>
    `I read ${nameOf(state, f.targets[0])} and ${nameOf(state, f.targets[1])}. The glass ${f.yes ? 'lit' : 'stayed dark'}.`,
};

/**
 * Render an intent as Tier 1 speech. Deterministic given the RNG.
 *
 * `opts.avoid` is a Set of lines already said this day. Two agents drawing the
 * same template on the same day is the single most believability-destroying
 * thing Tier 1 does — word-for-word echo reads as a bug, not as agreement, and
 * it was visible in a store capture. The bank is redrawn a few times before
 * giving up; giving up is correct rather than fabricating a line off-bank.
 *
 * @param {object} [opts]
 * @param {Set<string>} [opts.avoid]
 * @returns {{text:string, intent:object}}
 */
export function renderIntent(intent, beliefs, state, rng, opts = {}) {
  if (!intent) return null;
  const avoid = opts.avoid;
  let out = renderOnce(intent, beliefs, state, rng);
  if (!avoid) return out;
  for (let i = 0; i < 8 && out && avoid.has(out.text); i++) {
    out = renderOnce(intent, beliefs, state, rng);
  }
  // Bank exhausted for this intent today. Staying quiet is the right answer:
  // it is indistinguishable from the persona simply not speaking this round,
  // whereas an echo is a visible defect.
  if (out && avoid.has(out.text)) return null;
  if (out) avoid.add(out.text);
  return out;
}

function renderOnce(intent, beliefs, state, rng) {
  const p = beliefs.persona;
  let text;

  switch (intent.kind) {
    case 'claim': {
      const bank = p.precise > 0.65 ? T.claimPrecise : T.claim;
      text = pickBy(rng, bank)({ r: roleName(intent.role) });
      if (intent.withInfo) {
        const fn = INFO_LINE[intent.withInfo.kind];
        if (fn) text += ` ${fn(state, intent.withInfo)}`;
      }
      break;
    }
    case 'accuse': {
      const n = nameOf(state, intent.target);
      if (intent.deflecting) text = pickBy(rng, T.accuseDeflect)({ n });
      else if (safeReason(intent.reason)) text = pickBy(rng, T.accuseWithReason)({ n, why: intent.reason.why });
      else text = pickBy(rng, T.accuse)({ n });
      break;
    }
    case 'defend':
      text = pickBy(rng, T.defend)({ n: nameOf(state, intent.target) });
      break;
    case 'question':
      text = pickBy(rng, T.question)({ n: intent.target != null ? nameOf(state, intent.target) : 'anyone' });
      break;
    case 'observe':
      text = pickBy(rng, T.observe)({ living: intent.living });
      break;
    default:
      text = pickBy(rng, T.hedge)({});
  }

  // Verbosity budget — capped uniformly across both teams so sentence length
  // is never a tell for alignment.
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length > p.sentenceBudget) {
    text = sentences.slice(0, p.sentenceBudget).join(' ');
  }
  return { text, intent };
}

/** Record what an agent committed to publicly, so it cannot contradict itself. */
export function commit(beliefs, intent, state) {
  if (!intent) return;
  if (intent.kind === 'claim') {
    beliefs.commitments.push({ kind: 'claim', role: intent.role, day: state.day?.number ?? 0 });
  }
  if (intent.kind === 'accuse') {
    beliefs.commitments.push({ kind: 'accuse', target: intent.target, day: state.day?.number ?? 0 });
  }
  if (intent.kind === 'defend') {
    beliefs.commitments.push({ kind: 'defend', target: intent.target, day: state.day?.number ?? 0 });
  }
}

export { TEAM, TYPE };
