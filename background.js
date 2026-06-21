// background.js
// Handles LeetCode problem timers in chrome.storage.local

// Get storage key for a problem URL
const getTimerKey = (url) => `timer_${url}`;

// Initialize timer state on page load
const initializeTimer = async (url) => {
  const key = getTimerKey(url);
  const data = await chrome.storage.local.get(key);
  
  if (!data[key]) {
    // Brand new timer, start it
    const initialState = {
      startTime: Date.now(),
      accumulatedTime: 0,
      isRunning: true
    };
    await chrome.storage.local.set({ [key]: initialState });
  }
};

// Start/Resume timer
const startTimer = async (url) => {
  const key = getTimerKey(url);
  const data = await chrome.storage.local.get(key);
  let state = data[key];

  if (!state) {
    state = { startTime: Date.now(), accumulatedTime: 0, isRunning: true };
  } else if (!state.isRunning) {
    state.isRunning = true;
    state.startTime = Date.now();
  }
  await chrome.storage.local.set({ [key]: state });
  return state;
};

// Pause timer
const pauseTimer = async (url) => {
  const key = getTimerKey(url);
  const data = await chrome.storage.local.get(key);
  const state = data[key];

  if (state && state.isRunning) {
    if (state.startTime) {
      state.accumulatedTime += Math.floor((Date.now() - state.startTime) / 1000);
    }
    state.isRunning = false;
    state.startTime = null;
    await chrome.storage.local.set({ [key]: state });
  }
  return state || { startTime: null, accumulatedTime: 0, isRunning: false };
};

// Reset timer
const resetTimer = async (url) => {
  const key = getTimerKey(url);
  const state = {
    startTime: null,
    accumulatedTime: 0,
    isRunning: false
  };
  await chrome.storage.local.set({ [key]: state });
  return state;
};

// Listen to message calls
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PAGE_LOADED') {
    initializeTimer(message.url);
    return false; // Sync execution
  }

  if (message.action === 'START_TIMER') {
    startTimer(message.url).then(state => sendResponse(state));
    return true; // Keep channel open
  }

  if (message.action === 'PAUSE_TIMER') {
    pauseTimer(message.url).then(state => sendResponse(state));
    return true; // Keep channel open
  }

  if (message.action === 'RESET_TIMER') {
    resetTimer(message.url).then(state => sendResponse(state));
    return true; // Keep channel open
  }
});
