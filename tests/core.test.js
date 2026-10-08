'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');

test('groups tabs strictly by existing Chrome group', () => {
  const tabs = [{ id: 1, groupId: 10, url: 'https://github.com/a', title: 'A' }, { id: 2, groupId: 20, url: 'https://github.com/b', title: 'B' }];
  const groups = [{ id: 10, title: 'AI', color: 'blue' }, { id: 20, title: '工作', color: 'red' }];
  const result = C.buildGroupModel(tabs, groups);
  assert.deepEqual(new Map(result.map(group => [group.id, group.tabs.map(tab => tab.id)])), new Map([[10, [1]], [20, [2]]]));
});

test('normalizes tracking params and detects duplicate pages', () => {
  const tabs = [{ id: 1, url: 'https://a.test/page?utm_source=x#top' }, { id: 2, url: 'https://a.test/page' }];
  assert.equal(C.duplicateMap(tabs).size, 1);
});

test('shows one representative for duplicate pages and keeps the latest copy', () => {
  const tabs = [{ id: 1, url: 'https://a.test/page', lastAccessed: 10 }, { id: 2, url: 'https://a.test/page#x', lastAccessed: 20 }];
  const visible = C.collapseDuplicates(tabs);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 2);
  assert.equal(visible[0].duplicateCount, 2);
});

test('suggests a high-confidence target group without moving the tab', () => {
  const tabs = [{ id: 1, groupId: 10, url: 'https://figma.com/file/1', title: '海报设计' }];
  const groups = [{ id: 10, title: 'AI', color: 'blue' }, { id: 20, title: '设计', color: 'purple' }];
  const models = C.buildGroupModel(tabs, groups);
  assert.deepEqual(C.findMisclassified(models, groups)[0], {
    tabId: 1, fromGroupId: 10, targetGroupId: 20, targetCategory: '设计', reason: '内容更像「设计」',
  });
});

test('puts AI and learning pages into the learning queue', () => {
  const tabs = [{ id: 1, groupId: 10, url: 'https://chatgpt.com', title: 'ChatGPT' }, { id: 2, groupId: 20, url: 'https://example.com', title: '普通页面' }];
  const groups = [{ id: 10, title: 'AI', color: 'blue' }, { id: 20, title: '工作', color: 'red' }];
  assert.deepEqual(C.learningQueue(C.buildGroupModel(tabs, groups)).map(tab => tab.id), [1]);
});

test('keeps brands and translates known utility sites', () => {
  assert.equal(C.siteName({ url: 'https://github.com/a', title: 'Repo' }), 'GitHub');
  assert.equal(C.siteName({ url: 'https://www.yuque.com/a', title: '文档' }), '语雀');
});

test('escapes untrusted tab titles', () => {
  assert.equal(C.escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});

test('protects active, pinned and newly opened tabs from close suggestions', () => {
  const now = Date.now();
  assert.equal(C.closeScore({ active: true, usage: {} }, now), 0);
  assert.equal(C.closeScore({ pinned: true, usage: {} }, now), 0);
  assert.equal(C.closeScore({ createdAt: now - 1000, usage: {} }, now), 0);
});

test('detects only inactive empty new tabs for one-click cleanup', () => {
  const workspace = 'chrome-extension://abc/index.html';
  assert.equal(C.isEmptyNewTab({ active: false, url: workspace }, workspace), true);
  assert.equal(C.isEmptyNewTab({ active: false, url: 'chrome://newtab/' }, workspace), true);
  assert.equal(C.isEmptyNewTab({ active: true, url: workspace }, workspace), false);
  assert.equal(C.isEmptyNewTab({ active: false, url: 'https://example.com' }, workspace), false);
});

test('reorders group ids and reapplies the saved display order', () => {
  const order = C.reorderIds([10, 20, 30], 30, 10);
  assert.deepEqual(order, [30, 10, 20]);
  const groups = [{ id: 10 }, { id: 20 }, { id: 30 }];
  assert.deepEqual(C.applyGroupOrder(groups, order).map(group => group.id), [30, 10, 20]);
});

test('plans one-click grouping into existing or newly created groups', () => {
  const tabs = [
    { id: 1, title: '数据报表', url: 'https://data.test' },
    { id: 2, title: 'Figma 设计稿', url: 'https://figma.com/file' },
    { id: 3, title: '未知页面', url: 'https://unknown.test' },
  ];
  const plan = C.planAutoGrouping(tabs, [{ id: 20, title: '数据' }]);
  assert.deepEqual(plan.moves.get(20), [1]);
  assert.deepEqual(plan.creates.get('设计'), [2]);
  assert.deepEqual(plan.unresolved, [3]);
});

test('derives the verified sexagenary day and non-deterministic action cue', () => {
  assert.deepEqual(C.sexagenaryDay('2026-10-07T09:00:00+08:00'), { stem: '甲', branch: '寅', label: '甲寅', element: '木' });
  const advice = C.elementAdvice('木');
  assert.match(advice.suitable, /学习/);
  assert.match(advice.caution, /新增战线/);
  assert.equal('line' in advice, false);
});

test('shows the current solar term for the daily sign', () => {
  assert.equal(C.solarTermInfo('2026-10-08T18:00:00+08:00').name, '寒露');
  assert.match(C.solarTermInfo('2026-10-08T18:00:00+08:00').label, /寒露/);
});

test('allows user-defined classification rules', () => {
  globalThis.TAB_WORKSPACE_CONFIG = { categoryRules: [{ category: 'Research', hosts: /scholar/i, words: /experiment/i }] };
  assert.equal(C.inferCategory({ url: 'https://scholar.example/paper', title: 'Experiment' }), 'Research');
  assert.equal(C.categoryFromGroupTitle('Research Queue'), 'Research');
  delete globalThis.TAB_WORKSPACE_CONFIG;
});
