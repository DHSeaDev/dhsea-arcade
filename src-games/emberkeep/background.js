// Emberkeep — service worker. It has exactly one job: open the page.
// No alarms, no network, no content scripts, no host permissions. `storage` is the only one.

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('page.html');
  const open = await chrome.tabs.query({ url });
  if (open.length) {
    await chrome.tabs.update(open[0].id, { active: true });
    await chrome.windows.update(open[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});
