/* The popup is the front door: where you are, what you have, and a way in.
   The game itself is the full page — a 100-level timed maze does not belong in
   a 300px panel, and trying to run it there was the un-simple thing. */
const K_LEVELS = 100, K_ACH = 25;
function open_() { chrome.tabs.create({ url: chrome.runtime.getURL('play.html') }); }
document.getElementById('p-play').addEventListener('click', open_);
/* The engine writes one slot per mode, keyed 'underglory.v2.<mode>'. This read
   was still on 'underglory.v1.course' from before the sandbox split, so the
   front door showed level 1 / 0 cleared / best 0 forever no matter how far you
   had got. Caught by the preship DOM-and-storage contract check, not by looking
   at it — a popup full of zeroes looks exactly like a new install. */
const SAVE_KEY = 'underglory.v2.course';
chrome.storage.local.get(SAVE_KEY).then(g => {
  const s = g && g[SAVE_KEY];
  if (!s) return;
  const best = Object.values(s.bestScore || {});
  document.getElementById('p-lv').textContent = s.level || 1;
  document.getElementById('p-cleared').textContent = (s.totalCleared || 0) + ' of ' + K_LEVELS;
  document.getElementById('p-best').textContent = best.length ? Math.max(...best) : 0;
  document.getElementById('p-ach').textContent =
    Object.keys(s.unlocked || {}).length + ' of ' + K_ACH;
}).catch(() => {});
