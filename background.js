chrome.runtime.onInstalled.addListener(function() {
  // Replace all rules
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    // With a new rule
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
              hostEquals: 'bandcamp.com'
            },
          })
        ],
        actions: [
          new chrome.declarativeContent.ShowPageAction()
        ]
      }
     ]);
  });
});
