const api = globalThis.browser || globalThis.chrome;
(api.action || api.browserAction).onClicked.addListener(() => api.tabs.create({url:api.runtime.getURL('index.html')}));
