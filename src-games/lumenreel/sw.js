// Event-only service worker. It holds NO timer and NO game state.
//
// Chrome kills the worker after 30s idle and chrome.alarms will not fire faster
// than every 30s, so modelling accrual as a running interval here would silently
// stop. Accrual is instead computed from a stored timestamp on every wake, which
// makes offline time and online time literally the same code path (lib/engine.js
// tick()) — there is no separate "offline bonus" to get wrong.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL('ui/app.html') });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});
