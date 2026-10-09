# API to Postman Chrome Extension

A vanilla TypeScript / Chrome Manifest V3 DevTools extension scaffold for capturing Chrome DevTools Protocol network traffic and exporting selected requests as Postman Collection v2.1 JSON.

## Features included

- Capture start/stop controls from a dedicated Chrome DevTools panel.
- Request list with selection checkboxes, select-visible, and captured/selected counts.
- Search by method, URL, or response status; filter by HTTP method and response status class.
- Request inspector showing request headers, query parameters, request body, response headers/body metadata, cache/service-worker indicators, and failures when available.
- Download a Postman Collection JSON for selected requests or all captured requests.
- Optional direct collection creation through the Postman API with workspace ID and collection name settings.
- Copy a cURL command with common credential headers replaced by Postman-style variables.
- Copy request details for debugging.
- Default redaction on Postman export for common authentication headers and sensitive JSON/query fields.
- Local extension-storage settings for the Postman API key, workspace ID, and collection name.
- Unit and integration test starter files for collection generation, redaction, and Postman API client behavior.

## Prerequisites

- Node.js 20+ recommended
- A recent Google Chrome version
- A Postman API key and workspace ID only for direct publishing

## Install and build

```bash
npm install
npm run typecheck
npm test
npm run build
```

Then run `npm run build`. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**. Select the generated `dist` directory (not the project root and not `src`). The built manifest points to `background/service-worker.js` and `devtools.html`, relative to `dist`. Open a normal website tab, open that tab’s DevTools, and look for **API to Postman** in the top tab strip; if hidden, use the `»` overflow menu.

## Typical workflow

1. Open DevTools on the target website and select **API to Postman**.
2. Select **Start capture**. Chrome asks for debugger access because capture uses the Chrome DevTools Protocol.
3. Reproduce the actions that trigger the APIs.
4. Search/filter the request list, inspect request and response details, and select requests to export.
5. Download the selected collection, or enter a Postman API key and workspace ID to publish it directly.
6. Review the collection before running it. Captured values may be environment-specific and some headers are intentionally omitted or redacted.

## Security notes

Captured traffic can include credentials, personal information, cookies, and transaction data. Use only on systems and data you are authorized to inspect. Export redaction is a safety net, not a guarantee: inspect the generated collection before sharing it. The cURL copy replaces common sensitive headers but does not currently scrub all sensitive values from URLs or arbitrary body formats. The optional Postman API key is stored in `chrome.storage.local` only when **Save settings** is clicked; this is local extension storage, not an encrypted secret vault. Avoid saving a key on shared devices and clear it when no longer needed. Captures are intended to remain local by default.

## Current implementation status / limitations

This remains a starter implementation and needs a live Chrome validation pass before production use. The DevTools and panel HTML files are Vite build entries at the project root so their TypeScript modules are bundled into `dist`; do not load the source folder directly. In particular:

- Load only the generated `dist` directory. The manifest service-worker and DevTools page paths must be relative to that directory (`background/service-worker.js` and `devtools.html`). Validate both in a live Chrome session.
- Improve request correlation across redirects and repeated CDP request IDs.
- Ensure `Network.getRequestPostData` is used where available and cover more request-body types.
- Add runtime validation and strict sender validation for extension messages.
- Recover active capture state safely across service-worker restarts.
- Improve form-urlencoded/multipart/binary body conversion and request-header filtering.
- Add schema validation for generated Postman collections and broaden redaction for nested JSON, URL parameters, form bodies, and response content.
- Add robust memory limits, large-response handling, and error recovery.
- Add live Chrome integration tests, keyboard accessibility testing, and a secure key-management approach for teams.

## Architecture

- `src/background`: service worker, debugger lifecycle, message routing
- `src/capture`: CDP event capture and request correlation
- `src/domain`: internal TypeScript types and messages
- `src/panel`: DevTools panel UI and styles
- `src/exporters`: Postman collection builder, JSON download and Postman API client
- `src/security`: secret redaction and detection
- `src/storage`: request storage
- `tests`: unit/integration starter tests and event fixtures
