// content.js
// Runs in the ISOLATED world

(function() {
  // Scraper functions
  const getProblemTitle = () => {
    let title = document.title;
    if (title && title.includes(' - LeetCode')) {
      title = title.replace(' - LeetCode', '').trim();
      return title;
    }
    const titleEl = document.querySelector('div[data-cy="question-title"]') || 
                    document.querySelector('.text-title-large') || 
                    document.querySelector('span.text-lg.font-medium') ||
                    document.querySelector('.question-title');
    if (titleEl) {
      return titleEl.textContent.trim();
    }
    return "Unknown Problem";
  };

  const getProblemDifficulty = () => {
    const diffClasses = [
      'text-easy', 'text-medium', 'text-hard', 
      'text-difficulty-easy', 'text-difficulty-medium', 'text-difficulty-hard',
      'text-brand-orange', 'text-red-800'
    ];
    for (const cls of diffClasses) {
      const elements = document.querySelectorAll(`.${cls}`);
      for (const el of elements) {
        const text = el.textContent.trim();
        if (['Easy', 'Medium', 'Hard'].includes(text)) {
          return text;
        }
      }
    }
    // Fallback: search DOM for Easy, Medium, Hard text
    const selectors = ['div', 'span', 'p'];
    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (el.childNodes.length === 1) {
          const text = el.textContent.trim();
          if (['Easy', 'Medium', 'Hard'].includes(text)) {
            return text;
          }
        }
      }
    }
    return "Medium"; // Default fallback
  };

  const getProblemTags = () => {
    const tags = [];
    // Topics tags usually have links starting with /tag/
    const tagElements = document.querySelectorAll('a[href^="/tag/"]');
    tagElements.forEach(el => {
      const text = el.textContent.trim();
      if (text && !tags.includes(text)) {
        tags.push(text);
      }
    });
    return tags;
  };

  const getProblemDescription = () => {
    const selectors = [
      '[data-track-load="description_content"]',
      '.elfjS',
      '.question-content__JfgR',
      '.question-description',
      '#question-description'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        return el.innerText.trim();
      }
    }
    return "";
  };

  // Monitor SPA URL changes and report to background
  let lastUrl = window.location.href;
  const checkUrlChange = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (currentUrl.includes('/problems/')) {
        chrome.runtime.sendMessage({
          action: 'PAGE_LOADED',
          url: currentUrl
        });
      }
    }
  };
  setInterval(checkUrlChange, 1500);

  // Notify page load initially
  if (window.location.href.includes('/problems/')) {
    chrome.runtime.sendMessage({
      action: 'PAGE_LOADED',
      url: window.location.href
    });
  }

  const getFallbackCodeFromDom = () => {
    try {
      const lines = document.querySelectorAll('.view-line');
      if (lines && lines.length > 0) {
        return Array.from(lines).map(line => line.textContent || '').join('\n');
      }
    } catch (err) {
      console.error("LeetCode Companion: Fallback code extraction failed", err);
    }
    return "";
  };

  // Message listener from popup.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_PROBLEM_DETAILS') {
      const title = getProblemTitle();
      const difficulty = getProblemDifficulty();
      const tags = getProblemTags();
      const description = getProblemDescription();
      const url = window.location.href;

      let responded = false;
      let timeoutId;

      // Request code from MAIN world (content-main.js)
      const handleResponse = (e) => {
        if (responded) return;
        responded = true;
        clearTimeout(timeoutId);
        document.removeEventListener('LEETCODE_RESPONSE_CODE', handleResponse);
        
        sendResponse({
          success: true,
          title,
          difficulty,
          tags,
          description,
          url,
          code: e.detail.code || getFallbackCodeFromDom()
        });
      };

      document.addEventListener('LEETCODE_RESPONSE_CODE', handleResponse);
      
      // Fallback timeout: if main world script doesn't respond in 300ms, fallback to DOM scraping
      timeoutId = setTimeout(() => {
        if (responded) return;
        responded = true;
        document.removeEventListener('LEETCODE_RESPONSE_CODE', handleResponse);
        
        sendResponse({
          success: true,
          title,
          difficulty,
          tags,
          description,
          url,
          code: getFallbackCodeFromDom()
        });
      }, 300);

      document.dispatchEvent(new CustomEvent('LEETCODE_REQUEST_CODE'));

      return true; // Keep message channel open for async response
    }
  });
})();
