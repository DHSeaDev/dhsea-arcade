/**
 * playhtml-boot.js — shared play counts and star ratings on the arcade index.
 *
 * BUNDLED FROM npm, NOT LOADED FROM A CDN. playhtml is normally pulled from
 * unpkg, which would force `script-src` to allow a third-party host and hand
 * that host the ability to run code on this origin — where Veilfall's Groq key
 * lives. Bundling it locally keeps `script-src 'self'` intact. The only CSP
 * change the feature needs is `connect-src`, for the sync socket.
 *
 * WHAT THESE NUMBERS ARE, AND ARE NOT. playhtml state is an unauthenticated
 * CRDT: anyone can open devtools and set a count to whatever they like, or zero
 * it. Treat them as a playful social signal, not analytics — the page says so
 * out loud rather than implying the numbers are audited. Real traffic numbers
 * should come from Cloudflare Web Analytics, which is free, cookieless, and
 * already available on this Pages project.
 *
 * ROOM. Explicitly `arcade` rather than the default (which is derived from the
 * URL path, so every page would get its own isolated state). NOTE playhtml also
 * prefixes every room with `window.location.hostname` — so the pages.dev
 * hostname and play.dhseadev.online are DIFFERENT rooms. The canonical-host
 * redirect below is what keeps everyone in one of them.
 *
 * IDS ARE THE SYNC KEY. `plays-<id>` and `rate-<id>` are how playhtml addresses
 * shared state. Renaming one orphans its accumulated data with no migration
 * path — the same way the pb-best score was orphaned on dhseadev.online.
 */
import { playhtml } from 'playhtml';

/* Canonical host. Runs before init so the room is decided once, and doubles as
 * the fix for two hostnames serving identical content. Guarded to the exact
 * preview host so a local file:// or localhost test is never redirected. */
if (location.hostname === 'dhsea-arcade.pages.dev') {
  location.replace('https://play.dhseadev.online' + location.pathname + location.search + location.hash);
}

const STAR = '★';
const STAR_HOLLOW = '☆';

/** One vote per browser, per game. A localStorage flag is a courtesy rail, not
 *  a security control — it is bypassable in about four seconds, which is
 *  exactly why the page does not present these as verified ratings. */
function votedKey(id) { return 'arcade:voted:' + id; }
function hasVoted(id) {
  try { return localStorage.getItem(votedKey(id)) !== null; } catch { return false; }
}
function markVoted(id, stars) {
  try { localStorage.setItem(votedKey(id), String(stars)); } catch { /* private mode */ }
}
function myVote(id) {
  try { return Number(localStorage.getItem(votedKey(id))) || 0; } catch { return 0; }
}

playhtml.init({
  room: 'arcade',
  extraCapabilities: {
    /* ── play tally ──────────────────────────────────────────────────────── */
    'can-tally': {
      defaultData: { n: 0 },
      updateElement: ({ data, element }) => {
        const n = Math.max(0, Number(data && data.n) || 0);
        // textContent, never innerHTML — this string comes off the network.
        element.textContent = n === 0 ? 'not played yet'
          : n === 1 ? '1 play'
          : n.toLocaleString() + ' plays';
        element.dataset.n = String(n);
      },
      /* TWO API traps here, both found by testing against the live page rather
       * than by reading the types:
       *
       * 1. It must be `onMount`, NOT `additionalSetup`. playhtml only rewrites
       *    additionalSetup -> onMount on the inline `can-play` path; a
       *    capability registered through `extraCapabilities` is passed straight
       *    through, so `additionalSetup` is silently DROPPED. The cards render
       *    perfectly and simply do nothing when clicked.
       * 2. This hook receives ElementSetupData, which has `getElement()` and NOT
       *    `element` — unlike `updateElement`, which does get `element`. */
      onMount: ({ getElement, setData }) => {
        const element = getElement();
        // The launch link is a SIBLING, not a wrapper: a button or link nested
        // inside another anchor makes the parser split the card in two. That
        // exact bug (nested <a>) already cost a live defect on dhseadev.online.
        const card = element.closest('.g-card');
        const link = card && card.querySelector('a.g-go');
        if (!link) return;
        // pointerdown, not click: it fires earlier, so the CRDT update reaches
        // the socket well before the navigation tears the page down.
        link.addEventListener('pointerdown', () => {
          setData((d) => { d.n = (Number(d.n) || 0) + 1; });
        }, { passive: true });
      },
    },

    /* ── star rating ─────────────────────────────────────────────────────── */
    'can-rate': {
      defaultData: { sum: 0, votes: 0 },
      updateElement: ({ data, element }) => {
        const sum = Math.max(0, Number(data && data.sum) || 0);
        const votes = Math.max(0, Number(data && data.votes) || 0);
        const avg = votes ? sum / votes : 0;
        const id = element.id.replace(/^rate-/, '');
        const mine = myVote(id);
        const voted = hasVoted(id);

        const buttons = element.querySelectorAll('button.g-star');
        buttons.forEach((b, i) => {
          const filled = voted ? i < mine : i < Math.round(avg);
          b.textContent = filled ? STAR : STAR_HOLLOW;
          b.setAttribute('aria-pressed', String(voted && i < mine));
          b.disabled = voted;
          b.title = voted ? 'You rated this ' + mine + ' of 5' : 'Rate ' + (i + 1) + ' of 5';
        });

        const out = element.querySelector('.g-avg');
        if (out) {
          out.textContent = votes === 0
            ? 'no ratings yet'
            : avg.toFixed(1) + ' / 5 · ' + votes + (votes === 1 ? ' rating' : ' ratings');
        }
        // The live region announces the result of a vote to screen readers.
        element.setAttribute('aria-label',
          votes === 0 ? 'Not yet rated' : 'Rated ' + avg.toFixed(1) + ' out of 5 from ' + votes + ' ratings');
      },
      onMount: ({ getElement, setData }) => {   // onMount, not additionalSetup — see above
        const element = getElement();
        const id = element.id.replace(/^rate-/, '');
        element.querySelectorAll('button.g-star').forEach((b, i) => {
          b.addEventListener('click', (e) => {
            e.preventDefault();
            if (hasVoted(id)) return;
            const stars = i + 1;
            markVoted(id, stars);
            setData((d) => {
              d.sum = (Number(d.sum) || 0) + stars;
              d.votes = (Number(d.votes) || 0) + 1;
            });
          });
        });
      },
    },
  },
  onError: degradeToOffline,
});

/* WATCHDOG. onError only fires on an actual error — a socket that simply never
 * completes leaves every card reading "counting…" forever, which is what the
 * offline build did before this. If no tally has rendered after 6 seconds,
 * declare it offline. Cheap, and it covers the hang case onError cannot see. */
setTimeout(() => {
  const anyLive = document.querySelector('.g-plays[data-n]');
  if (!anyLive) degradeToOffline();
}, 6000);

function degradeToOffline() {
    /* Sync is optional decoration — the arcade works without it. Degrade by
     * TELLING the user, never by leaving controls that silently do nothing.
     *
     * Note what this does NOT do: an earlier version set textContent on
     * `.g-social`, which would have deleted the very star buttons it was
     * reporting on. Only the leaf text nodes are touched. */
    document.querySelectorAll('.g-plays').forEach((n) => {
      n.textContent = 'play counts offline';
      n.classList.add('g-social-off');
    });
    document.querySelectorAll('.g-rate').forEach((r) => {
      r.querySelectorAll('button.g-star').forEach((b) => {
        b.disabled = true;
        b.title = 'Ratings are offline right now';
      });
      const avg = r.querySelector('.g-avg');
      if (avg) avg.textContent = 'offline';
    });
}
