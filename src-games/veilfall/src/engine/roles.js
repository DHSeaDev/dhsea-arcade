/**
 * VEILFALL — First Codex: The Quiet Ward
 *
 * 22 original roles. Mechanics are the standard hidden-role deduction set;
 * every name and every line of ability text here is original to this project.
 *
 * TEAMS:  lantern (good) | gloaming (evil)
 * TYPES:  warden (powered good) | stray (hindering good) | sworn (evil support) | hollow (evil win-con)
 *
 * WAKE:
 *   'first'    — acts on the first Vespers only
 *   'other'    — acts on every Vespers except the first
 *   'each'     — acts on every Vespers including the first
 *   'reactive' — woken by an event, not by the night order
 *   'none'     — never woken; passive or day-active
 *
 * TARGETS: how many seats the acting player selects. 0 = information only.
 */

export const TEAM = { LANTERN: 'lantern', GLOAMING: 'gloaming' };
export const TYPE = { WARDEN: 'warden', STRAY: 'stray', SWORN: 'sworn', HOLLOW: 'hollow' };

/** @type {Record<string, any>} */
export const ROLES = {
  // ─────────────────────────── WARDENS (13) ───────────────────────────
  threadreader: {
    id: 'threadreader', name: 'Threadreader', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'first', targets: 0, firstOrder: 32,
    ability: 'On the first Vespers, you are shown two souls and one Warden calling. One of those two holds it.',
    flavour: 'She reads the threads of fate where they cross, and knows which of two hands holds the loom.',
  },
  cataloguer: {
    id: 'cataloguer', name: 'Cataloguer', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'first', targets: 0, firstOrder: 33,
    ability: 'On the first Vespers, you are shown two souls and one Stray calling — or told that no Stray walks here.',
    flavour: 'Every soul through the Gate is indexed. Some entries are marked with a small, worrying asterisk.',
  },
  inquisitor: {
    id: 'inquisitor', name: 'Inquisitor', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'first', targets: 0, firstOrder: 34,
    ability: 'On the first Vespers, you are shown two souls and one Sworn calling. One of those two holds it.',
    flavour: 'He does not accuse. He simply narrows the room until only one door is left.',
  },
  hearthkeeper: {
    id: 'hearthkeeper', name: 'Hearthkeeper', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'first', targets: 0, firstOrder: 35,
    ability: 'On the first Vespers, learn how many pairs of neighbouring souls are both Gloaming.',
    flavour: 'She counts the chairs pulled too close together and says nothing at the time.',
  },
  resonant: {
    id: 'resonant', name: 'Resonant', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'each', targets: 0, firstOrder: 36, otherOrder: 60,
    ability: 'Each Vespers, learn how many of your two living neighbours are Gloaming.',
    flavour: 'The ward hums differently beside the wrong kind of quiet.',
  },
  glassreader: {
    id: 'glassreader', name: 'Glassreader', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'each', targets: 2, firstOrder: 37, otherOrder: 61,
    ability: 'Each Vespers, choose two souls. Learn whether either is the Hollow. One Lantern soul will always read true to you.',
    flavour: 'The glass never lies. It is merely, in one specific place, wrong.',
  },
  ashReader: {
    id: 'ashReader', name: 'Ash-Reader', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'other', targets: 0, otherOrder: 62,
    ability: 'Each Vespers after the first, learn the calling of the soul Sealed during the day just ended.',
    flavour: 'What the seal burns away, she reads in what is left.',
  },
  wardsmith: {
    id: 'wardsmith', name: 'Wardsmith', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'other', targets: 1, otherOrder: 20,
    ability: 'Each Vespers after the first, choose a soul other than yourself. They cannot be Unmade tonight.',
    flavour: 'One line of chalk, drawn well, holds against a great deal.',
  },
  beastcaller: {
    id: 'beastcaller', name: 'Beastcaller', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'reactive', targets: 1, otherOrder: 50,
    ability: 'If you are Unmade at night, wake once and learn one soul\'s calling.',
    flavour: 'Something with too many wings was already awake, and it tells her as she goes.',
  },
  oathbound: {
    id: 'oathbound', name: 'Oathbound', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'none', targets: 0,
    ability: 'The first time a Warden Names you, that Warden is Sealed at once.',
    flavour: 'The oath is older than the court and considerably less patient.',
  },
  hexbreaker: {
    id: 'hexbreaker', name: 'Hexbreaker', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'none', targets: 1, dayAction: true,
    ability: 'Once per game, during the Reading, publicly choose a soul. If they are the Hollow, they die.',
    flavour: 'One shot, one word, and the whole room watching. Best not to be wrong.',
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'none', targets: 0,
    ability: 'The Hollow cannot Unmake you.',
    flavour: 'It came for him twice. It has stopped trying.',
  },
  chancellor: {
    id: 'chancellor', name: 'Chancellor', team: TEAM.LANTERN, type: TYPE.WARDEN,
    wake: 'none', targets: 0,
    ability: 'If only three souls live and the day ends with no Sealing, Lantern wins. If you would die at night, the Archivist may take another instead.',
    flavour: 'He is not brave. He is simply extremely difficult to remove from a room.',
  },

  // ─────────────────────────── STRAYS (4) ───────────────────────────
  bondservant: {
    id: 'bondservant', name: 'Bondservant', team: TEAM.LANTERN, type: TYPE.STRAY,
    wake: 'each', targets: 1, firstOrder: 40, otherOrder: 70,
    ability: 'Each Vespers, choose a soul. Tomorrow, you may only raise your hand if they raise theirs.',
    flavour: 'The contract was signed in a hurry and read afterwards.',
  },
  mistaken: {
    id: 'mistaken', name: 'The Mistaken', team: TEAM.LANTERN, type: TYPE.STRAY,
    wake: 'none', targets: 0, hidden: true,
    ability: 'You do not know you are the Mistaken. You believe you hold a Warden calling, and everything it tells you may be false.',
    flavour: 'The summoning took. Something else did not.',
  },
  wraithTouched: {
    id: 'wraithTouched', name: 'Wraith-Touched', team: TEAM.LANTERN, type: TYPE.STRAY,
    wake: 'none', targets: 0,
    ability: 'You may read as Gloaming, and as a Sworn or the Hollow, though you are Lantern.',
    flavour: 'Something followed her through and never entirely left.',
  },
  sanctified: {
    id: 'sanctified', name: 'The Sanctified', team: TEAM.LANTERN, type: TYPE.STRAY,
    wake: 'none', targets: 0,
    ability: 'If you are Sealed, Lantern loses.',
    flavour: 'The ward is anchored to him. Burn the anchor, lose the ward.',
  },

  // ─────────────────────────── SWORN (4) ───────────────────────────
  blightbinder: {
    id: 'blightbinder', name: 'Blightbinder', team: TEAM.GLOAMING, type: TYPE.SWORN,
    wake: 'each', targets: 1, firstOrder: 10, otherOrder: 10,
    ability: 'Each Vespers, choose a soul. They are Blighted tonight and through tomorrow — what their calling tells them may be false.',
    flavour: 'A little rot in the right thread and the whole weave reads wrong.',
  },
  veilwalker: {
    id: 'veilwalker', name: 'Veilwalker', team: TEAM.GLOAMING, type: TYPE.SWORN,
    wake: 'each', targets: 0, firstOrder: 31, otherOrder: 31,
    ability: 'Each Vespers, you see the Registry entire. You may read as Lantern, and as a Warden or Stray.',
    flavour: 'He was given a key by mistake and has never mentioned it.',
  },
  successor: {
    id: 'successor', name: 'The Successor', team: TEAM.GLOAMING, type: TYPE.SWORN,
    wake: 'none', targets: 0,
    ability: 'If the Hollow dies while five or more souls live, you become the Hollow.',
    flavour: 'She has been standing close to it, patiently, for some time.',
  },
  riftwarden: {
    id: 'riftwarden', name: 'Riftwarden', team: TEAM.GLOAMING, type: TYPE.SWORN,
    wake: 'none', targets: 0, setupModifier: true,
    ability: 'Setup: two more Strays walk here, and two fewer Wardens.',
    flavour: 'He widened the Gate a little. Things came through that were not called.',
  },

  // ─────────────────────────── THE HOLLOW (1) ───────────────────────────
  hollowOne: {
    id: 'hollowOne', name: 'The Hollow One', team: TEAM.GLOAMING, type: TYPE.HOLLOW,
    wake: 'other', targets: 1, otherOrder: 40,
    ability: 'Each Vespers after the first, choose a soul: they are Unmade. Choose yourself, and a Sworn rises in your place.',
    flavour: 'It wore a name at the Gate. It does not remember which one.',
  },
};

export const ROLE_IDS = Object.keys(ROLES);

/** @param {string} id */
export const role = (id) => {
  const r = ROLES[id];
  if (!r) throw new Error(`Unknown role: ${id}`);
  return r;
};

export const rolesOfType = (t) => ROLE_IDS.filter((id) => ROLES[id].type === t);

/**
 * Article-safe display name. Four callings carry "The" in their own name
 * ("The Mistaken", "The Hollow One"); naive `the ${name}` interpolation
 * produced "the The Mistaken" in shipped speech.
 */
export function label(id, { article = false } = {}) {
  const n = ROLES[id]?.name ?? String(id);
  const bare = n.replace(/^The /, '');
  return article ? (n.startsWith('The ') ? `the ${bare}` : `the ${bare}`) : bare;
}
export const isEvilRole = (id) => ROLES[id].team === TEAM.GLOAMING;

/**
 * Night order. Built from the role table itself so the two can never drift apart.
 * Non-role steps (team info, bluffs) are interleaved at fixed slots.
 */
export const FIRST_NIGHT_STEPS = [
  { kind: 'setup', order: 1, id: 'setupModifiers' },
  { kind: 'info', order: 20, id: 'swornMeet' },   // Sworn learn each other + the Hollow
  { kind: 'info', order: 21, id: 'hollowMeet' },  // Hollow learns Sworn + receives bluffs
  ...ROLE_IDS.filter((id) => ROLES[id].firstOrder != null)
    .map((id) => ({ kind: 'role', order: ROLES[id].firstOrder, id })),
].sort((a, b) => a.order - b.order);

export const OTHER_NIGHT_STEPS = [
  ...ROLE_IDS.filter((id) => ROLES[id].otherOrder != null && ROLES[id].wake !== 'first')
    .map((id) => ({ kind: 'role', order: ROLES[id].otherOrder, id })),
].sort((a, b) => a.order - b.order);
