# Security Policy

## Reporting

Please report security issues privately to the repository owner before opening a public issue.

## Scope

Security-sensitive areas include HTML escaping of tab metadata, Chrome permission usage, destructive bulk actions, URL normalization and local configuration handling.

## Safe defaults

- Tab titles and URLs are escaped before HTML rendering.
- Bulk group close requires confirmation.
- Classification suggestions do not silently move a tab.
- Current, pinned and newly opened pages are excluded from low-activity close suggestions.
- `config.local.js` is ignored by Git.

