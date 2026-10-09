import "./styles.css";
import type { CapturedRequest } from "../domain/request";
import type { ExtensionMessage } from "../domain/messages";
import { buildCollection } from "../exporters/postman-builder";
import { downloadCollection } from "../exporters/json-download";
import { createPostmanCollection } from "../exporters/postman-api-client";

const tabId = chrome.devtools.inspectedWindow.tabId;
const requests = new Map<string, CapturedRequest>();
let activeRequestId: string | undefined;
const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const status = $("#status");
const list = $("#requests");
const details = $("#details");
const search = $("#search") as HTMLInputElement;
const methodFilter = $("#method-filter") as HTMLSelectElement;
const statusFilter = $("#status-filter") as HTMLSelectElement;
const selectVisible = $("#select-visible") as HTMLInputElement;
const count = $("#count");
const apiKey = $("#api-key") as HTMLInputElement;
const workspaceId = $("#workspace-id") as HTMLInputElement;
const collectionName = $("#collection-name") as HTMLInputElement;
const copyCurlButton = $("#copy-curl") as HTMLButtonElement;
const copyJsonButton = $("#copy-json") as HTMLButtonElement;
const send = (message: ExtensionMessage) => chrome.runtime.sendMessage(message);

function visibleRequests(): CapturedRequest[] {
  const query = search.value.trim().toLowerCase();
  return [...requests.values()].filter(request => {
    const matchesText = !query || `${request.method} ${request.url} ${request.response?.status ?? ""}`.toLowerCase().includes(query);
    const matchesMethod = !methodFilter.value || request.method.toUpperCase() === methodFilter.value;
    const responseStatus = request.response?.status;
    const matchesStatus = !statusFilter.value || (statusFilter.value === "none" ? responseStatus === undefined : String(responseStatus ?? "").startsWith(statusFilter.value));
    return matchesText && matchesMethod && matchesStatus;
  });
}
function selectedRequests(): CapturedRequest[] { return [...requests.values()].filter(r => r.selected && !r.excludedFromExport); }
function renderDetails(request?: CapturedRequest): void {
  activeRequestId = request?.id;
  copyCurlButton.disabled = !request;
  copyJsonButton.disabled = !request;
  if (!request) { details.textContent = "Select a request to inspect request and response details."; return; }
  const view = {
    request: { method: request.method, url: request.url, state: request.state, resourceType: request.resourceType, timestamp: new Date(request.timestamp).toISOString(), headers: request.headers, queryParams: request.queryParams, body: request.requestBody },
    response: request.response ? { status: request.response.status, statusText: request.response.statusText, mimeType: request.response.mimeType, headers: request.response.headers, body: request.response.body, fromDiskCache: request.response.fromDiskCache, fromServiceWorker: request.response.fromServiceWorker } : undefined,
    failureReason: request.failureReason
  };
  details.textContent = JSON.stringify(view, null, 2);
}
function render(): void {
  const visible = visibleRequests();
  list.replaceChildren();
  for (const request of visible) {
    const row = document.createElement("div"); row.className = "request-row"; row.setAttribute("role", "listitem");
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = request.selected; checkbox.setAttribute("aria-label", `Select ${request.method} ${request.url}`);
    checkbox.addEventListener("change", () => { request.selected = checkbox.checked; count.textContent = `${selectedRequests().length} selected · ${requests.size} captured`; });
    const open = document.createElement("button"); open.type = "button"; open.className = "request-open";
    const method = document.createElement("span"); method.className = `method method-${request.method.toLowerCase()}`; method.textContent = request.method;
    const url = document.createElement("span"); url.className = "request-url"; url.textContent = request.url; url.title = request.url;
    const badge = document.createElement("span"); badge.className = "status-code"; badge.textContent = String(request.response?.status ?? request.state);
    open.append(method, url, badge); open.addEventListener("click", () => renderDetails(request));
    row.append(checkbox, open); list.append(row);
  }
  count.textContent = `${selectedRequests().length} selected · ${requests.size} captured`;
  selectVisible.checked = visible.length > 0 && visible.every(r => r.selected);
  if (activeRequestId && requests.has(activeRequestId)) renderDetails(requests.get(activeRequestId));
}
function getExportRequests(all = false): CapturedRequest[] {
  const chosen = all ? [...requests.values()] : selectedRequests();
  return chosen.filter(r => !r.excludedFromExport);
}
function exportDownload(all = false): void {
  const chosen = getExportRequests(all);
  if (!chosen.length) { status.textContent = "Select one or more requests before exporting."; return; }
  downloadCollection(buildCollection(chosen, collectionName.value.trim() || "Captured API Requests"));
  status.textContent = `Downloaded collection with ${chosen.length} request(s). Sensitive values were redacted.`;
}
function shellQuote(value: string): string { return `'${value.replace(/'/g, `'\\''`)}'`; }
function toCurl(request: CapturedRequest): string {
  const parts = ["curl", "-X", shellQuote(request.method), shellQuote(request.url)];
  for (const header of request.headers) {
    if (["host", "content-length", "connection"].includes(header.name.toLowerCase())) continue;
    const safeValue = /^(authorization|cookie|set-cookie|x-api-key|proxy-authorization)$/i.test(header.name) ? `{{${header.name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}}}` : header.value;
    parts.push("-H", shellQuote(`${header.name}: ${safeValue}`));
  }
  if (request.requestBody?.text && !["binary", "multipart"].includes(request.requestBody.kind)) parts.push("--data-raw", shellQuote(request.requestBody.text));
  return parts.join(" ");
}
async function copyText(text: string, success: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); status.textContent = success; }
  catch { status.textContent = "Clipboard access failed. Select and copy the content from the inspector."; }
}

$("#start").addEventListener("click", async () => { const result = await send({ type: "CAPTURE_START", tabId }) as { ok?: boolean; error?: string }; status.textContent = result.ok ? "Recording network traffic…" : `Capture error: ${result.error ?? "unknown error"}`; });
$("#stop").addEventListener("click", async () => { const result = await send({ type: "CAPTURE_STOP", tabId }) as { ok?: boolean; error?: string }; status.textContent = result.ok ? "Capture stopped." : `Capture error: ${result.error ?? "unknown error"}`; });
$("#clear").addEventListener("click", async () => { await send({ type: "CAPTURE_CLEAR", tabId }); requests.clear(); renderDetails(); render(); status.textContent = "Capture cleared."; });
$("#download").addEventListener("click", () => exportDownload(false));
$("#export-all").addEventListener("click", () => exportDownload(true));
$("#publish").addEventListener("click", async () => {
  const chosen = getExportRequests(false);
  if (!chosen.length) { status.textContent = "Select one or more requests before publishing."; return; }
  status.textContent = "Creating Postman collection…";
  try {
    const result = await createPostmanCollection({ apiKey: apiKey.value, workspaceId: workspaceId.value }, buildCollection(chosen, collectionName.value.trim() || "Captured API Requests"));
    status.textContent = `Created “${result.name}” in Postman (ID: ${result.id}).`;
  } catch (error) { status.textContent = `Postman publish failed: ${error instanceof Error ? error.message : String(error)}`; }
});
$("#save-settings").addEventListener("click", async () => {
  try { await chrome.storage.local.set({ postmanApiKey: apiKey.value, postmanWorkspaceId: workspaceId.value, postmanCollectionName: collectionName.value }); status.textContent = "Postman settings saved in extension storage."; }
  catch { status.textContent = "Could not save settings. You can still download a collection."; }
});
selectVisible.addEventListener("change", () => { for (const request of visibleRequests()) request.selected = selectVisible.checked; render(); });
search.addEventListener("input", render);
methodFilter.addEventListener("change", render);
statusFilter.addEventListener("change", render);
copyCurlButton.addEventListener("click", () => { const request = activeRequestId ? requests.get(activeRequestId) : undefined; if (request) void copyText(toCurl(request), "Copied cURL command with sensitive headers replaced by variables."); });
copyJsonButton.addEventListener("click", () => { const request = activeRequestId ? requests.get(activeRequestId) : undefined; if (request) void copyText(details.textContent ?? "", "Copied request details."); });
chrome.runtime.onMessage.addListener((raw: unknown) => {
  const message = raw as ExtensionMessage;
  if (!message || !("tabId" in message) || message.tabId !== tabId) return;
  if (message.type === "REQUESTS_UPDATED") { const previous = requests.get(message.request.id); requests.set(message.request.id, { ...previous, ...message.request, selected: previous?.selected ?? message.request.selected ?? false }); render(); }
  if (message.type === "REQUESTS_CLEARED") { requests.clear(); renderDetails(); render(); }
  if (message.type === "CAPTURE_STATUS") status.textContent = message.active ? "Recording network traffic…" : "Capture stopped.";
  if (message.type === "CAPTURE_ERROR") status.textContent = message.message;
});
void chrome.storage.local.get(["postmanApiKey", "postmanWorkspaceId", "postmanCollectionName"]).then(settings => {
  apiKey.value = String(settings.postmanApiKey ?? ""); workspaceId.value = String(settings.postmanWorkspaceId ?? ""); collectionName.value = String(settings.postmanCollectionName ?? "Captured API Requests");
}).catch(() => undefined);
void send({ type: "REQUESTS_SNAPSHOT", tabId }).then((raw: unknown) => {
  const result = raw as { requests?: CapturedRequest[]; active?: boolean };
  for (const request of result.requests ?? []) requests.set(request.id, { ...request, selected: request.selected ?? false });
  status.textContent = result.active ? "Recording network traffic…" : "Ready. Start capture to begin."; render();
}).catch(() => { status.textContent = "Ready. Start capture to begin."; });
