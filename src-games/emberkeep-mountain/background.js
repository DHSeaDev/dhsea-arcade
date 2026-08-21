// Opens the full-page surface. Nothing else lives here — no network, no listeners on tabs.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('page.html') });
});
