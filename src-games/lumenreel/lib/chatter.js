// The Grove's voice. Every critter in the playground speaks from three layers:
//
//   1. MOOD  — its authored resting mood picks the register (a smug critter and a
//              shy one narrate the same jackpot completely differently)
//   2. EVENT — what just happened on the reels
//   3. SIGNATURE — a handful of critters have their own lines, because a dex of
//              125 in which everyone sounds the same is 125 of the same critter
//
// Register: comedic, dryly bleak, PG. Nothing here is cruel about the player, and
// nothing references money — there isn't any. The joke is always that these are
// small ornamental creatures with an unreasonably clear view of probability.

const T = (s) => s;   // marker for line text, keeps the tables scannable

// --- MOOD VOICES ------------------------------------------------------------
export const MOOD_LINES = {
  calm: [
    T("I've made my peace with the odds."),
    T('Nothing is wrong. Nothing is ever particularly wrong.'),
    T('It will land where it lands.'),
    T('I find the waiting restful. Most disagree.'),
    T('Somebody has to be the reasonable one.'),
  ],
  happy: [
    T('That one had a lovely shape to it!'),
    T('Again! Do the thing again!'),
    T('I like it here. I like it here a normal amount.'),
    T('Everyone is doing so well. Even Grit.'),
    T('Good spin. Good, good spin.'),
  ],
  curious: [
    T('What happens if we press it a great many times?'),
    T('Where do the ones we do not get go?'),
    T('Is the wheel aware of us?'),
    T('I have been counting. I would rather not say what.'),
    T('Which reel is the honest one?'),
  ],
  sleepy: [
    T('Wake me when a reel means something.'),
    T('Mm. Lovely. Was that a win.'),
    T('I will celebrate later. Provisionally.'),
    T('Time passes here. That is its whole job.'),
    T('I have seen this spin. In a dream. It also paid nothing.'),
  ],
  alarmed: [
    T('Was that supposed to happen? WAS it?'),
    T('Everyone stay exactly where you are.'),
    T('I do not like the noise the wheel makes.'),
    T('Five of them. Five! On one reel!'),
    T('I am fine. I am extremely fine.'),
  ],
  proud: [
    T('I was drawn on purpose, you know.'),
    T('One of us here is load-bearing.'),
    T('Observe the facet count. Simply observe it.'),
    T('I was not a duplicate. I could never have been a duplicate.'),
    T('Stand where the light is best. That is all I ask.'),
  ],
  shy: [
    T('...you can go first.'),
    T('I was hoping nobody would look at me during that.'),
    T('Oh. Was I supposed to comment.'),
    T('I like the quiet spins.'),
    T('Please do not make me the mascot.'),
  ],
  smug: [
    T("I'd have taken the Ultra. But sure. Mini."),
    T('Called it. Did not say it out loud, but called it.'),
    T('Some of us are rarer than others. No further comment.'),
    T('You are welcome to keep spinning. I have time.'),
    T('Adorable. Genuinely adorable.'),
  ],
  awe: [
    T('Look at the light in it. Look at it.'),
    T('That is the whole point of everything, right there.'),
    T('We are very small and the reels are very large.'),
    T('I will be thinking about that one for some time.'),
    T('Oh. Oh, that was beautiful.'),
  ],
};

// --- EVENT LINES ------------------------------------------------------------
// {me} speaker, {you} another critter, {n} a number, {sym} a symbol name.
export const EVENT_LINES = {
  bigwin: [
    T("Now THAT'S refraction."),
    T('I need everyone to stay calm and nobody to stay calm.'),
    T('That is the one we tell people about.'),
    T('Something structural just happened.'),
    T('The paytable has been generous and I am suspicious.'),
    T('I am going to need a moment and a bigger container.'),
    T('Everyone act normal. Everyone ACT NORMAL.'),
    T('I felt that one in the part of me that is load-bearing.'),
    T('Write it down. Nobody will believe us.'),
    T('{you} fainted. {you} is fine. {you} fainted.'),
  ],
  // The second most common outcome (26% of spins pay). Same reasoning as nopay.
  win: [
    T('A modest and dignified result.'),
    T('We take those. We take those quietly.'),
    T('Respectable. Nobody has to know it was luck.'),
    T('That will do.'),
    T('Small, but it arrived.'),
    T('A win with its shoes still on.'),
    T('Modest. Sustainable. Faintly disappointing.'),
    T('Something for the collection fund.'),
    T('That is a win by the only definition that matters.'),
    T('I am choosing to be pleased.'),
    T('Enough to keep going, which is the entire trick.'),
    T('It paid. Let us not examine it too closely.'),
    T('A win. Not a story, but a win.'),
    T('Adequate. I mean that warmly.'),
    T('The reels have decided to be reasonable.'),
    T('Progress, measured in very small units.'),
  ],
  // NOPAY IS THE MOST COMMON OUTCOME IN THE GAME — measured 68.78% of spins. Six lines
  // across a seventeen-hour collection meant the same joke several hundred times. This
  // pool is deliberately the largest one in the file.
  nopay: [
    T('Nothing. A perfect nothing. Frame it.'),
    T('Beautifully arranged. Worth precisely zero.'),
    T('The reels have spoken and they said "no".'),
    T('That was five reels of confident nonsense.'),
    T('Statistically this had to happen. Emotionally, it did not.'),
    T('I want to stress that none of us chose that.'),
    T('Close, in the sense that it was on the same screen.'),
    T('The machine is thinking. It has been thinking for some time.'),
    T('A bold arrangement. Structurally unsound.'),
    T('I have seen better. I have also seen this.'),
    T('No pay. The reels seem at peace with it.'),
    T('That is the shape of a win with none of the substance.'),
    T('Somewhere a paytable is being ignored.'),
    T('It committed. You have to give it that.'),
    T('Zero, delivered with total confidence.'),
    T('The symbols were present. The agreement was not.'),
    T('Well. That happened at us.'),
    T('Every reel did its job. The jobs were unrelated.'),
    T('I would call that a rehearsal.'),
    T('Not a win. Not technically a loss either, if you think about the currency.'),
    T('The reels are experimenting. We are the experiment.'),
    T('Nothing again. I am building a tolerance.'),
    T('That was a lot of movement for no news.'),
    T('It is not that it failed. It is that it never tried.'),
  ],
  splash: [
    T("It's in my eyes. It's in EVERYONE's eyes."),
    T('Wilds everywhere. Nobody is safe. Nobody is complaining.'),
    T('I have been splashed. This is my life now.'),
    T('{you} is soaked and pretending not to be.'),
  ],
  thunder: [
    T('Three of them fused. I felt that in my facets.'),
    T('That reel just became one very large opinion.'),
    T('It merged. Things that merge do not un-merge.'),
    T('Big symbol. Big feelings. Small payout, historically.'),
  ],
  wheel: [
    T('Round and round, and it lands on Mini. Every time.'),
    T('The wheel owes me nothing and gives me less.'),
    T('One of these days it stops on Ultra and we all retire.'),
    T('I have made my peace with the wheel. The wheel has not.'),
  ],
  hold: [
    T('Everything locks and nobody breathes.'),
    T('Cores on all five. Somebody hold {you}.'),
    T('Three respins. Three. That is barely a lifetime.'),
  ],
  free: [
    T('Free spins! The only free thing in here!'),
    T('Nothing is free. These are, though. Suspicious.'),
    T('Enjoy them. They end.'),
  ],
  unlock: [
    T('{you}! You are new. Do not touch anything.'),
    T('Welcome, {you}. The light is better over here.'),
    T('{you} has arrived and immediately looks like they own the place.'),
    T('Another one. There is always another one.'),
    T('Hello {you}. We were {n} and now we are {n}. Maths later.'),
  ],
  setdone: [
    T('The set is complete. We can stop pretending we were not counting.'),
    T('That is all of us. All of that lot, anyway.'),
    T('A finished set. Briefly, everything is tidy.'),
  ],
  offline: [
    T('You left. We noticed. We are fine.'),
    T('While you were gone we did absolutely nothing, on schedule.'),
    T('Welcome back. The light kept arriving without you.'),
    T('We had a whole conversation. You would not have enjoyed it.'),
  ],
  idle: [
    T('The reels are resting. So are we. Allegedly.'),
    T('Somebody say something. Anybody.'),
    T('I can hear the meter filling. That cannot be right.'),
    T('This is the good part. The part where nothing costs anything.'),
    T('{you} has been staring at the same tile for a while now.'),
  ],
};

// --- SIGNATURE LINES --------------------------------------------------------
// Not every critter needs one; the ones that have one should be unmistakable.
export const SIGNATURE = {
  Blinker: [T('One eye. It has always been the left. I have stopped asking.')],
  Grit: [T('I get everywhere. I regret nothing. I am in the mechanism.')],
  Beadle: [T('I collect other Beadles. No, you may not see them.')],
  Dustling: [T('I have settled on everything you own. You are welcome.')],
  Twinkid: [T('I blink out of sync on purpose. It is my only power.')],
  Smoothy: [T('Nothing has ever scratched me. I would like to keep it that way.')],
  Cobble: [T('I was a road once. People went places on me.')],
  Prismarch: [
    T('Every critter here is a piece of me. I try not to bring it up.'),
    T('I was the first cut. Everything since has been a variation.'),
  ],
  Zenithra: [T('This is the high point. Everything below is the climb. I remember the climb.')],
  Umbraxis: [T('I am the dark a prism makes on the other side. Somebody has to be.')],
  Chromaeon: [T('Every facet a different hue. Every second a different order. Keep up.')],
  Vitrimor: [T('I was broken on purpose. That is the entire design. Please stop apologising.')],
  Solvane: [T('One colour, held so hard it became all of them.')],
  Hollowtone: [T('Empty in a way that sounds full. It is a skill.')],
  Knell: [T('I am counting something down. No, I will not say what.')],
  Bulwark: [T('I stand where a door used to be. The door is not coming back.')],
  Sentrix: [T('Four eyes. One blind spot. Very well hidden.')],
  Vigilis: [T('I have not blinked since you installed this.')],
  Nocturne: [T('I arrive when the meter is nearly full. It is a bit,  and it works.')],
  Wispera: [T('You can only really see me out of the corner of your eye. Try it. No — stop trying.')],
  Everbloom: [T('I am the last thing to close. Every single year. It is exhausting.')],
  Heliora: [T('I turn to follow whoever is kindest. Currently: the spin button.')],
  Nyctara: [T('I only open when nobody is counting. You are counting.')],
  Mycelin: [T('I am much larger than the part you can see. Sleep well.')],
  Amberoot: [T('I carry something older than myself. It does not talk.')],
  Dandelo: [T('Half of me has already left. The half that stayed is the funny one.')],
  Boughan: [T('I remember the fence being new. I remember the fence.')],
  Lichenor: [T('We are two things pretending to be one. It is going well.')],
  Truffet: [T('I am worth more than I look. I am aware of this at all times.')],
  Rootgrub: [T('Every cable in here looks like a root to me. Every single one.')],
  Shalefang: [T('I chipped a tooth on something important. Nobody has explained what.')],
  Tunnelin: [T('I am longer than the space I am in. Do not think about it.')],
  Glisser: [T('I move without appearing to. You will not catch me at it.')],
  Carapax: [T('My shell is a repaired shell. Ask me nothing further.')],
  Scuttle: [T('Six legs. One direction. No reverse. It has cost me.')],
  Trundle: [T('I will get there. The reels will still be doing this.')],
  Manteel: [T('I am holding very still. For reasons of my own.')],
  Nibbler: [T('I file down my own edges at night. It is not a cry for help.')],
  Reverb: [T('...for help.')],
  Gravlet: [T('I arrive with several friends. They are all also me.')],
  Puddlin: [T('Wider than I am deep. Content about it.')],
};

// --- CHAOS ------------------------------------------------------------------
//
// A small, deliberately-rare seam of dryly apocalyptic comedy. It fires at CHAOS_RATE
// across BOTH entry points (speak and interact) so the observed rate is uniform however
// a line was reached — sim/chatter_test.js measures it and fails outside 3-7%.
//
// Register, and these are hard limits, not style notes: nothing about death, dying,
// self-harm, harm to the player, or anything a person could read as being about
// themselves. The joke is always cosmic indifference happening to small ornamental
// creatures who have read the paytable and would rather they hadn't.
export const CHAOS_RATE = 0.05;

export const CHAOS = [
  T("We're doooomed."),
  T('DOOM. ...sorry. Doom. I said that louder than I meant to.'),
  T('Everything is fine. Which is the single most suspicious part.'),
  T('I have run the numbers. I would very much like to stop running the numbers.'),
  T('The odds are published. That is the frightening bit.'),
  T('This is fine. This is the normal, correct amount of fine.'),
  T('I looked at the paytable. I wish I had not looked at the paytable.'),
  T('Somewhere a reel is deciding our future and it does not know we exist.'),
  T('The wheel has plans. The wheel does not share the plans.'),
  T('We are ornamental and the cosmos is indifferent. Lovely light today, though.'),
  T('Nothing bad is happening. Yet. I want everyone to notice the word "yet".'),
  T('I sense a great disturbance, as though many Facets went absolutely nowhere.'),
  T('One day the tab closes and we simply... wait. Anyway! Spin again.'),
  T('The house always— oh. There is no house. Forget it. Carry on.'),
  T('Good spins end. Bad spins end. It is the ending that gets you.'),
  T('I have made a chart. The chart is not encouraging. Do not ask about the chart.'),
  T('Statistically something is about to go wrong. I decline to say what.'),
  T('We are inside a machine that is honest with us. I find that so much worse.'),
];

// --- INTERACTIONS -----------------------------------------------------------
export const INTERACTIONS = [
  T('{me}: {you}, you are standing in my light.'),
  T('{me}: do you ever think about the ones we did not get?\n{you}: no.'),
  T('{me}: {you}, be honest. Am I rare.'),
  T('{me}: I was 1 in {n}.\n{you}: congratulations, so was everyone.'),
  T('{me}: if the wheel lands on Ultra I am leaving.\n{you}: you live here.'),
  T('{me}: {you} has not blinked in some time.'),
  T('{me}: is it strange that we only exist when the tab is open?\n{you}: yes. Stop.'),
  T('{me}: {you}, hold still, you have a wild on you.'),
  T('{me}: we are decorative.\n{you}: we are LOAD-BEARING.'),
  T('{me}: somebody should tell them about the odds.\n{you}: they published them. Voluntarily.'),
  T('{me}: I have been here longest.\n{you}: you have been here eleven minutes.'),
  T('{me}: {you}, what happens when the collection is finished?\n{you}: we find out together.'),
  // v0.9.0 — more name-forward pairs. The names are what make the Grove read as a cast
  // rather than a screensaver, so every line here puts at least one of them in the mouth
  // of the other.
  T('{me}: {you}. {you}. {you}.\n{you}: what.\n{me}: nothing. Testing the name.'),
  T('{me}: {you} is standing suspiciously close to the good light.'),
  T('{me}: {you}, you are the second-best one here.\n{you}: who is first.\n{me}: no comment.'),
  T('{me}: I would like it noted that {you} started it.'),
  T('{me}: {you}, if one of us has to be the rare one, it should be me.'),
  T('{me}: {you} and I have decided to be friends.\n{you}: I was not consulted.'),
  T('{me}: has anyone seen {you}?\n{you}: I am directly beside you.'),
  T('{me}: {you}, do you also feel watched?\n{you}: constantly. It is the whole job.'),
  T('{me}: {you}, hold this.\n{you}: hold WHAT.'),
  T('{me}: {you} was drawn at 1 in {n}. {you} will not let it go.'),
  T('{me}: on three, we both look at the reels. One. Two.\n{you}: you looked early.'),
  T('{me}: {you}, be honest, is my glow crooked?'),
  T('{me}: {you} says the wheel is fair.\n{you}: I said it is PUBLISHED. Different word.'),
  T('{me}: move over, {you}.\n{you}: I have been here since before you existed.\n{me}: eleven minutes.'),
];

// --- selection --------------------------------------------------------------
function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)] ?? ''; }

/**
 * Compose one line of commentary.
 * @param {object} speaker species row
 * @param {string} event   key into EVENT_LINES, or 'idle'
 * @param {object} opts    { other: species row, n: number, rnd: () => number }
 */
/** One shared chaos roll, so speak() and interact() fire it at the same rate. */
export function chaosLine(rnd = Math.random) {
  return rnd() < CHAOS_RATE ? pick(CHAOS, rnd) : null;
}

export function speak(speaker, event, opts = {}) {
  const rnd = opts.rnd || Math.random;
  const other = opts.other;
  const chaos = chaosLine(rnd);
  if (chaos) return fill(chaos, speaker, other, opts.n ?? 0);
  const pools = [];

  // Signature weight on EVENTS raised 10 -> 26. The signature lines are the ones that
  // make a critter feel like a specific animal rather than a narrator, and at w:10
  // against an event pool at w:66 they were the writing the player saw least. Idle is
  // unchanged: the Grove already leans on signatures when nothing is happening.
  const sig = SIGNATURE[speaker.name];
  if (sig) pools.push({ w: event === 'idle' ? 34 : 26, lines: sig });
  const mood = MOOD_LINES[speaker.mood] || MOOD_LINES.calm;
  pools.push({ w: event === 'idle' ? 44 : 24, lines: mood });
  const ev = EVENT_LINES[event] || EVENT_LINES.idle;
  pools.push({ w: event === 'idle' ? 22 : 54, lines: ev });

  let total = 0; for (const p of pools) total += p.w;
  let r = rnd() * total, chosen = pools[pools.length - 1];
  for (const p of pools) { r -= p.w; if (r <= 0) { chosen = p; break; } }

  let text = pick(chosen.lines, rnd);
  // A line that needs a second critter is only usable when there is one.
  if (text.includes('{you}') && !other) text = pick(MOOD_LINES[speaker.mood] || MOOD_LINES.calm, rnd);
  return fill(text, speaker, other, opts.n ?? 0);
}

export function interact(a, b, rnd = Math.random) {
  const chaos = chaosLine(rnd);
  if (chaos) return fill(`{me}: ${chaos}`, a, b, 34);
  return fill(pick(INTERACTIONS, rnd), a, b, 34);
}

function fill(text, me, you, n) {
  return String(text)
    .replaceAll('{me}', me?.name ?? 'Someone')
    .replaceAll('{you}', you?.name ?? 'somebody')
    .replaceAll('{n}', String(n));
}
