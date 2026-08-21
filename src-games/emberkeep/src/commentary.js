// Emberkeep — Ember talks. Authored lines, trigger table, no model call.
// D10: the no-network law forbids an LLM, and a canned table is also the only version
// that can be tested deterministically.
//
// TONE RULE (written before the lines, so the lines can't drift):
//   Ember is funny BECAUSE he is anxious, not because he is clever. Gallows humour from
//   someone apologising to furniture. No quips, no winks, no self-aware jokes about being
//   in a video game. He is a small fire that would rather not.
//
// Pools never repeat until exhausted. RARE lines fire at low probability and are the ones
// people screenshot — that only works if they stay rare, so nothing here "helps" them along.

const POOLS = {
  room_start: [
    "Okay. New room. Nothing in here is my fault yet.",
    "I'll be careful. I say that a lot.",
    "Right. Let's not touch anything.",
    "Deep breath. I don't breathe. Whatever.",
    "It's very flammable in here. That's just an observation.",
    "New room, same me, unfortunately.",
  ],
  first_burn: [
    "Oh. Oh no. I didn't— it just went up.",
    "That wasn't on purpose. That was proximity.",
    "See, this is exactly what I was worried about.",
  ],
  burn: [
    "Sorry. Sorry. Sorry.",
    "I'm not going to justify that one.",
    "It was in the way. That's not a reason, I know.",
    "Well. It's warmer now.",
    "I could have gone around. I know I could have gone around.",
    "Don't look at me like that. You pressed it.",
  ],
  burn_spread: [
    "It spread. It always spreads. I keep forgetting it spreads.",
    "That was more than I meant. That's always more than I meant.",
    "One. I touched ONE.",
  ],
  took_drop: [
    "Oh, that's nice.",
    "Thank you. Genuinely.",
    "I can see further now. Mixed blessing.",
    "That helps. That really helps.",
  ],
  low_fuel: [
    "Getting dim. Not dying — just dim. There's a difference and it matters to me.",
    "I can't see much. I'm still here though.",
    "Small now. Still going.",
  ],
  fell: [
    "I'm fine. Fire doesn't bruise.",
    "That was a choice I made.",
    "Back to the start. The start is fine.",
  ],
  phantom: [
    "It's only there when I look at it. I hate that.",
    "Trust the floor, he said. To himself. Out loud.",
    "That held. That held!",
  ],
  near_exit: [
    "That's the way out. That's actually the way out.",
    "Almost. Don't celebrate. Don't— okay, a little.",
  ],
  clear_clean: [
    "I didn't burn anything. I want that written down.",
    "Nothing lost. That's a good room.",
    "Clean. That one was clean.",
    "See? I can just... exist. Sometimes.",
  ],
  clear_burned: [
    "I got through. Something didn't.",
    "That worked. I'd rather it hadn't.",
    "Made it. Left a mark.",
  ],
  startled: [
    "AH— it touched me. It TOUCHED me.",
    "I'm okay. I'm okay. I'm smaller, but I'm okay.",
    "Why does everything down here have so many legs.",
    "It's more scared of me than— no. No, it isn't.",
    "I nearly went out. I didn't. But I nearly did.",
  ],
  shot: [
    "Go on. Shoo. I don't want to do this.",
    "That's a warning. That's all that was.",
    "I hate that I'm good at this.",
  ],
  web: [
    "It's silk. It'll go up like nothing. That's the problem.",
    "Someone lives here. Someone made this.",
    "I could get through in a second. That's not the same as should.",
  ],
  shard: [
    "A piece of something. It's warm.",
    "Oh, that's pretty. I'm keeping it.",
    "Someone dropped this. Ages ago, I think.",
  ],
  cache: [
    "There was something HERE. Hidden. For me?",
    "Nobody's touched this in a very long time.",
    "I found it. I actually found it.",
  ],
  going_out: [
    "I'm going out. I'm going out— find me something, quickly.",
    "Not like this. Not yet. Please.",
    "It's getting cold. I've never been cold.",
  ],
  saved: [
    "Oh thank— oh. Oh, that was close.",
    "I'm back. I'm back. Don't do that again.",
    "Still here. Still here.",
  ],
  went_out: [
    "...oh.",
    "It's alright. We can start again.",
    "I went out. It's quiet in here.",
  ],
  rat: [
    "It's fine. It lives here. I'm the one who turned up.",
    "Hello— no. Alright. Off it goes.",
    "Everything runs from me. Everything. Even the small ones.",
    "I wasn't going to DO anything.",
  ],
  crow: [
    "It's looking at me. It has been looking at me for a while.",
    "I know. I KNOW. I'm working on it.",
    "Birds have never liked me. It's the obvious reason.",
  ],
  outside: [
    "Oh — it's open. It's actually open up there.",
    "Wind. I don't love wind, but look at it.",
    "You can see so far when nothing is in the way.",
  ],
  final: [
    "There's nothing in here. Nothing to catch.",
    "I could just... stand. For a bit. Would that be alright?",
    "I made it all this way and I'm still here. Both of those.",
  ],
  rat_bold: [
    "This one isn't running. Why isn't it running?",
    "Oh. Oh, you're just cold, aren't you.",
    "You can — yes. Alright. You can sit there.",
    "Nobody sits next to me. That's sort of the whole thing.",
    "Don't tell the others. Actually, do.",
  ],
  hearth: [
    "Someone was here. Someone like me was here.",
    "That's a hearth. That's a cold hearth.",
    "It went out. It just... went out, and nobody came.",
    "I don't want to look at it and I can't stop looking at it.",
  ],
  scorch: [
    "That's not mine. That mark is older than me.",
    "Someone else lost their temper here.",
    "So it wasn't just me. That's not as comforting as I hoped.",
  ],
  tally: [
    "Scratches. Someone counted. Someone counted a lot.",
    "They stopped at forty-one. I'd rather not think about why.",
    "Somebody waited in here long enough to keep score.",
  ],
  idle: [
    "Take your time. I'm not on a timer. I've checked.",
    "It's quiet. I like quiet.",
    "We can just stand here. That's allowed.",
  ],
  rare: [
    "Do you think the wood knows? Before, I mean.",
    "I was somebody's lamp once. It was steady work.",
    "If I went out, would it be quiet, or would it be nothing? Sorry. Sorry, that's heavy.",
    "I've never been cold. I think about it a lot.",
    "Everyone's very glad to see me until they aren't.",
  ],
};

const RARE_CHANCE = 0.045;   // ~1 in 22 eligible beats
const RARE_TRIGGERS = new Set(['room_start', 'idle', 'took_drop']);

export class Commentary {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.bags = {};
    this.lastFired = -1e9;
    this.line = null;
    this.lineAt = -1e9;
    this.log = [];          // transcript, newest last — the rail renders the tail of this
  }

  say(line, t) {            // used for memory lines, which bypass the pools
    if (!line) return null;
    this.line = line; this.lineAt = t; this.lastFired = t;
    this.log.push(line);
    if (this.log.length > 60) this.log.shift();
    return line;
  }

  _draw(pool) {
    if (!this.bags[pool] || this.bags[pool].length === 0) {
      this.bags[pool] = shuffle(POOLS[pool].slice(), this.rng);
    }
    return this.bags[pool].pop();
  }

  // t = frame counter. cooldown keeps Ember from talking over himself.
  fire(trigger, t, { cooldown = 90, force = false } = {}) {
    if (!POOLS[trigger]) return null;
    if (!force && t - this.lastFired < cooldown) return null;
    const pool = (RARE_TRIGGERS.has(trigger) && this.rng() < RARE_CHANCE) ? 'rare' : trigger;
    const line = this._draw(pool);
    this.line = line;
    this.lineAt = t;
    this.lastFired = t;
    this.log.push(line);
    if (this.log.length > 60) this.log.shift();
    return line;
  }

  // Lines land in dead time and linger; nobody reads during a jump.
  visible(t, hold = 260) {
    if (!this.line) return null;
    if (t - this.lineAt > hold) return null;
    return this.line;
  }
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- memory: lines that only make sense because of what already happened this run.
// Chosen by predicate against the run tally, so Ember refers to YOUR run rather than reciting.
const MEMORIES = [
  { id: 'clean_streak', when: m => m.roomsDone >= 3 && m.burned === 0,
    lines: ["Three rooms. Nothing burned. I'm keeping count, obviously.",
            "I've not damaged a single thing yet. Don't jinx it.",
            "So far, so... intact."] },
  { id: 'first_scorch', when: m => m.burned > 0 && m.burned <= 3 && m.roomsDone >= 1,
    lines: ["I'm still thinking about that thing I burned.",
            "One. It was one thing. I'm allowed to still be thinking about it."] },
  { id: 'many_burned', when: m => m.burned >= 12,
    lines: [() => "I've left a lot behind me now. I've stopped saying sorry out loud.",
            () => "There's a trail of me back there. Literally."] },
  { id: 'went_out', when: m => m.outs >= 1,
    lines: ["I went out once already. I'd rather not do it twice.",
            "I remember going out. I don't want to talk about it."] },
  { id: 'been_startled', when: m => m.startles >= 3,
    lines: ["Something's touched me three times now. Three.",
            "I'm jumpy. I've earned being jumpy."] },
  { id: 'collector', when: m => m.shards >= 6,
    lines: ["I'm carrying quite a lot of other people's things.",
            "My pockets — I don't have pockets. You know what I mean."] },
  { id: 'late_run', when: m => m.roomsDone >= 7,
    lines: ["Feels like I've been walking a long time.",
            "I don't know how much further this goes. I'd like it to go a bit further."] },
];

export const MEMORY_IDS = MEMORIES.map(m => m.id);

export function pickMemory(mem, used, rng = Math.random) {
  const open = MEMORIES.filter(m => !used.has(m.id) && m.when(mem));
  if (!open.length) return null;
  const m = open[Math.floor(rng() * open.length)];
  used.add(m.id);
  const l = m.lines[Math.floor(rng() * m.lines.length)];
  return typeof l === 'function' ? l() : l;
}

export const POOL_NAMES = Object.keys(POOLS);
export const POOL_DATA = POOLS;
