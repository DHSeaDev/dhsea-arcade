// Emberkeep — achievements. Pure functions over a run summary plus a persistent tally,
// so the whole set is testable without a browser.
//
// Design rule: achievements are CUMULATIVE ONLY. Nothing here can ever be un-earned, nothing
// depends on consecutive anything, and going out cannot take one away. A fail state that also
// claws back what you already proved you could do punishes the same player twice — the room is
// the only thing you can lose.

export const ACHIEVEMENTS = [
  { id: 'first_light', name: 'First Light', hint: 'Reach a brazier.',
    test: (r, T) => T.cleared >= 1 },
  { id: 'nothing_lost', name: 'Nothing Lost', hint: 'Clear a room without burning anything.',
    test: (r, T) => T.cleanRooms >= 1 },
  { id: 'clean_keep', name: 'Clean Keep', hint: 'Clear every room without burning anything.',
    test: (r, T) => T.cleanRoomIds.size >= T.roomCount },
  { id: 'restraint', name: 'Restraint', hint: 'Clear a room without firing a single spark.',
    test: (r) => r && r.won && r.shots === 0 },
  { id: 'kindling', name: 'Kindling', hint: 'Burn fifty tiles across the keep.',
    test: (r, T) => T.burned >= 50 },
  { id: 'it_spreads', name: 'It Spreads', hint: 'Watch twenty tiles go up from one spark.',
    test: (r) => r && r.biggestSpread >= 20 },
  { id: 'guttered', name: 'Guttered', hint: 'Go out. It happens.',
    test: (r, T) => T.outs >= 1 },
  { id: 'steadfast', name: 'Steadfast', hint: 'Clear a room without going out and without being startled.',
    test: (r) => r && r.won && r.outs === 0 && r.startles === 0 },
  { id: 'finder', name: 'Finder', hint: 'Find something that was hidden.',
    test: (r, T) => T.caches >= 1 },
  { id: 'collector', name: 'Collector', hint: 'Take every shard in a single room.',
    test: (r) => r && r.shards > 0 && r.shards === r.shardsInRoom },
  { id: 'archivist', name: 'Archivist', hint: 'Take every shard in the keep.',
    test: (r, T) => T.shardsFound >= T.shardsTotal && T.shardsTotal > 0 },
  { id: 'spelunker', name: 'Spelunker', hint: 'Find every hidden cache in the keep.',
    test: (r, T) => T.cachesFound >= T.cachesTotal && T.cachesTotal > 0 },
  { id: 'arachnophobe', name: 'Arachnophobe', hint: 'Meet a spider closer than you wanted to.',
    test: (r, T) => T.startles >= 1 },
  { id: 'shoo', name: 'Shoo', hint: 'Scare something off with a spark.',
    test: (r, T) => T.repels >= 1 },
  { id: 'listener', name: 'Listener', hint: 'Hear Ember say something he does not usually say.',
    test: (r, T) => T.rareHeard >= 1 },
  { id: 'the_door', name: 'The Door Out', hint: 'Reach the end of the keep.',
    test: (r, T) => T.reachedEnd >= 1 },
  { id: 'landlord', name: 'Landlord', hint: 'Meet the neighbours. They will not stay to chat.',
    test: (r, T) => T.ratsMet >= 1 },
  { id: 'birdwatcher', name: 'Birdwatcher', hint: 'Burn brightly enough that something outside objects.',
    test: (r, T) => T.crowsMet >= 1 },
  { id: 'breather', name: 'Breather', hint: 'Find the room that wants nothing from you.',
    test: (r, T) => T.stillVisited >= 1 },
  { id: 'warmth', name: 'Warmth', hint: 'Hold still long enough that something chooses to sit with you.',
    test: (r, T) => T.ratSat >= 1 },
  { id: 'archaeology', name: 'Archaeology', hint: 'Find what the keep was before you walked into it.',
    test: (r, T) => T.relicsSeen >= 3 },
  { id: 'second_wick', name: 'Another Fire', hint: 'Find a wick that is not you.',
    test: (r, T) => T.wicksFound >= 2 },
  { id: 'all_wicks', name: 'Every Fire', hint: 'Find all of them.',
    test: (r, T) => T.wicksFound >= 4 },
  { id: 'coldest', name: 'Coldest', hint: 'Clear a room as the fire that cannot burn.',
    test: (r) => r && r.won && r.wick === 'coldfire' },
  { id: 'cinders', name: 'Cinders', hint: 'Finish a room again, in the dark.',
    test: (r) => r && r.won && r.cinder },
  { id: 'outrun', name: 'Outrun', hint: 'Beat your own ghost.',
    test: (r, T) => T.beatGhost >= 1 },
  { id: 'the_record', name: 'The Record', hint: 'Piece together everything the keep remembers.',
    test: (r, T) => T.recordLines >= 12 },
  { id: 'unhurried', name: 'Unhurried', hint: 'Finish the keep having burned nothing at all.',
    test: (r, T) => T.reachedEnd >= 1 && T.runBurned === 0 },
];

export function emptyTally(roomCount = 10, shardsTotal = 0, cachesTotal = 0) {
  return {
    roomCount, shardsTotal, cachesTotal,
    cleared: 0, burned: 0, outs: 0, startles: 0, repels: 0, rareHeard: 0,
    reachedEnd: 0, ratsMet: 0, crowsMet: 0, stillVisited: 0, runBurned: 0, score: 0,
    ratSat: 0, relicsSeen: 0, wicksFound: 1, beatGhost: 0, recordLines: 0,
    shardsFound: 0, cachesFound: 0, caches: 0, cleanRooms: 0,
    cleanRoomIds: new Set(), earned: new Set(),
  };
}

// Returns the ids newly earned by this evaluation. Never removes anything.
export function evaluate(tally, run = null) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (tally.earned.has(a.id)) continue;
    let ok = false;
    try { ok = !!a.test(run, tally); } catch { ok = false; }
    if (ok) { tally.earned.add(a.id); fresh.push(a.id); }
  }
  return fresh;
}

export function byId(id) { return ACHIEVEMENTS.find(a => a.id === id); }

// chrome.storage cannot hold a Set, so persist as arrays and rehydrate.
export function serialize(t) {
  return { ...t, cleanRoomIds: [...t.cleanRoomIds], earned: [...t.earned] };
}
export function deserialize(o, fallback) {
  if (!o) return fallback;
  return { ...fallback, ...o, cleanRoomIds: new Set(o.cleanRoomIds || []), earned: new Set(o.earned || []) };
}

export function countTiles(rooms, ch) {
  let n = 0;
  for (const r of rooms) for (const row of r.grid) for (const c of row) if (c === ch) n++;
  return n;
}
