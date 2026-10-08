'use strict';

// Copy this file to config.local.js. That file is ignored by Git.
globalThis.TAB_WORKSPACE_CONFIG = {
  title: 'Alex Workspace',
  avatar: 'icons/icon128.png',
  accentColor: '#6d7f70',
  showAlmanac: true,
  categoryRules: [
    { category: 'Research', hosts: /arxiv|scholar/i, words: /paper|research/i },
  ],
};
