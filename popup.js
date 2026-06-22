// popup.js
// Handles LeetCode Companion UI and Gemini API integration

// Global State
let problemDetails = null;
let timerInterval = null;
let currentElapsedSeconds = 0;
let chatHistory = []; // Conversation history with Gemini
let activeTimerState = null;

// DOM Elements
const elements = {
  // Tabs
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  activeTabIndicator: document.getElementById('active-tab-indicator'),
  
  // Notes Tab
  detectionWarning: document.getElementById('detection-warning'),
  activeProblemInfo: document.getElementById('active-problem-info'),
  problemTitle: document.getElementById('problem-title'),
  problemDifficulty: document.getElementById('problem-difficulty'),
  problemTags: document.getElementById('problem-tags'),
  
  // Timer
  timerText: document.getElementById('timer-text'),
  btnTimerToggle: document.getElementById('btn-timer-toggle'),
  btnTimerReset: document.getElementById('btn-timer-reset'),
  svgPlay: document.getElementById('svg-play'),
  svgPause: document.getElementById('svg-pause'),
  
  // Complexity
  selectTimeComplexity: document.getElementById('select-time-complexity'),
  selectSpaceComplexity: document.getElementById('select-space-complexity'),
  
  // Notes Editor
  notesEditor: document.getElementById('notes-editor'),
  btnSaveNotes: document.getElementById('btn-save-notes'),
  btnExportMd: document.getElementById('btn-export-md'),
  
  // AI Tab
  aiKeyWarning: document.getElementById('ai-key-warning'),
  btnGoToSettings: document.getElementById('btn-go-to-settings'),
  chatMessagesContainer: document.getElementById('chat-messages-container'),
  aiChatInput: document.getElementById('ai-chat-input'),
  btnSendChat: document.getElementById('btn-send-chat'),
  suggestionChips: document.querySelectorAll('.ai-chip'),
  
  // History Tab
  btnClearHistory: document.getElementById('btn-clear-history'),
  historyList: document.getElementById('history-list'),
  
  // Settings Tab
  inputApiKey: document.getElementById('input-api-key'),
  selectModel: document.getElementById('select-model'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  settingsStatus: document.getElementById('settings-status')
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupSettings();
  setupTimerControls();
  setupNotesActions();
  setupAiChat();
  setupHistory();
  
  // Initial load
  await refreshData();
});

// 1. Tab Management
function setupTabs() {
  elements.tabButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const targetTabId = button.getAttribute('data-tab');
      
      // Update buttons
      elements.tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update panes
      elements.tabPanes.forEach(pane => pane.classList.remove('active'));
      const targetPane = document.getElementById(targetTabId);
      targetPane.classList.add('active');
      
      // Tab-specific loading
      if (targetTabId === 'tab-ai') {
        // Refresh code/context before opening chat, so AI has latest code
        await refreshData();
        checkApiKey();
        scrollToBottom();
      } else if (targetTabId === 'tab-history') {
        loadHistoryList();
      } else if (targetTabId === 'tab-notes') {
        await refreshData();
      }
    });
  });
  
  elements.btnGoToSettings.addEventListener('click', () => {
    // Click settings tab button
    const settingsBtn = document.querySelector('.tab-btn[data-tab="tab-settings"]');
    if (settingsBtn) settingsBtn.click();
  });
}

// 2. Data Refreshing and Scraper Integration
async function refreshData(loadFromStorage = true) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0] || !tabs[0].url || !tabs[0].url.includes('/problems/')) {
        showProblemDetectionError();
        resolve(null);
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_PROBLEM_DETAILS' }, async function(response) {
        if (chrome.runtime.lastError || !response || !response.success) {
          // Content script not ready or error
          showProblemDetectionError();
          resolve(null);
          return;
        }
        
        // Hide warning and show UI components
        elements.detectionWarning.classList.add('hide');
        elements.activeProblemInfo.classList.remove('hide');
        document.querySelector('.timer-section').classList.remove('hide');
        document.querySelector('.complexity-section').classList.remove('hide');
        document.querySelector('.notes-section').classList.remove('hide');
        document.querySelector('.actions-section').classList.remove('hide');
        elements.activeTabIndicator.textContent = "Active";
        elements.activeTabIndicator.classList.remove('inactive');
        
        problemDetails = {
          title: response.title,
          difficulty: response.difficulty,
          tags: response.tags,
          description: response.description,
          url: response.url,
          code: response.code
        };
        
        // Update basic info
        elements.problemTitle.textContent = problemDetails.title;
        
        // Set difficulty badge
        elements.problemDifficulty.textContent = problemDetails.difficulty;
        elements.problemDifficulty.className = 'diff-badge';
        const diffLower = problemDetails.difficulty.toLowerCase();
        if (diffLower === 'easy') elements.problemDifficulty.classList.add('difficulty-easy');
        else if (diffLower === 'medium') elements.problemDifficulty.classList.add('difficulty-medium');
        else if (diffLower === 'hard') elements.problemDifficulty.classList.add('difficulty-hard');
        
        // Set tags
        elements.problemTags.innerHTML = '';
        problemDetails.tags.slice(0, 4).forEach(tag => {
          const badge = document.createElement('span');
          badge.className = 'tag-badge';
          badge.textContent = tag;
          elements.problemTags.appendChild(badge);
        });
        
        if (loadFromStorage) {
          // Load draft or saved notes for this problem if they exist
          const storageKey = `notes_${problemDetails.url}`;
          const draftKey = `draft_${problemDetails.url}`;
          const storedData = await chrome.storage.local.get([storageKey, draftKey]);
          const draft = storedData[draftKey];
          const saved = storedData[storageKey];
          
          if (draft) {
            elements.notesEditor.value = draft.notes || "";
            elements.selectTimeComplexity.value = draft.timeComplexity || "";
            elements.selectSpaceComplexity.value = draft.spaceComplexity || "";
            chatHistory = draft.chatHistory || [];
          } else if (saved) {
            elements.notesEditor.value = saved.notes || "";
            elements.selectTimeComplexity.value = saved.timeComplexity || "";
            elements.selectSpaceComplexity.value = saved.spaceComplexity || "";
            chatHistory = saved.chatHistory || [];
          } else {
            elements.notesEditor.value = "";
            elements.selectTimeComplexity.value = "";
            elements.selectSpaceComplexity.value = "";
            chatHistory = [];
          }
          
          // Re-render chat messages from chatHistory
          renderChatHistory();
        }
        
        // Sync and start the timer
        syncTimerWithStorage(problemDetails.url);
        
        resolve(problemDetails);
      });
    });
  });
}

function showProblemDetectionError() {
  elements.detectionWarning.classList.remove('hide');
  elements.activeProblemInfo.classList.add('hide');
  document.querySelector('.timer-section').classList.add('hide');
  document.querySelector('.complexity-section').classList.add('hide');
  document.querySelector('.notes-section').classList.add('hide');
  document.querySelector('.actions-section').classList.add('hide');
  elements.activeTabIndicator.textContent = "Inactive";
  elements.activeTabIndicator.classList.add('inactive');
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// 3. Timer Implementation
async function syncTimerWithStorage(url) {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  const timerKey = `timer_${url}`;
  
  const updateTimerDisplay = async () => {
    const data = await chrome.storage.local.get(timerKey);
    const state = data[timerKey];
    activeTimerState = state;
    
    if (state) {
      if (state.isRunning && state.startTime) {
        currentElapsedSeconds = state.accumulatedTime + Math.floor((Date.now() - state.startTime) / 1000);
        elements.svgPause.classList.remove('hide');
        elements.svgPlay.classList.add('hide');
      } else {
        currentElapsedSeconds = state.accumulatedTime;
        elements.svgPause.classList.add('hide');
        elements.svgPlay.classList.remove('hide');
      }
    } else {
      currentElapsedSeconds = 0;
      elements.svgPause.classList.add('hide');
      elements.svgPlay.classList.remove('hide');
    }
    
    elements.timerText.textContent = formatTime(currentElapsedSeconds);
  };
  
  // Run once immediately
  await updateTimerDisplay();
  
  // Set ticking interval
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function setupTimerControls() {
  elements.btnTimerToggle.addEventListener('click', async () => {
    if (!problemDetails) return;
    
    const action = (activeTimerState && activeTimerState.isRunning) ? 'PAUSE_TIMER' : 'START_TIMER';
    chrome.runtime.sendMessage({
      action: action,
      url: problemDetails.url
    }, (updatedState) => {
      activeTimerState = updatedState;
      if (activeTimerState.isRunning) {
        elements.svgPause.classList.remove('hide');
        elements.svgPlay.classList.add('hide');
      } else {
        elements.svgPause.classList.add('hide');
        elements.svgPlay.classList.remove('hide');
      }
      elements.timerText.textContent = formatTime(getElapsedSeconds(activeTimerState));
    });
  });
  
  elements.btnTimerReset.addEventListener('click', async () => {
    if (!problemDetails) return;
    if (confirm("Are you sure you want to reset the timer?")) {
      chrome.runtime.sendMessage({
        action: 'RESET_TIMER',
        url: problemDetails.url
      }, (updatedState) => {
        activeTimerState = updatedState;
        currentElapsedSeconds = 0;
        elements.timerText.textContent = "00:00:00";
        elements.svgPause.classList.add('hide');
        elements.svgPlay.classList.remove('hide');
      });
    }
  });
}

function getElapsedSeconds(state) {
  if (!state) return 0;
  if (state.isRunning && state.startTime) {
    return state.accumulatedTime + Math.floor((Date.now() - state.startTime) / 1000);
  }
  return state.accumulatedTime;
}

function formatTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 4. Notes Saving & Markdown Exporting
function setupNotesActions() {
  elements.btnSaveNotes.addEventListener('click', async () => {
    if (!problemDetails) return;
    
    const notesText = elements.notesEditor.value;
    const timeComplexity = elements.selectTimeComplexity.value;
    const spaceComplexity = elements.selectSpaceComplexity.value;
    
    const storageKey = `notes_${problemDetails.url}`;
    const saveData = {
      url: problemDetails.url,
      title: problemDetails.title,
      difficulty: problemDetails.difficulty,
      tags: problemDetails.tags,
      description: problemDetails.description,
      code: problemDetails.code,
      notes: notesText,
      timeComplexity: timeComplexity,
      spaceComplexity: spaceComplexity,
      timeSpent: currentElapsedSeconds,
      savedAt: Date.now()
    };
    
    await chrome.storage.local.set({ [storageKey]: saveData });
    
    // Add to history index
    const historyData = await chrome.storage.local.get('saved_problems_list');
    let savedList = historyData['saved_problems_list'] || [];
    
    // Filter out existing index entries for the same problem URL
    savedList = savedList.filter(item => item.url !== problemDetails.url);
    
    // Prepend new entry
    savedList.unshift({
      url: problemDetails.url,
      title: problemDetails.title,
      difficulty: problemDetails.difficulty,
      timeSpent: currentElapsedSeconds,
      savedAt: Date.now()
    });
    
    await chrome.storage.local.set({ 'saved_problems_list': savedList });
    
    // UI Visual feedback
    const originalText = elements.btnSaveNotes.textContent;
    elements.btnSaveNotes.textContent = "Saved!";
    elements.btnSaveNotes.style.backgroundColor = "#059669";
    setTimeout(() => {
      elements.btnSaveNotes.textContent = originalText;
      elements.btnSaveNotes.style.backgroundColor = "";
    }, 2000);
  });
  
  elements.btnExportMd.addEventListener('click', () => {
    if (!problemDetails) return;
    
    const timeSpentFormatted = formatTime(currentElapsedSeconds);
    const timeComp = elements.selectTimeComplexity.value || "Not selected";
    const spaceComp = elements.selectSpaceComplexity.value || "Not selected";
    const notes = elements.notesEditor.value || "*No notes recorded.*";
    const lang = guessLanguage(problemDetails.code);
    
    const dateFormatted = new Date().toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const md = `# [${problemDetails.title}](${problemDetails.url})

- **Difficulty**: ${problemDetails.difficulty}
- **Time Spent**: ${timeSpentFormatted}
- **Time Complexity**: \`${timeComp}\`
- **Space Complexity**: \`${spaceComp}\`
- **Saved On**: ${dateFormatted}
- **Topics**: ${problemDetails.tags.join(', ') || 'None'}

## Problem Description
${problemDetails.description || '*No description loaded.*'}

## My Notes & Strategy
${notes}

## My Solution
\`\`\`${lang}
${problemDetails.code || '// Paste your solution here if empty'}
\`\`\`
`;
    
    // Generate filename slug
    const slug = problemDetails.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_+|_+$)/g, '');
    const filename = `leetcode_${slug}.md`;
    
    // Initiate client-side download
    const blob = new Blob([md], { type: 'text/markdown' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  });

  // Auto-save listeners for session drafts
  elements.notesEditor.addEventListener('input', () => {
    if (problemDetails) saveDraft(problemDetails.url);
  });
  
  elements.selectTimeComplexity.addEventListener('change', () => {
    if (problemDetails) saveDraft(problemDetails.url);
  });
  
  elements.selectSpaceComplexity.addEventListener('change', () => {
    if (problemDetails) saveDraft(problemDetails.url);
  });
}

async function saveDraft(url) {
  if (!url) return;
  const draftData = {
    notes: elements.notesEditor.value,
    timeComplexity: elements.selectTimeComplexity.value,
    spaceComplexity: elements.selectSpaceComplexity.value,
    chatHistory: chatHistory
  };
  await chrome.storage.local.set({ [`draft_${url}`]: draftData });
}

function guessLanguage(code) {
  if (!code) return 'txt';
  const c = code.trim();
  if (c.includes('def ') && c.includes(':')) return 'python';
  if (c.includes('function') || c.includes('const ') || c.includes('let ')) return 'javascript';
  if (c.includes('#include') || c.includes('std::')) return 'cpp';
  if (c.includes('public class') || c.includes('import java.')) return 'java';
  if (c.includes('using System;') || c.includes('namespace ')) return 'csharp';
  return 'code';
}

// 5. AI Chat Companion
async function checkApiKey() {
  const data = await chrome.storage.local.get(['gemini_api_key', 'gemini_model']);
  const apiKey = data['gemini_api_key'];
  if (!apiKey) {
    elements.aiKeyWarning.classList.remove('hide');
  } else {
    elements.aiKeyWarning.classList.add('hide');
  }
}

function setupAiChat() {
  elements.btnSendChat.addEventListener('click', () => sendUserChatMessage());
  
  elements.aiChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserChatMessage();
    }
  });
  
  elements.suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      elements.aiChatInput.value = prompt;
      sendUserChatMessage();
    });
  });
}

async function sendUserChatMessage() {
  const text = elements.aiChatInput.value.trim();
  if (!text) return;
  
  // Clear input
  elements.aiChatInput.value = '';
  
  // Get active API config
  const config = await chrome.storage.local.get(['gemini_api_key', 'gemini_model']);
  const apiKey = config['gemini_api_key'];
  const model = config['gemini_model'] || 'gemini-2.5-flash';
  
  if (!apiKey) {
    checkApiKey();
    return;
  }
  
  // Append user bubble to UI
  appendChatMessage('user', text);
  scrollToBottom();
  
  // Add to conversational history
  chatHistory.push({
    role: 'user',
    parts: [{ text: text }]
  });
  
  // Save draft for this user message
  if (problemDetails) saveDraft(problemDetails.url);
  
  // Show typing indicator
  const typingIndicator = appendTypingIndicator();
  scrollToBottom();
  
  try {
    // Refresh latest editor code from LeetCode right before prompting (but don't reload notes/chat from storage)
    await refreshData(false);
    
    // Construct system prompt context
    const sysPrompt = `You are an expert software engineering interviewer and LeetCode coach. 
Your goal is to guide the user to solve the problem without giving away the direct solution immediately. 
Provide hints, conceptual guidance, point out edge cases, or analyze code complexity. 
If they explicitly ask you to explain their code or write the solution, you can do so, but always prioritize helping them learn.

Here is the context of the LeetCode problem they are currently working on:
- Problem: ${problemDetails ? problemDetails.title : 'Unknown'}
- URL: ${problemDetails ? problemDetails.url : 'Unknown'}
- Difficulty: ${problemDetails ? problemDetails.difficulty : 'Unknown'}
- Topics/Tags: ${problemDetails ? problemDetails.tags.join(', ') : 'None'}

Current problem description:
${problemDetails ? problemDetails.description : 'Not available'}

User's current editor code:
\`\`\`
${problemDetails ? problemDetails.code : '// No code loaded in editor yet.'}
\`\`\`

Respond concisely with clear Markdown formatting.`;

    const requestBody = {
      contents: chatHistory,
      systemInstruction: {
        parts: [{ text: sysPrompt }]
      }
    };
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error (${response.status}): ${errText}`);
    }
    
    // Remove indicator
    typingIndicator.remove();
    
    // Create streaming assistant message bubble
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message assistant';
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    wrapper.appendChild(messageContent);
    elements.chatMessagesContainer.appendChild(wrapper);
    scrollToBottom();
    
    let fullReplyText = '';
    
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const partText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (partText) {
                fullReplyText += partText;
                messageContent.innerHTML = formatMarkdown(fullReplyText);
                scrollToBottom();
              }
            } catch (e) {
              // Ignore partial parsing errors since chunks might be combined later
            }
          }
        }
      }
      
      // Process any remaining data in the buffer
      if (buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const partText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (partText) {
            fullReplyText += partText;
            messageContent.innerHTML = formatMarkdown(fullReplyText);
            scrollToBottom();
          }
        } catch (e) {}
      }
    } else {
      throw new Error("Streaming not supported by browser connection");
    }
    
    // Save to conversational memory
    chatHistory.push({
      role: 'model',
      parts: [{ text: fullReplyText }]
    });
    
    // Save draft for this assistant response
    if (problemDetails) saveDraft(problemDetails.url);
    
  } catch (err) {
    console.error("AI Companion error:", err);
    typingIndicator.remove();
    appendChatMessage('assistant', `⚠️ Sorry, I encountered an error: ${err.message}. Please verify your API key and connection.`);
    scrollToBottom();
  }
}

function renderChatHistory() {
  elements.chatMessagesContainer.innerHTML = '';
  
  if (chatHistory.length === 0) {
    appendChatMessage('assistant', "Hello! I am your LeetCode AI Companion. How can I help you with today's problem? Click one of the quick suggestions above or write a message.");
    return;
  }
  
  chatHistory.forEach(msg => {
    const sender = msg.role === 'user' ? 'user' : 'assistant';
    const text = msg.parts[0].text;
    appendChatMessage(sender, text);
  });
  
  scrollToBottom();
}

function appendChatMessage(sender, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${sender}`;
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  if (sender === 'assistant') {
    content.innerHTML = formatMarkdown(text);
  } else {
    content.textContent = text;
  }
  
  wrapper.appendChild(content);
  elements.chatMessagesContainer.appendChild(wrapper);
}

function appendTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-message assistant';
  
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  
  wrapper.appendChild(indicator);
  elements.chatMessagesContainer.appendChild(wrapper);
  return wrapper;
}

function scrollToBottom() {
  elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
}

function formatMarkdown(text) {
  // Simple markdown parser to avoid external lib dependencies
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Code blocks (```lang\ncode\n```)
  html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  });
  
  // Inline code (`code`)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  
  // Bold (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Bullets
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  
  // Convert newlines (excluding those in pre blocks)
  const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].startsWith('<pre>')) {
      parts[i] = parts[i].replace(/\n/g, '<br>');
    }
  }
  return parts.join('');
}

// 6. History List Implementation
async function loadHistoryList() {
  const historyData = await chrome.storage.local.get('saved_problems_list');
  const savedList = historyData['saved_problems_list'] || [];
  
  elements.historyList.innerHTML = '';
  
  if (savedList.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'no-history';
    emptyMsg.textContent = 'No saved problems found. Click "Save Progress" on a LeetCode problem page!';
    elements.historyList.appendChild(emptyMsg);
    return;
  }
  
  savedList.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    // Clicking loads problem or opens it
    historyItem.addEventListener('click', (e) => {
      // Check if clicked the delete button to prevent double trigger
      if (e.target.closest('.history-action-btn')) return;
      
      // Navigate to problem URL
      chrome.tabs.create({ url: item.url });
    });
    
    const details = document.createElement('div');
    details.className = 'history-item-details';
    
    const title = document.createElement('span');
    title.className = 'history-item-title';
    title.textContent = item.title;
    
    const sub = document.createElement('div');
    sub.className = 'history-item-sub';
    
    const diffBadge = document.createElement('span');
    diffBadge.className = 'history-item-diff';
    diffBadge.textContent = item.difficulty;
    const diffLower = item.difficulty.toLowerCase();
    if (diffLower === 'easy') diffBadge.style.color = '#065f46';
    else if (diffLower === 'medium') diffBadge.style.color = '#92400e';
    else if (diffLower === 'hard') diffBadge.style.color = '#991b1b';
    
    const timerText = document.createElement('span');
    timerText.textContent = `⏱️ ${formatTime(item.timeSpent)}`;
    
    sub.appendChild(diffBadge);
    sub.appendChild(timerText);
    details.appendChild(title);
    details.appendChild(sub);
    
    const actions = document.createElement('div');
    actions.className = 'history-item-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'history-action-btn';
    deleteBtn.title = 'Delete saved progress';
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
    
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Remove saved progress for "${item.title}"?`)) {
        await deleteHistoryItem(item.url);
        loadHistoryList();
      }
    });
    
    actions.appendChild(deleteBtn);
    historyItem.appendChild(details);
    historyItem.appendChild(actions);
    elements.historyList.appendChild(historyItem);
  });
}

async function deleteHistoryItem(url) {
  // Remove notes, timers, and drafts keys
  await chrome.storage.local.remove(`notes_${url}`);
  await chrome.storage.local.remove(`timer_${url}`);
  await chrome.storage.local.remove(`draft_${url}`);
  
  // Remove from index
  const historyData = await chrome.storage.local.get('saved_problems_list');
  let savedList = historyData['saved_problems_list'] || [];
  savedList = savedList.filter(item => item.url !== url);
  await chrome.storage.local.set({ 'saved_problems_list': savedList });
}

function setupHistory() {
  elements.btnClearHistory.addEventListener('click', async () => {
    if (confirm("Are you sure you want to clear ALL saved problems, notes, and timers? This action cannot be undone.")) {
      const historyData = await chrome.storage.local.get('saved_problems_list');
      const savedList = historyData['saved_problems_list'] || [];
      
      // Remove all notes, drafts & timers keys
      for (const item of savedList) {
        await chrome.storage.local.remove(`notes_${item.url}`);
        await chrome.storage.local.remove(`timer_${item.url}`);
        await chrome.storage.local.remove(`draft_${item.url}`);
      }
      
      // Clear index
      await chrome.storage.local.remove('saved_problems_list');
      loadHistoryList();
    }
  });
}

// 7. Settings Management
async function setupSettings() {
  const data = await chrome.storage.local.get(['gemini_api_key', 'gemini_model']);
  if (data['gemini_api_key']) {
    elements.inputApiKey.value = data['gemini_api_key'];
  }
  if (data['gemini_model']) {
    elements.selectModel.value = data['gemini_model'];
  }
  
  elements.btnSaveSettings.addEventListener('click', async () => {
    const apiKey = elements.inputApiKey.value.trim();
    const model = elements.selectModel.value;
    
    await chrome.storage.local.set({
      gemini_api_key: apiKey,
      gemini_model: model
    });
    
    // Status visual feedback
    elements.settingsStatus.classList.remove('hide');
    setTimeout(() => {
      elements.settingsStatus.classList.add('hide');
    }, 2500);
    
    checkApiKey();
  });
}
