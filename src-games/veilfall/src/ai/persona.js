/**
 * Opponent personas.
 *
 * Fixed at game start and never regenerated — research reports degenerate,
 * identical personalities when persona is re-derived per turn, and style tells
 * when one agent's register drifts away from the rest.
 *
 * Four independent axes, each 0..1. They shape WHEN and HOW an agent speaks,
 * never WHAT is true. Voice is cosmetic; the belief record decides behaviour.
 */

export const AXES = ['talkative', 'paranoid', 'assertive', 'precise'];

const EPITHETS = [
  'of the Ninth Seal', 'Warden-Second', 'of the Lantern Yard', 'Late of the Spire',
  'of the Long Stair', 'Gate-Marshal', 'of the Quiet Archive', 'Second Signatory',
  'of the Broken Ward', 'Tally-Bearer', 'of the Vellum Gate', 'Unmarked',
];

/**
 * @param {*} rng
 * @param {number} seat
 * @param {{coordination?:number}} [difficulty]
 */
export function makePersona(rng, seat, difficulty = {}) {
  // Spread the axes rather than clustering at the mean — identical agents are
  // the documented failure, and a normal distribution manufactures them.
  const spread = () => Math.round(rng.next() * 100) / 100;
  const p = {
    seat,
    talkative: spread(),
    paranoid: spread(),
    assertive: spread(),
    precise: spread(),
    epithet: rng.pick(EPITHETS),
  };

  // Verbosity budget in sentences — capped uniformly across both teams so
  // length is never a tell for alignment.
  p.sentenceBudget = 1 + Math.round(p.talkative * 2);

  // How readily this agent revises a belief when contradicted.
  p.stubbornness = 0.25 + p.assertive * 0.5;

  void difficulty;
  return p;
}

/** Does this agent speak this round? Talkative agents speak more, not louder. */
export function willSpeak(persona, rng, { pressure = 0 } = {}) {
  const p = 0.25 + persona.talkative * 0.6 + pressure * 0.3;
  return rng.chance(Math.min(0.95, p));
}

/** How eagerly this agent opens a Naming. */
export function namingAppetite(persona) {
  return persona.assertive * 0.6 + persona.paranoid * 0.4;
}
