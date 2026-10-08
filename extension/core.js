'use strict';

const TAB_GROUP_NONE = -1;
const DAY_MS = 86400000;
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ELEMENT_BY_STEM = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const SOLAR_TERMS = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
const SOLAR_TERM_MINUTES = [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758];

const BRAND_NAMES = {
  'github.com': 'GitHub', 'www.github.com': 'GitHub',
  'x.com': 'X', 'www.x.com': 'X', 'twitter.com': 'X',
  'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT',
  'claude.ai': 'Claude', 'gemini.google.com': 'Gemini',
  'deepseek.com': 'DeepSeek', 'www.deepseek.com': 'DeepSeek',
  'youtube.com': 'YouTube', 'www.youtube.com': 'YouTube',
  'bilibili.com': 'Bilibili', 'www.bilibili.com': 'Bilibili',
  'yuque.com': '语雀', 'www.yuque.com': '语雀',
  'docs.google.com': 'Google 文档', 'drive.google.com': 'Google 云盘',
  'mail.google.com': 'Gmail', 'calendar.google.com': 'Google 日历',
  'figma.com': 'Figma', 'www.figma.com': 'Figma',
  'notion.so': 'Notion', 'www.notion.so': 'Notion',
  'localhost': '本地项目',
};

const DEFAULT_CATEGORY_RULES = [
  { category: 'AI', hosts: /openai|chatgpt|claude|anthropic|gemini|deepseek|huggingface|replicate|cursor|perplexity/i, words: /\bAI\b|人工智能|大模型|模型|智能体|Agent|Skill|Prompt|提示词|深度探索/i },
  { category: '数据', hosts: /data|insight|analytics|tableau|dataphin|odps|traffic/i, words: /数据|报表|分析|指标|看板|流量|转化|漏斗|Data|Analytics|Insight/i },
  { category: '文档', hosts: /yuque|notion|docs\.google|confluence|feishu|lark/i, words: /文档|知识库|语雀|纪要|方案|Docs|Document|Wiki/i },
  { category: '设计', hosts: /figma|canva|dribbble|behance|design/i, words: /设计|素材|视觉|图片|海报|Design|Creative/i },
  { category: '协作', hosts: /dingtalk|slack|lark|mail|calendar|meet|zoom/i, words: /钉钉|邮件|日程|会议|待办|协作|Mail|Calendar|Meeting/i },
  { category: '学习', hosts: /youtube|bilibili|coursera|udemy|medium|substack|arxiv/i, words: /学习|课程|教程|论文|手册|指南|视频|Study|Learn|Tutorial|Course|Paper/i },
];

function categoryRules() {
  return [...(globalThis.TAB_WORKSPACE_CONFIG?.categoryRules || []), ...DEFAULT_CATEGORY_RULES];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'spm', 'from'].forEach(key => url.searchParams.delete(key));
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    return url.toString();
  } catch { return rawUrl || ''; }
}

function hostnameOf(rawUrl) {
  try { return new URL(rawUrl).hostname; } catch { return ''; }
}

function isEmptyNewTab(tab, workspaceUrl = '') {
  const url = tab?.url || '';
  return !tab?.active && (!url || url === 'about:blank' || url === 'chrome://newtab/' || (workspaceUrl && url === workspaceUrl));
}

function sexagenaryDay(dateInput) {
  const date = new Date(dateInput);
  const anchor = new Date('2026-10-07T00:00:00+08:00');
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const anchorLocal = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const offset = Math.round((day - anchorLocal) / DAY_MS);
  const index = ((50 + offset) % 60 + 60) % 60;
  const stem = STEMS[index % 10], branch = BRANCHES[index % 12];
  return { stem, branch, label: `${stem}${branch}`, element: ELEMENT_BY_STEM[stem] };
}

function elementAdvice(element) {
  const advice = {
    木:{ suitable:'学习、梳理、定方向', caution:'新增战线、替别人接管' },
    火:{ suitable:'表达、推进、做决定', caution:'着急承诺、情绪化扩张' },
    土:{ suitable:'收口、复盘、补证据', caution:'背负过多、停在整理' },
    金:{ suitable:'取舍、定边界、验结果', caution:'过度苛责、只看缺口' },
    水:{ suitable:'观察、研究、恢复节奏', caution:'信息漫游、迟迟不定' },
  };
  return advice[element] || advice.木;
}

function solarTermDate(year, index) {
  const base = Date.UTC(1900, 0, 6, 2, 5);
  return new Date(base + 31556925974.7 * (year - 1900) + SOLAR_TERM_MINUTES[index] * 60000);
}

function solarTermInfo(dateInput) {
  const date = new Date(dateInput), today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const candidates = [];
  for (const year of [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]) {
    SOLAR_TERMS.forEach((name, index) => {
      const raw = solarTermDate(year, index), day = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
      candidates.push({ name, day });
    });
  }
  candidates.sort((a, b) => a.day - b.day);
  const exact = candidates.find(item => item.day.getTime() === today.getTime());
  if (exact) return { name: exact.name, label: `今日${exact.name}` };
  const previous = [...candidates].reverse().find(item => item.day < today);
  const next = candidates.find(item => item.day > today);
  const days = next ? Math.round((next.day - today) / DAY_MS) : 0;
  return { name: previous?.name || '', label: next ? `${previous?.name || ''} · ${days}天后${next.name}` : previous?.name || '' };
}

function siteName(tab) {
  const host = hostnameOf(tab.url);
  if (BRAND_NAMES[host]) return BRAND_NAMES[host];
  const title = String(tab.title || '').split(/\s[-–—|·]\s/).pop()?.trim();
  if (title && title.length <= 24 && !/^https?:/i.test(title)) return title;
  return host.replace(/^www\./, '') || '未知网页';
}

function inferCategory(tab) {
  const host = hostnameOf(tab.url);
  const haystack = `${host} ${tab.title || ''}`;
  for (const rule of categoryRules()) {
    if (rule.hosts.test(host) || rule.words.test(haystack)) return rule.category;
  }
  return '';
}

function categoryFromGroupTitle(title) {
  const text = String(title || '');
  const custom = (globalThis.TAB_WORKSPACE_CONFIG?.categoryRules || []).find(rule => text.toLowerCase().includes(String(rule.category).toLowerCase()));
  if (custom) return custom.category;
  if (/AI|人工智能|大模型/i.test(text)) return 'AI';
  if (/数据|报表|分析|\bData\b|Analytics/i.test(text)) return '数据';
  if (/文档|知识|资料|Docs?|Knowledge/i.test(text)) return '文档';
  if (/设计|素材|视觉|Design|Creative/i.test(text)) return '设计';
  if (/协作|沟通|会议|待办|Collaboration|Meeting/i.test(text)) return '协作';
  if (/学习|课程|阅读|Learning|Study|Research/i.test(text)) return '学习';
  return '';
}

function duplicateMap(tabs) {
  const map = new Map();
  for (const tab of tabs) {
    const key = normalizeUrl(tab.url);
    if (!key || !/^https?:/i.test(key)) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tab);
  }
  return new Map([...map].filter(([, items]) => items.length > 1));
}

function collapseDuplicates(tabs) {
  const duplicates = duplicateMap(tabs), hiddenIds = new Set(), representativeByUrl = new Map();
  for (const [url, copies] of duplicates) {
    const representative = copies.find(tab => tab.active) || [...copies].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    representativeByUrl.set(url, representative.id);
    for (const tab of copies) if (tab.id !== representative.id) hiddenIds.add(tab.id);
  }
  return tabs.filter(tab => !hiddenIds.has(tab.id)).map(tab => ({ ...tab, duplicateCount: duplicates.get(normalizeUrl(tab.url))?.length || 1 }));
}

function reorderIds(order, movingId, targetId) {
  const ids = [...new Set(order.map(Number))].filter(id => id !== Number(movingId));
  const targetIndex = ids.indexOf(Number(targetId));
  if (targetIndex === -1) ids.push(Number(movingId));
  else ids.splice(targetIndex, 0, Number(movingId));
  return ids;
}

function applyGroupOrder(groups, order = []) {
  const positions = new Map(order.map((id, index) => [Number(id), index]));
  return [...groups].sort((a, b) => {
    const aPosition = positions.has(a.id) ? positions.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bPosition = positions.has(b.id) ? positions.get(b.id) : Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
}

function planAutoGrouping(tabs, groups) {
  const existing = new Map();
  for (const group of groups) {
    const category = categoryFromGroupTitle(group.title);
    if (category && !existing.has(category)) existing.set(category, group.id);
  }
  const moves = new Map(), creates = new Map(), unresolved = [];
  for (const tab of tabs) {
    const category = tab.inferredCategory || inferCategory(tab);
    if (!category) { unresolved.push(tab.id); continue; }
    const targetId = existing.get(category);
    const bucket = targetId == null ? creates : moves;
    const key = targetId == null ? category : targetId;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push(tab.id);
  }
  return { moves, creates, unresolved };
}

function buildGroupModel(tabs, groups, usage = {}) {
  const metadata = new Map(groups.map(group => [group.id, group]));
  const result = new Map();
  for (const group of groups) result.set(group.id, { ...group, tabs: [] });
  for (const tab of tabs) {
    const groupId = metadata.has(tab.groupId) ? tab.groupId : TAB_GROUP_NONE;
    const group = metadata.get(groupId) || { id: TAB_GROUP_NONE, title: '未分组', color: 'grey', collapsed: false };
    if (!result.has(groupId)) result.set(groupId, { ...group, tabs: [] });
    const pageUsage = usage.pages?.[normalizeUrl(tab.url)] || {};
    result.get(groupId).tabs.push({ ...tab, createdAt: usage.tabs?.[tab.id]?.createdAt || 0, siteName: siteName(tab), inferredCategory: inferCategory(tab), usage: pageUsage });
  }
  return [...result.values()].filter(group => group.tabs.length).sort((a, b) => a.id === TAB_GROUP_NONE ? 1 : b.id === TAB_GROUP_NONE ? -1 : a.title.localeCompare(b.title, 'zh-CN'));
}

function findMisclassified(groupModels, availableGroups = groupModels) {
  const targetByCategory = new Map();
  for (const group of availableGroups) {
    const category = categoryFromGroupTitle(group.title);
    if (category && !targetByCategory.has(category)) targetByCategory.set(category, group.id);
  }
  const suggestions = [];
  for (const group of groupModels) {
    const groupCategory = categoryFromGroupTitle(group.title);
    for (const tab of group.tabs) {
      if (!tab.inferredCategory || !targetByCategory.has(tab.inferredCategory)) continue;
      if (groupCategory === tab.inferredCategory) continue;
      suggestions.push({ tabId: tab.id, fromGroupId: group.id, targetGroupId: targetByCategory.get(tab.inferredCategory), targetCategory: tab.inferredCategory, reason: `内容更像「${tab.inferredCategory}」` });
    }
  }
  return suggestions;
}

function learningQueue(groupModels) {
  const queue = [];
  for (const group of groupModels) {
    const groupCategory = categoryFromGroupTitle(group.title);
    for (const tab of group.tabs) {
      if (groupCategory === 'AI' || groupCategory === '学习' || tab.inferredCategory === 'AI' || tab.inferredCategory === '学习') queue.push(tab);
    }
  }
  return queue.sort((a, b) => (a.usage.activeMs || 0) - (b.usage.activeMs || 0));
}

function closeScore(tab, now = Date.now()) {
  if (tab.pinned || tab.active || (tab.createdAt && now - tab.createdAt < DAY_MS)) return 0;
  const activeMs = tab.usage?.activeMs || 0;
  const reloads = tab.usage?.reloads || 0;
  const lastActive = tab.usage?.lastActiveAt || tab.lastAccessed || 0;
  const inactiveDays = lastActive ? Math.max(0, (now - lastActive) / DAY_MS) : 7;
  return Math.round(Math.min(100, inactiveDays * 12) + Math.max(0, 60 - activeMs / 60000 * 3) + Math.max(0, 20 - reloads * 4));
}

const api = { TAB_GROUP_NONE, DAY_MS, escapeHtml, normalizeUrl, hostnameOf, isEmptyNewTab, sexagenaryDay, elementAdvice, solarTermInfo, siteName, inferCategory, categoryFromGroupTitle, duplicateMap, collapseDuplicates, reorderIds, applyGroupOrder, planAutoGrouping, buildGroupModel, findMisclassified, learningQueue, closeScore };
if (typeof module !== 'undefined') module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.TabOutCore = api;
