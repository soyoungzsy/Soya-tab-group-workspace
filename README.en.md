# Soya Tab Group Workspace

**See your open Chrome pages in one overview, find a page, organize groups and close duplicates.**

## Start here if you do not code

This adds a small tool to Chrome on a computer. You do not need to write code. Test it with a few unimportant pages first.

1. Open the [fixed release](https://github.com/soyoungzsy/Soya-tab-group-workspace/releases/tag/v0.1.1) and choose Source code (zip) under Assets.
2. Find the ZIP in your Downloads folder and double-click to extract it. Keep the extracted folder: Chrome needs it later.
3. Type `chrome://extensions` in Chrome’s address bar, press Enter and turn on **Developer mode** at the top right. This is Chrome’s route for installing a local extension; coding knowledge is not required.
4. Click **Load unpacked** and select the `extension` folder inside the extracted project. Choose the folder, not an individual file.
5. Open a new Chrome tab. Try a few test pages; avoid closing an entire important group on your first try.

**A successful first try:** You see an overview of open pages and groups and can open a page from it.

Cannot find the folder? Check that the ZIP is extracted and inspect any extra outer folder. Nothing happens? Confirm the extension is enabled and refresh your test page. To stop, turn the extension off on the same extensions page. This does not restore an older version. Read the data notes below before uninstalling.

No paid account is required. It reads open-page titles, addresses and groups and organizes them on your computer. Closing a page can lose unsaved text; save it first. Chrome’s Reopen closed tab command may help after an accidental close.

You can skip the configuration and code details below. Use the **Issues** tab above to ask a question publicly; remove private/work information first.



Replace Chrome's new tab page with a local overview of existing tab groups so you can inspect, deduplicate, move, refresh and close open pages without maintaining another classification system.

[中文](README.md) · [Privacy](PRIVACY.md) · [Maintenance](MAINTENANCE.md)

## Background and users

For people with dozens of open pages who already use Chrome tab groups across research and parallel projects. Tabs often represent unfinished work; a single overview makes that backlog visible. It is not a bookmark archive, knowledge base, formal task manager, cloud sync service or collaboration tool. It does not read webpage bodies or determine business priorities.

## Install and first use

Download/extract or clone the repository. Open `chrome://extensions/`, enable Developer mode, choose Load unpacked and select `extension/`. Open a new tab to see existing groups and pages. No build step, third-party runtime, server or account is required. No model/API charge is involved.

First test in a temporary Chrome profile with three non-sensitive pages. Confirm display, movement and closing behavior before using bulk operations in an important window. Duplicate detection and low-activity suggestions are not judgments of business importance. Closed pages and changed groups are external state; source rollback cannot automatically restore them.

## Features

The overview preserves Chrome group names/colors, displays duplicates and can retain the most recently used copy. You can drag pages between groups, classify ungrouped pages conservatively, and refresh or close a group. Learning suggestions provide a close-after-reading action. These heuristics may be wrong; inspect before acting.

Optional configuration covers title, avatar, accent color, almanac and classification rules. Copy `extension/config.local.example.js` to `extension/config.local.js` and edit it locally. Do not put credentials there. The local file is ignored by Git. The almanac does not access calendars, journals or tasks.

## Data and permissions

The extension uses tabs, activeTab, storage, tabGroups, idle and alarms for local display and user-triggered tab operations. Titles, URLs, icons/groups and foreground-use/refresh counts support the overview and suggestions. Idle/lock time is excluded. State is stored in `chrome.storage.local`; no backend, account, telemetry or external API is included. Open URLs and local configuration may still be sensitive: do not commit real tabs, personal settings or screenshots. See [PRIVACY.md](PRIVACY.md).

## Updates, recovery and support

Back up source and local configuration, update the same loading directory and reload. Preserve extension identity/settings and verify behavior in a temporary profile. Uninstalling may remove local settings. There is no promise of restoring tab operations; save necessary URLs before closing. If the overview does not appear, verify the loaded directory, enabled extension and any competing new-tab override. Report sanitized version/environment/reproduction information through Issues; never include private tab lists or secrets. See [SECURITY.md](SECURITY.md).

Development: `npm test` and `npm run check`. This proposal changes documentation/display naming and has not established real Chrome acceptance or a formal Release. The project derives from Zara Zhang’s tab-out and retains upstream MIT attribution; see [NOTICE](NOTICE) and [LICENSE](LICENSE).

## Sources and acknowledgements

This is a derivative of [Tab Out by Zara Zhang](https://github.com/zarazhangrui/tab-out). Upstream supplies the tab overview foundation; Soya adds group-first organization, deduplication and related changes. See [NOTICE](NOTICE) for the verified revision and changes; the upstream [MIT notice](LICENSE) remains in distributions.

Version: 0.1.1 · [Release / 固定下载](https://github.com/soyoungzsy/Soya-tab-group-workspace/releases/tag/v0.1.1)
