chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Só disparar se o URL mudar e for um PDF
    if (changeInfo.url && changeInfo.url.toLowerCase().endsWith(".pdf")) {
        // Evitar loop infinito
        if (changeInfo.url.includes(chrome.runtime.id)) return;

        const viewerUrl = chrome.runtime.getURL("viewer.html") + "?file=" + encodeURIComponent(changeInfo.url);
        chrome.tabs.update(tabId, { url: viewerUrl });
    }
});