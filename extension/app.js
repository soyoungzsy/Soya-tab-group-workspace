'use strict';

const USAGE_KEY = 'tabOutUsageV2';
const COLORS = { grey: '#8b9098', blue: '#4f86da', red: '#d66565', yellow: '#d2aa3d', green: '#52a16d', pink: '#d675a5', purple: '#8c72d7', cyan: '#3fa8b7', orange: '#dc854c' };
const CONFIG = globalThis.TAB_WORKSPACE_CONFIG || {};
const AUTO_GROUP_COLORS = { AI: 'blue', Data: 'cyan', 数据: 'cyan', Docs: 'green', 文档: 'green', Design: 'purple', 设计: 'purple', Collaboration: 'yellow', 协作: 'yellow', Learning: 'blue', 学习: 'blue', ...(CONFIG.categoryColors || {}) };
const esc = TabOutCore.escapeHtml;
let dashboard = { tabs: [], groups: [], groupModels: [], groupOrder: [], usage: {}, duplicates: new Map(), misclassified: [], learning: [] };
let dragging = null;

function applyConfig() {
  const title = CONFIG.title || 'My Tab Workspace';
  document.title = title;
  document.getElementById('workspaceTitle').textContent = title;
  document.getElementById('workspaceAvatar').src = CONFIG.avatar || 'icons/icon128.png';
  document.documentElement.style.setProperty('--accent', CONFIG.accentColor || '#65786d');
  document.querySelector('.header-almanac').hidden = CONFIG.showAlmanac === false;
}

function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const duration = .25, buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) { const p = i / data.length, envelope = p < .1 ? p / .1 : Math.pow(1 - (p - .1) / .9, 1.5); data[i] = (Math.random() * 2 - 1) * envelope; }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), now = ctx.currentTime;
    source.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = 2; filter.frequency.setValueAtTime(4200, now); filter.frequency.exponentialRampToValueAtTime(320, now + duration); gain.gain.setValueAtTime(.28, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration); source.connect(filter).connect(gain).connect(ctx.destination); source.start(now); setTimeout(() => ctx.close(), 500);
  } catch {}
}

function shootConfetti(x, y) {
  const colors = ['#ff8f70', '#ffc65a', '#73c6b6', '#8ca8f8', '#d99ae7', '#ffb6c8'];
  for (let i = 0; i < 34; i++) {
    const piece = document.createElement('i'), size = 5 + Math.random() * 6, angle = Math.random() * Math.PI * 2, speed = 60 + Math.random() * 120, started = performance.now(), duration = 700 + Math.random() * 200;
    piece.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:${i % 2 ? '50%' : '2px'};pointer-events:none;z-index:9999`;
    document.body.appendChild(piece);
    function frame(now) { const elapsed = (now - started) / 1000, progress = (now - started) / duration; if (progress >= 1) return piece.remove(); const px = Math.cos(angle) * speed * elapsed, py = (Math.sin(angle) * speed - 80) * elapsed + 100 * elapsed * elapsed; piece.style.transform = `translate(${px}px,${py}px) rotate(${elapsed * 240}deg)`; piece.style.opacity = String(1 - progress); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
  }
}

function celebrate(element = document.body) {
  const rect = element.getBoundingClientRect();
  playCloseSound();
  shootConfetti(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 120));
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 1800);
}

function formatDuration(milliseconds = 0) {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function formatAgo(timestamp) {
  if (!timestamp) return '尚未记录';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 60) return `${Math.max(0, minutes)} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function favicon(tab) {
  if (tab.favIconUrl && /^https?:|^data:/i.test(tab.favIconUrl)) return `<img src="${esc(tab.favIconUrl)}" alt="">`;
  return `<span>${esc(TabOutCore.siteName(tab).slice(0, 1))}</span>`;
}

async function renderDailySign() {
  const now = new Date();
  const locale = CONFIG.almanacLocale || navigator.language || 'zh-CN';
  const rhythm = TabOutCore.sexagenaryDay(now);
  const solarTerm = TabOutCore.solarTermInfo(now);
  const advice = TabOutCore.elementAdvice(rhythm.element);
  document.getElementById('dailyDateLine').textContent = now.toLocaleDateString(locale, { month: 'short', day: '2-digit', weekday: 'short' });
  document.getElementById('dailyTime').textContent = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  document.getElementById('dailyTerm').textContent = solarTerm.label;
  document.getElementById('dailyElement').textContent = `${rhythm.label}日 · ${rhythm.element}`;
  document.getElementById('dailySuitable').textContent = advice.suitable;
  document.getElementById('dailyCaution').textContent = advice.caution;
  if (!renderDailySign.timer) renderDailySign.timer = setInterval(renderDailySign, 60000);
}

async function readChromeState() {
  const allTabs = await chrome.tabs.query({});
  const workspaceUrl = chrome.runtime.getURL('index.html');
  const emptyNewTabs = allTabs.filter(tab => TabOutCore.isEmptyNewTab(tab, workspaceUrl));
  const tabs = allTabs.filter(tab => /^https?:|^file:/i.test(tab.url || ''));
  const groupIds = [...new Set(tabs.map(tab => tab.groupId).filter(id => id !== TabOutCore.TAB_GROUP_NONE))];
  const groups = (await Promise.all(groupIds.map(id => chrome.tabGroups.get(id).catch(() => null)))).filter(Boolean);
  const stored = await chrome.storage.local.get([USAGE_KEY, 'tabOutReviewIgnoredV1', 'tabOutGroupOrderV1']);
  const usage = stored[USAGE_KEY] || { installedAt: Date.now(), pages: {}, tabs: {} };
  const groupOrder = stored.tabOutGroupOrderV1 || [];
  const groupModels = TabOutCore.applyGroupOrder(TabOutCore.buildGroupModel(tabs, groups, usage), groupOrder);
  const ignored = new Set(stored.tabOutReviewIgnoredV1 || []);
  return {
    tabs, groups, groupModels, groupOrder, usage,
    duplicates: TabOutCore.duplicateMap(tabs),
    misclassified: TabOutCore.findMisclassified(groupModels, groups).filter(item => !ignored.has(TabOutCore.normalizeUrl(tabs.find(tab => tab.id === item.tabId)?.url))),
    learning: TabOutCore.learningQueue(groupModels), emptyNewTabs,
  };
}

function renderMetrics() {
  const duplicateExtra = [...dashboard.duplicates.values()].reduce((sum, tabs) => sum + tabs.length - 1, 0);
  const learningIds = new Set(dashboard.learning.map(tab => tab.id));
  const enrichedTabs = dashboard.groupModels.flatMap(group => group.tabs);
  const recommended = enrichedTabs.filter(tab => !learningIds.has(tab.id) && TabOutCore.closeScore(tab) >= 100).length;
  const metrics = [
    [dashboard.tabs.length, '打开'], [dashboard.groupModels.filter(group => group.id !== -1).length, '分组'],
    [duplicateExtra, '重复'], [recommended, '待关闭'], [dashboard.learning.length, '待学习'],
  ];
  document.getElementById('metrics').innerHTML = metrics.map(([value, label]) => `<div class="metric"><b>${value}</b><span>${label}</span></div>`).join('');
}

function renderDuplicateStrip() {
  const root = document.getElementById('duplicateStrip');
  const extras = [...dashboard.duplicates.values()].reduce((sum, tabs) => sum + tabs.length - 1, 0);
  const emptyCount = dashboard.emptyNewTabs.length;
  root.hidden = extras === 0 && emptyCount === 0;
  if (root.hidden) return;
  root.innerHTML = `<div><strong>快速清理</strong><span>${extras ? `${extras} 个重复网页` : ''}${extras && emptyCount ? ' · ' : ''}${emptyCount ? `${emptyCount} 个多余新标签页` : ''}</span></div><div class="strip-actions">${extras ? '<button class="button danger" data-action="close-duplicates">清除重复页</button>' : ''}${emptyCount ? '<button class="button" data-action="close-empty-tabs">关闭多余新标签页</button>' : ''}</div>`;
}

function tabBadges(tab, duplicates, misclassified) {
  const badges = [];
  const duplicateCount = duplicates.get(TabOutCore.normalizeUrl(tab.url))?.length || 0;
  if (duplicateCount > 1) badges.push(`<span class="badge duplicate">重复 ${duplicateCount}</span>`);
  if (misclassified.has(tab.id)) badges.push('<span class="badge warning-badge">疑似错组</span>');
  if (dashboard.learning.some(item => item.id === tab.id)) badges.push('<span class="badge learning-badge">优先学习</span>');
  if (tab.pinned) badges.push('<span class="badge">已固定</span>');
  return badges.join('');
}

function layoutGroupMasonry() {
  const grid = document.getElementById('groups');
  if (!grid) return;
  const items = [...grid.querySelectorAll('.chrome-group')];
  for (const item of items) item.style.gridRowEnd = 'auto';
  for (const item of items) {
    const height = item.getBoundingClientRect().height;
    item.style.gridRowEnd = `span ${Math.ceil(height + 7)}`;
  }
}

function renderGroups(filter = '') {
  const root = document.getElementById('groups');
  const lower = filter.trim().toLowerCase();
  const misclassified = new Set(dashboard.misclassified.map(item => item.tabId));
  const suggestionByTab = new Map(dashboard.misclassified.map(item => [item.tabId, item]));
  const learningIds = new Set(dashboard.learning.map(item => item.id));
  const representativeIds = new Set(TabOutCore.collapseDuplicates(dashboard.tabs).map(tab => tab.id));
  root.innerHTML = dashboard.groupModels.map(group => {
    const allTabs = group.tabs.filter(tab => !lower || `${group.title} ${tab.title} ${tab.siteName}`.toLowerCase().includes(lower));
    const seen = new Set();
    const tabs = allTabs.filter(tab => {
      const key = TabOutCore.normalizeUrl(tab.url);
      if (!representativeIds.has(tab.id)) return false;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(tab => ({ ...tab, duplicateCount: dashboard.duplicates.get(TabOutCore.normalizeUrl(tab.url))?.length || 1 }));
    if (!tabs.length) return '';
    const learningGroup = ['AI', '学习'].includes(TabOutCore.categoryFromGroupTitle(group.title));
    const recommended = learningGroup ? [] : tabs.filter(tab => TabOutCore.closeScore(tab) >= 100);
    const duplicateExtras = tabs.filter(tab => (dashboard.duplicates.get(TabOutCore.normalizeUrl(tab.url))?.length || 0) > 1).length;
    const tabRows = tabs.map(tab => {
      const suggestion = suggestionByTab.get(tab.id);
      const inlineDecision = suggestion ? `<div class="inline-decision"><button class="text-button" data-action="move-tab" data-tab-id="${tab.id}" data-target-group="${suggestion.targetGroupId}">移到 ${esc(suggestion.targetCategory)}</button><button class="text-button" data-action="keep-group" data-tab-id="${tab.id}">留在 ${esc(group.title || '未分组')}</button></div>` : '';
      const closeLabel = learningIds.has(tab.id) ? '学完关闭' : '×';
      return `
      <li class="tab-row ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}">
        <div class="favicon tab-drag-handle" draggable="true" data-drag-type="tab" data-tab-id="${tab.id}" title="拖动到其他分组">${favicon(tab)}</div>
        <button class="tab-main" data-action="focus" data-tab-id="${tab.id}">
          <strong title="${esc(tab.title || tab.url)}">${esc(tab.title || tab.url)}</strong>
          <span>${esc(tab.siteName)} · 本周 ${formatDuration(tab.usage.activeMs || 0)} · 最后查看 ${formatAgo(tab.usage.lastActiveAt || tab.lastAccessed)}</span>
        </button>
        <div class="badges">${tabBadges(tab, dashboard.duplicates, misclassified)}</div>
        ${inlineDecision}
        <button class="${learningIds.has(tab.id) ? 'text-button done' : 'icon-button'}" data-action="${learningIds.has(tab.id) ? 'learned-close' : 'close'}" data-tab-id="${tab.id}" title="关闭">${closeLabel}</button>
      </li>`;
    }).join('');
    const showAutoGroup = group.id === TabOutCore.TAB_GROUP_NONE && allTabs.length > 0;
    return `<section class="chrome-group" data-group-id="${group.id}" style="--group-color:${COLORS[group.color] || COLORS.grey}">
      <header class="group-header" draggable="true" data-drag-type="group" data-group-id="${group.id}" title="按住拖动调整分组位置"><span class="drag-handle">⠿</span><span class="color-dot"></span><div><strong>${esc(group.title || '未命名分组')}</strong><span>${allTabs.length} 个标签 · ${tabs.length} 个不同网页</span></div><div class="group-actions">
        ${duplicateExtras ? `<button class="text-button" data-action="close-group-duplicates" data-group-id="${group.id}">清除重复</button>` : ''}
        ${recommended.length ? `<button class="text-button danger-text" data-action="close-recommended" data-group-id="${group.id}">关闭建议页 ${recommended.length}</button>` : ''}
        ${showAutoGroup ? '<button class="text-button auto-group" data-action="auto-group">一键自动分组</button>' : ''}
        <button class="text-button refresh-group" data-action="refresh-group" data-group-id="${group.id}">↻ 刷新整组</button>
        <button class="text-button danger-text" data-action="close-group" data-group-id="${group.id}">关闭整个分组</button>
      </div></header><ul class="tab-grid">${tabRows}</ul></section>`;
  }).join('') || '<div class="empty">没有匹配的网页</div>';
  requestAnimationFrame(layoutGroupMasonry);
}

async function closeDuplicates(scopeTabs = null) {
  const liveTabs = await chrome.tabs.query({});
  const scopeIds = scopeTabs ? new Set(scopeTabs.map(tab => tab.id)) : null;
  const candidates = liveTabs.filter(tab => (!scopeIds || scopeIds.has(tab.id)) && /^https?:/i.test(tab.url || ''));
  const { closeIds } = TabOutCore.planDuplicateCleanup(candidates);
  if (!closeIds.length) {
    showToast('重复网页已经清理完成');
    return { closed: 0, failed: 0 };
  }
  const results = await Promise.allSettled(closeIds.map(tabId => chrome.tabs.remove(tabId)));
  const closed = results.filter(result => result.status === 'fulfilled').length;
  const failed = results.length - closed;
  showToast(failed ? `已关闭 ${closed} 个，${failed} 个关闭失败` : `已关闭 ${closed} 个重复网页`);
  return { closed, failed };
}

async function refresh() {
  applyConfig();
  await renderDailySign();
  dashboard = await readChromeState();
  renderMetrics(); renderDuplicateStrip(); renderGroups(document.getElementById('searchInput').value);
}

document.getElementById('searchInput').addEventListener('input', event => renderGroups(event.target.value));
window.addEventListener('resize', () => {
  cancelAnimationFrame(layoutGroupMasonry.frame);
  layoutGroupMasonry.frame = requestAnimationFrame(layoutGroupMasonry);
});
document.addEventListener('dragstart', event => {
  if (event.target.closest('button') && !event.target.closest('.tab-main')) { event.preventDefault(); return; }
  const tabDragHandle = event.target.closest('[data-drag-type="tab"]');
  const groupHeader = event.target.closest('[data-drag-type="group"]');
  if (tabDragHandle) dragging = { type: 'tab', id: Number(tabDragHandle.dataset.tabId) };
  else if (groupHeader) dragging = { type: 'group', id: Number(groupHeader.dataset.groupId) };
  else return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${dragging.type}:${dragging.id}`);
  (tabDragHandle?.closest('.tab-row') || groupHeader.closest('.chrome-group')).classList.add('dragging');
});
document.addEventListener('dragover', event => {
  const group = event.target.closest('.chrome-group');
  if (!group || !dragging) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.drop-target').forEach(element => element.classList.remove('drop-target'));
  group.classList.add('drop-target');
});
document.addEventListener('drop', async event => {
  const target = event.target.closest('.chrome-group');
  if (!target || !dragging) return;
  event.preventDefault();
  const targetGroupId = Number(target.dataset.groupId);
  if (dragging.type === 'tab') {
    if (targetGroupId === TabOutCore.TAB_GROUP_NONE) await chrome.tabs.ungroup([dragging.id]);
    else await chrome.tabs.group({ tabIds: [dragging.id], groupId: targetGroupId });
    showToast(`已移动到「${target.querySelector('.group-header strong')?.textContent || '目标分组'}」`);
  } else if (dragging.type === 'group' && dragging.id !== targetGroupId) {
    const currentOrder = dashboard.groupOrder.length ? dashboard.groupOrder : dashboard.groupModels.map(group => group.id);
    const nextOrder = TabOutCore.reorderIds(currentOrder, dragging.id, targetGroupId);
    await chrome.storage.local.set({ tabOutGroupOrderV1: nextOrder });
    showToast('已保存分组显示顺序');
  }
  dragging = null;
  document.querySelectorAll('.dragging,.drop-target').forEach(element => element.classList.remove('dragging','drop-target'));
  await refresh();
});
document.addEventListener('dragend', () => {
  dragging = null;
  document.querySelectorAll('.dragging,.drop-target').forEach(element => element.classList.remove('dragging','drop-target'));
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const tabId = Number(button.dataset.tabId);
  const groupId = Number(button.dataset.groupId);
  if (action === 'refresh') return refresh();
  if (action === 'focus') {
    const tab = dashboard.tabs.find(item => item.id === tabId);
    if (tab) { await chrome.tabs.update(tabId, { active: true }); await chrome.windows.update(tab.windowId, { focused: true }); }
    return;
  }
  if (action === 'close' || action === 'learned-close') await chrome.tabs.remove(tabId);
  if (action === 'close-duplicates') {
    button.disabled = true; button.textContent = '清理中…';
    const result = await closeDuplicates();
    if (result.closed) celebrate(button);
  }
  if (action === 'close-empty-tabs') { const count = dashboard.emptyNewTabs.length; if (count) await chrome.tabs.remove(dashboard.emptyNewTabs.map(tab => tab.id)); showToast(`已关闭 ${count} 个多余新标签页`); celebrate(button); }
  if (action === 'close-group-duplicates') {
    button.disabled = true; button.textContent = '清理中…';
    const result = await closeDuplicates(dashboard.groupModels.find(group => group.id === groupId)?.tabs || []);
    if (result.closed) celebrate(button.closest('.chrome-group') || button);
  }
  if (action === 'close-recommended') {
    const group = dashboard.groupModels.find(item => item.id === groupId);
    const learningGroup = ['AI', '学习'].includes(TabOutCore.categoryFromGroupTitle(group?.title));
    const ids = learningGroup ? [] : (group?.tabs || []).filter(tab => TabOutCore.closeScore(tab) >= 100).map(tab => tab.id);
    if (ids.length) await chrome.tabs.remove(ids);
  }
  if (action === 'move-tab') await chrome.tabs.group({ tabIds: [tabId], groupId: Number(button.dataset.targetGroup) });
  if (action === 'auto-group') {
    const ungrouped = dashboard.groupModels.find(group => group.id === TabOutCore.TAB_GROUP_NONE)?.tabs || [];
    const plan = TabOutCore.planAutoGrouping(ungrouped, dashboard.groups);
    let moved = 0;
    for (const [targetGroupId, tabIds] of plan.moves) { await chrome.tabs.group({ tabIds, groupId: targetGroupId }); moved += tabIds.length; }
    for (const [category, tabIds] of plan.creates) {
      const newGroupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(newGroupId, { title: category, color: AUTO_GROUP_COLORS[category] || 'grey' });
      moved += tabIds.length;
    }
    showToast(moved ? `已自动分组 ${moved} 个网页，${plan.unresolved.length} 个待判断` : `暂时无法判断这 ${plan.unresolved.length} 个网页`);
  }
  if (action === 'keep-group') {
    const tab = dashboard.tabs.find(item => item.id === tabId), stored = await chrome.storage.local.get('tabOutReviewIgnoredV1');
    const ignored = new Set(stored.tabOutReviewIgnoredV1 || []); ignored.add(TabOutCore.normalizeUrl(tab?.url));
    await chrome.storage.local.set({ tabOutReviewIgnoredV1: [...ignored] });
  }
  if (action === 'refresh-group') {
    const ids = (dashboard.groupModels.find(group => group.id === groupId)?.tabs || []).map(tab => tab.id);
    await Promise.all(ids.map(id => chrome.tabs.reload(id).catch(() => null)));
    showToast(`已刷新 ${ids.length} 个网页`);
  }
  if (action === 'close-group') {
    const group = dashboard.groupModels.find(item => item.id === groupId), ids = (group?.tabs || []).map(tab => tab.id);
    if (ids.length && window.confirm(`确定关闭「${group?.title || '未分组'}」中的 ${ids.length} 个网页吗？`)) {
      await chrome.tabs.remove(ids); showToast(`已关闭 ${ids.length} 个网页`); celebrate(button.closest('.chrome-group') || button);
    }
  }
  await refresh();
});

refresh().catch(error => {
  document.getElementById('groups').innerHTML = `<div class="empty">加载失败：${esc(error.message)}。请在扩展管理页重新加载 Tab Out。</div>`;
});
