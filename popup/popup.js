document.addEventListener('DOMContentLoaded', function () {
  browser.tabs.query({ active: true, currentWindow: true }).then(updatePopup);
});

function updatePopup(tabs) {
  const currentTab = tabs[0];
  browser.runtime.sendMessage({ request: "getData", tabId: currentTab.id }).then((response) => {
      document.getElementById('third-party-requests').textContent = response.thirdPartyRequests;
      document.getElementById('first-party-cookies').textContent = response.firstPartyCookies;
      document.getElementById('third-party-cookies').textContent = response.thirdPartyCookies;
      document.getElementById('local-storage-items').textContent = response.localStorageItems;
      document.getElementById('session-storage-items').textContent = response.localStorageItems;
      document.getElementById('privacy-score').textContent = response.score;
      document.getElementById("hijacking-risk").textContent = response.hijackingRisk ? 'Yes' : 'No';
      document.getElementById("canvas-fingerprint-detected").textContent = response.canvasFingerprintDetected ? "Yes" : "No";
  });
}