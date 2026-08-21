/**
 * Service worker — deliberately minimal.
 *
 * The worker terminates after 30s idle, after 5 minutes on a single request,
 * and a fetch whose response takes over 30s is itself a termination trigger.
 * So it orchestrates NOTHING. It opens the panel and gets out of the way; the
 * side panel document owns the game loop and its own persistence.
 */

chrome.runtime.onInstalled.addListener(() => {
  // Clicking the toolbar icon opens the panel. This is the supported path and
  // it counts as the required user gesture.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn('[veilfall] setPanelBehavior failed', e));
});

// The panel stays available on every tab; the game is not tied to page content.
chrome.runtime.onStartup?.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});
