/**
 * Guidance: suggested actions, strategic nudges, and the first-run tutorial.
 *
 * The design is split deliberately, because the evidence on game tutorials cuts
 * two ways and the distinction is where the whole thing lives.
 *
 * Andersen et al. (CHI 2012, ~45k players across Foldit / Refraction / Hello
 * Worlds) found:
 *   - tutorials pay off ONLY in complex games (Foldit: +29% playtime,
 *     +75% progress; negligible in the simple ones);
 *   - context-sensitive instruction AT THE MOMENT OF NEED beat upfront manuals
 *     (+40% completion) — again only in the complex game;
 *   - restricting player freedom until they perform the taught action showed
 *     NO learnability benefit, which is evidence against an on-rails tutorial;
 *   - on-demand help BUTTONS had a *negative* effect in the simpler games.
 *
 * VEILFALL is rules-heavy — Foldit-tier — so it sits in the arm where teaching
 * paid off. Hence two layers, not one:
 *
 *   PROCEDURAL (this file's `suggestion`) — what you CAN do right now. Pushed,
 *   on by default, one line. It restates the rule in force. Crucially it never
 *   shrinks the deduction space, so it cannot damage the game the way a
 *   strategic hint can. This is the layer that answers "I didn't know what I
 *   was supposed to do" — the single most repeated criticism of every
 *   comparable in this genre.
 *
 *   STRATEGIC (this file's `nudges`) — pulled, never pushed, and phrased as
 *   THE QUESTION THE PLAYER SHOULD BE ASKING rather than the answer. Per the
 *   hint-design consensus: restate before revealing, ask don't tell, and never
 *   narrow the possibility space for them.
 */

import { ROLES, label, TEAM } from '../engine/roles.js';
import { BEAT } from '../controller.js';

// ─────────────────────────────────────────────── PROCEDURAL SUGGESTIONS

/**
 * One line: what the player CAN do at this beat. Rule restatement only.
 * @returns {string|null}
 */
export function suggestion(beat, ctrl) {
  if (!ctrl) return null;
  const g = ctrl.game;
  const me = ctrl.me;
  const alive = g.living;

  switch (beat.kind) {
    case BEAT.REVEAL:
      return 'Read your calling, then step into the first Vespers. Nobody dies on the first night.';

    case BEAT.NIGHT_OPEN:
      return g.phase.number === 1
        ? 'Close your eyes. Your calling acts on its own if it has something to tell you.'
        : 'Close your eyes. If your calling acts tonight, you will be asked.';

    case BEAT.NIGHT_ACTION: {
      const a = beat.awaiting;
      const r = ROLES[a.roleId];
      if (a.roleId === 'glassreader') return 'Pick two souls. You learn only whether EITHER is the Hollow — not which.';
      if (a.roleId === 'wardsmith') return 'Pick one soul other than yourself. They cannot be Unmade tonight.';
      if (a.roleId === 'bondservant') return 'Pick a soul. Tomorrow you can only raise your hand if they raise theirs.';
      if (a.roleId === 'beastcaller') return 'You are dying. Pick one soul and you learn their calling on the way out.';
      return `Choose ${a.count === 1 ? 'one soul' : `${a.count} souls`} for the ${r?.name ?? 'your calling'}.`;
    }

    case BEAT.NIGHT_RESULT:
      return beat.reveal
        ? 'Write this down before you forget it. Tap any soul to open your notebook.'
        : 'Nothing came to you tonight. Not every calling speaks every night.';

    case BEAT.DAY_RECAP:
      return beat.recap?.deaths?.length
        ? 'The Archivist names the dead and nothing else — never how, never what they held.'
        : 'Nobody died. Somebody was protected, or the Hollow chose badly.';

    case BEAT.DISCOURSE:
      return me.alive
        ? 'Listen, take notes, whisper to anyone privately, or speak to the room. Call for Namings when you have heard enough.'
        : 'You are an Echo. You may still speak and whisper, but you may never Name.';

    case BEAT.NAMING_OPEN:
      return `You may Name one soul today, and each soul may be Named once. A Mark needs ${g.threshold()} of ${alive} living hands — and strictly more than whoever currently leads.`;

    case BEAT.NAMING_MADE:
      return 'Each Naming is voted on its own, in the order they were made.';

    case BEAT.VOTE: {
      const can = g.canVote(g.state.humanSeat);
      if (!can.ok && can.why === 'final-word-spent') return 'Your Final Word is spent. You watch this one.';
      if (!can.ok && can.why === 'bound-to-master') return `You are bound to ${ctrl.seats[can.master].name}. Your hand only counts if theirs goes up.`;
      if (!me.alive) return 'You hold one Final Word for the rest of the game. Spending it here spends it for good.';
      return `${beat.threshold} hands Marks them. Equalling the current leader clears the Mark instead — nobody is Sealed.`;
    }

    case BEAT.VOTE_RESULT:
      return beat.marked != null
        ? `${ctrl.seats[beat.marked].name} carries the Mark. A later Naming can still take it, or tie and clear it.`
        : 'No Mark stands right now.';

    case BEAT.SEALING:
      return beat.sealed != null
        ? 'The Archivist never says what a Sealed soul held. Only the Ash-Reader learns that.'
        : 'No Sealing today. That is one fewer chance to find the Hollow, and one more night for it.';

    case BEAT.ENDED:
      return 'Open the transparency view to see what each soul actually knew and believed.';

    default:
      return null;
  }
}

// ─────────────────────────────────────────────── STRATEGIC NUDGES

/**
 * Pulled, never pushed. Each returns a QUESTION, not an answer — the question
 * the player ought to be asking themselves. Ranked; the strongest available
 * one is offered. Deliberately never names a most-likely suspect, because a
 * hint that shrinks the possibility space is the kind that kills the game.
 */
const NUDGE_RULES = [
  {
    id: 'collision',
    weight: 10,
    test: (ctrl) => {
      const claims = ctrl.claims();
      const counts = {};
      for (const [seat, role] of Object.entries(claims)) {
        if (!ctrl.seats[seat]?.alive) continue;
        (counts[role] ||= []).push(seat);
      }
      const clash = Object.entries(counts).find(([, seats]) => seats.length > 1);
      return clash ? { role: clash[0], seats: clash[1] } : null;
    },
    ask: (ctrl, hit) =>
      `${hit.seats.map((s) => ctrl.seats[s].name).join(' and ')} have both claimed the ${label(hit.role)}. One of them is lying — which one's story is thinner?`,
  },
  {
    id: 'unclaimed',
    weight: 8,
    test: (ctrl) => {
      const quiet = ctrl.seats.filter((s) => s.alive && !s.isHuman && !ctrl.claims()[s.seat]);
      return quiet.length >= 2 ? { quiet } : null;
    },
    ask: (ctrl, hit) =>
      `${hit.quiet.length} souls still haven't said what they hold. Is that caution, or is it someone with nothing safe to claim?`,
  },
  {
    id: 'notebook-empty',
    weight: 9,
    test: (ctrl) => (Object.keys(ctrl.notes).length === 0 ? {} : null),
    ask: () =>
      'Your notebook is empty. Everyone at this table remembers every claim perfectly — do you?',
  },
  {
    id: 'survived',
    weight: 6,
    test: (ctrl) => {
      const day = ctrl.game.phase.number;
      if (day < 2) return null;
      const loud = ctrl.transcript().filter((l) => !l.human)
        .reduce((m, l) => { m[l.seat] = (m[l.seat] || 0) + 1; return m; }, {});
      const survivors = ctrl.seats.filter((s) => s.alive && !s.isHuman && (loud[s.seat] || 0) >= 3);
      return survivors.length ? { survivors } : null;
    },
    ask: () =>
      'Someone has been loud for two days and the Hollow has not touched them. Why would it leave a loud soul alive?',
  },
  {
    id: 'threshold',
    weight: 7,
    test: (ctrl) => (ctrl.game.state.day && ctrl.game.living <= 5 ? { n: ctrl.game.living } : null),
    ask: (ctrl, hit) =>
      `Only ${hit.n} still live. At two, the Gloaming wins outright — how many more Readings can you afford to spend on the wrong soul?`,
  },
  {
    id: 'no-sealing',
    weight: 5,
    test: (ctrl) => {
      const seals = ctrl.game.state.log.filter((e) => e.t === 'sealing');
      return seals.length >= 2 && seals.slice(-2).every((s) => s.seat == null) ? {} : null;
    },
    ask: () =>
      'Two Readings have ended with nobody Sealed. Who benefits from a table that never decides?',
  },
];

/** @returns {{id:string, text:string}|null} */
export function nudge(ctrl) {
  if (!ctrl) return null;
  const hits = [];
  for (const rule of NUDGE_RULES) {
    const hit = rule.test(ctrl);
    if (hit) hits.push({ rule, hit });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.rule.weight - a.rule.weight);
  const top = hits[0];
  return { id: top.rule.id, text: top.rule.ask(ctrl, top.hit) };
}

// ─────────────────────────────────────────────── FIRST-RUN TUTORIAL

/**
 * Contextual overlays on a REAL game, not a scripted rail.
 *
 * Each step fires the first time its mechanic actually appears, is shown once
 * ever, and never blocks the action behind it — the CHI-2012 result found that
 * restricting freedom until the player performs the taught action buys nothing.
 */
export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    when: (beat) => beat.kind === BEAT.REVEAL,
    title: 'One of them came through wrong',
    body: 'Nine souls were called through the Vellum Gate. One is the Hollow, and it will empty this hall one night at a time. Find it before it does. You have your calling, your notebook, and whatever the others are willing to tell you — which is not the same as the truth.',
  },
  {
    id: 'your-calling',
    when: (beat) => beat.kind === BEAT.REVEAL,
    title: 'This is yours alone',
    body: 'Only you can see this card. Everyone else has one too, and none of you can see each other\'s. Whether you tell the room what you hold — and whether you tell them the truth — is the whole game.',
  },
  {
    id: 'the-circle',
    when: (beat) => beat.kind === BEAT.NIGHT_OPEN,
    title: 'The Circle is not decoration',
    body: 'Where souls sit matters. Several callings read who is sitting NEXT to whom, and one of them reads only living neighbours — so a death changes what it tells you. Tap any soul to open your notebook on them.',
  },
  {
    id: 'notebook',
    when: (beat) => beat.kind === BEAT.DISCOURSE,
    title: 'Write it down',
    body: 'Your opponents remember every claim perfectly. Tap a soul to mark them Lantern or Gloaming, guess their calling, and keep a note. Your marks show as small glyphs on the Circle, and at the end the game scores how well you read the table.',
  },
  {
    id: 'whispers',
    when: (beat) => beat.kind === BEAT.DISCOURSE,
    title: 'Talk to them privately',
    body: 'Open any living soul and whisper. They answer only from what they actually know — or from the lie they have decided to tell. Everyone can see that a whisper happened; nobody but you can see what was said.',
  },
  {
    id: 'naming',
    when: (beat) => beat.kind === BEAT.NAMING_OPEN,
    title: 'A Naming is not a vote',
    body: 'Naming a soul only opens the question. Each Naming gets its own Tally, and they resolve in the order they were made. You may Name once per Reading, and each soul may be Named once.',
  },
  {
    id: 'tally',
    when: (beat) => beat.kind === BEAT.VOTE,
    title: 'The rule that decides everything',
    body: 'To take the Mark, a Naming needs at least half the living hands AND strictly more than whoever currently leads. Equal the leader and the Mark CLEARS — nobody is Sealed at all. One Sealing per day, at the end.',
  },
  {
    id: 'echo',
    when: (beat, ctrl) => beat.kind === BEAT.DAY_RECAP && !ctrl.me.alive,
    title: 'You are an Echo now',
    body: 'Death is not the end here. You keep your information, you can still speak and whisper, and you hold one Final Word — a single vote for the rest of the game. You may never Name again. Spend the Word well.',
  },
];

/** Steps that should fire at this beat and have not been seen. */
export function pendingTutorial(beat, ctrl, seen = []) {
  return TUTORIAL_STEPS.filter((s) => !seen.includes(s.id) && s.when(beat, ctrl));
}

export { TEAM };
