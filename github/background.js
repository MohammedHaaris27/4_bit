// background.js for PII Shield India

chrome.runtime.onInstalled.addListener(() => {
  console.log('PII Shield India extension installed.');
});

// Listen for messages from content script or panel if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'alive' });
  }
});