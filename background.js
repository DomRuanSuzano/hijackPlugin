class Data {
  constructor() {
      this.reset();
  }

  reset() {
    this.thirdPartyRequests = 0;
    this.firstPartyCookies = 0;
    this.thirdPartyCookies = 0;
    this.localStorageItems = 0;
    this.sessionStorageItems = 0;
    this.hijackingRisk = false;
    this.canvasFingerprintDetected = false;
}

  getCookies(url) {
      return browser.cookies.getAll({ url: url });
  }

  processCookies(cookies, tabHostname) {
      cookies.forEach(cookie => {
          const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
          if (cookieDomain.includes(tabHostname)) {
              this.firstPartyCookies++;
          } else {
              this.thirdPartyCookies++;
          }
      });
  }

  countCookies(url, tabHostname) {
      this.getCookies(url).then(cookies => {
          this.processCookies(cookies, tabHostname);
      });
  }


  calculatePrivacyScore() {
    let score = 100;

    const reductionFactors = {
        thirdPartyRequests: 5,
        thirdPartyCookies: 1,
        localStorageItems: 2,
        sessionStorageItems: 1,
        canvasFingerprintDetected: 25,
        hijackingRisk: 30
    };

    Object.keys(reductionFactors).forEach(key => {
        if (this[key]) {
            score -= reductionFactors[key];
        }
    });

    return Math.max(score, 0);
  }

}

const tabsData = {};

browser.tabs.onActivated.addListener(activeInfo => {
    const tabId = activeInfo.tabId;
    if (!tabsData[tabId]) {
        tabsData[tabId] = new Data();
    }
});

browser.webRequest.onCompleted.addListener(details => {
    const tabId = details.tabId;
    if (tabId === -1 || !tabsData[tabId]) return;

    const requestUrl = new URL(details.url);
    const requestDomain = requestUrl.hostname;
    const requestPort = requestUrl.port;

    const hijackingRiskPorts = ['8080', '8081', '8443', '8000'];
    if (hijackingRiskPorts.includes(requestPort)) {
        tabsData[tabId].hijackingRisk = true;
    }

    browser.tabs.get(tabId).then(tab => {
        const tabUrl = new URL(tab.url);
        const tabHostname = tabUrl.hostname;
        if (requestDomain !== tabHostname) {
            tabsData[tabId].thirdPartyRequests++;
        }
        countCookies(details.url, tabHostname, tabId);
    });
}, { urls: ["<all_urls>"] });

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete' && tabsData[tabId]) {
        tabsData[tabId].reset();
        injectScript(tabId);
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "storageData") {
        const tabId = message.tabId;
        if (tabsData[tabId]) {
            tabsData[tabId].localStorageItems = message.localStorageCount;
            tabsData[tabId].sessionStorageItems = message.sessionStorageCount;
            tabsData[tabId].canvasFingerprintDetected = message.canvasFingerprint;
        }
    }

    if (message.request === "getData") {
        const tabId = message.tabId;
        if (tabsData[tabId]) {
            const responseData = {
                ...tabsData[tabId],
                score: tabsData[tabId].calculatePrivacyScore()
            };
            sendResponse(responseData);
        }
    }
});

function injectScript(tabId) {
  const code = `
      function calculateCanvasFingerprint() {
          const text = "CanvasFingerprint";
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.textBaseline = "top";
          ctx.font = "14px 'Arial'";
          ctx.fillStyle = "#f60";
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = "#069";
          ctx.fillText(text, 2, 15);
          ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
          ctx.font = "italic 14px 'Arial'"; // Mudança no estilo do texto
          ctx.fillText(text, 4, 17);
          return canvas.toDataURL();
      }

      browser.runtime.sendMessage({
          type: 'storageData',
          tabId: ${tabId},
          localStorageCount: localStorage.length,
          sessionStorageCount: sessionStorage.length,
          canvasFingerprint: calculateCanvasFingerprint()
      });
  `;
  browser.tabs.executeScript(tabId, { code: code });
}