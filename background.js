chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const url = new URL(changeInfo.url);
        if (!url.pathname.toLowerCase().endsWith(".pdf")) return;

        // Evitar loop infinito
        if (changeInfo.url.includes(chrome.runtime.id)) return;

        const viewerUrl = chrome.runtime.getURL("viewer.html") + "?file=" + encodeURIComponent(changeInfo.url);
        chrome.tabs.update(tabId, { url: viewerUrl });
    }
});