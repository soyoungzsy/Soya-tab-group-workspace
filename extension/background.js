importScripts('core.js');

const STORAGE_KEY = 'tabOutUsageV2';
const CHECKPOINT = 'tab-out-checkpoint';
const SESSION_CAP_MS = 5 * 60 * 1000;
let queue = Promise.resolve();
let idleState = 'active';

function enqueue(task) {
  queue = queue.then(task, task).catch(error => console.warn('Tab Out:', error));
}

async function loadState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || { installedAt: Date.now(), pages: {}, tabs: {}, active: null, reloadState: {} };
}

async function saveState(state) { await chrome.storage.local.set({ [STORAGE_KEY]: state }); }

function settle(state, now = Date.now()) {
  if (!state.active) return state;
  const elapsed = Math.min(SESSION_CAP_MS, Math.max(0, now - state.active.startedAt));
  const key = TabOutCore.normalizeUrl(state.active.url);
  state.pages[key] ||= { activeMs: 0, reloads: 0, lastActiveAt: 0 };
  state.pages[key].activeMs += elapsed;
  state.pages[key].lastActiveAt = now;
  state.active = null;
  return state;
}

async function currentTrackableTab() {
  if (idleState !== 'active') return null;
  const window = await chrome.windows.getLastFocused();
  if (!window?.focused) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
  return tab && /^https?:/i.test(tab.url || '') ? tab : null;
}

async function restartSession() {
  const now = Date.now();
  const state = settle(await loadState(), now);
  const tab = await currentTrackableTab();
  if (tab) {
    state.tabs[tab.id] ||= { createdAt: now };
    state.active = { tabId: tab.id, url: tab.url, startedAt: now };
  }
  await saveState(state);
}

async function rememberTab(tab) {
  const state = await loadState();
  state.tabs[tab.id] = { createdAt: Date.now() };
  await saveState(state);
}

async function removeTab(tabId) {
  const state = settle(await loadState());
  delete state.tabs[tabId];
  delete state.reloadState[tabId];
  await saveState(state);
  await restartSession();
}

async function observeUpdate(tabId, changeInfo, tab) {
  const state = await loadState();
  const url = changeInfo.url || tab.url || '';
  const previous = state.reloadState[tabId];
  if (!previous || previous.url !== url) {
    state.reloadState[tabId] = { url, complete: changeInfo.status === 'complete' };
    await saveState(state);
    if (changeInfo.url) await restartSession();
    return;
  }
  if (changeInfo.status === 'complete') previous.complete = true;
  if (changeInfo.status === 'loading' && previous.complete) {
    previous.complete = false;
    const key = TabOutCore.normalizeUrl(url);
    state.pages[key] ||= { activeMs: 0, reloads: 0, lastActiveAt: 0 };
    state.pages[key].reloads += 1;
  }
  await saveState(state);
}

async function updateBadge() {
  const tabs = await chrome.tabs.query({});
  const count = tabs.filter(tab => /^https?:/i.test(tab.url || '')).length;
  await chrome.action.setBadgeText({ text: count ? String(count) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: count > 20 ? '#c75b54' : count > 10 ? '#c38b32' : '#43865b' });
}

async function initialize() {
  idleState = await chrome.idle.queryState(60);
  const state = await loadState();
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  for (const tab of tabs) state.tabs[tab.id] ||= { createdAt: now };
  await saveState(settle(state, now));
  chrome.alarms.create(CHECKPOINT, { periodInMinutes: 1 });
  await Promise.all([restartSession(), updateBadge()]);
}

chrome.tabs.onActivated.addListener(() => enqueue(restartSession));
chrome.windows.onFocusChanged.addListener(() => enqueue(restartSession));
chrome.idle.onStateChanged.addListener(state => { idleState = state; enqueue(restartSession); });
chrome.tabs.onCreated.addListener(tab => enqueue(async () => { await rememberTab(tab); await updateBadge(); }));
chrome.tabs.onRemoved.addListener(tabId => enqueue(async () => { await removeTab(tabId); await updateBadge(); }));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status || changeInfo.url) enqueue(async () => { await observeUpdate(tabId, changeInfo, tab); await updateBadge(); });
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === CHECKPOINT) enqueue(restartSession); });
chrome.runtime.onInstalled.addListener(() => enqueue(initialize));
chrome.runtime.onStartup.addListener(() => enqueue(initialize));
enqueue(initialize);
