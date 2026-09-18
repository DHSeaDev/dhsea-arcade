// Event-only service worker. It holds NO timer and NO game state: the camp's time
// is computed from a stored timestamp whenever the panel opens (lib/engine.js tick),
// so there is nothing here for Chrome's 30-second worker shutdown to interrupt.
// Its one job: make the toolbar button open the side panel.

const openOnClick = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(openOnClick);
chrome.runtime.onStartup.addListener(openOnClick);
openOnClick();
