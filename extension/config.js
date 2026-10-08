'use strict';

globalThis.TAB_WORKSPACE_CONFIG = {
  title: 'My Tab Workspace',
  avatar: 'icons/icon128.png',
  accentColor: '#65786d',
  showAlmanac: true,
  almanacLocale: 'zh-CN',
  categoryRules: [],
  ...(globalThis.TAB_WORKSPACE_CONFIG || {}),
};
