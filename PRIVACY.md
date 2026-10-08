# Privacy

Tab Group Workspace is local-first.

## Data processed

- Open tab URL, title, favicon, active state, pinned state and Chrome group ID.
- Local foreground duration, reload count and last-active timestamp.
- User-defined local configuration.

## Storage

Data is stored in `chrome.storage.local`. The extension has no server, analytics SDK, account system or telemetry endpoint.

## User actions

Closing, refreshing, moving and regrouping tabs only occur after an explicit user action. Automatic suggestions do not silently move or close tabs.

## External requests

The extension does not load remote fonts, remote favicons or external APIs. Site icons are supplied by Chrome as part of tab metadata.

