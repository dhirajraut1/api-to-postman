import type { CapturedRequest, HeaderEntry } from "../domain/request";
import { attachToTab, detachFromTab } from "../background/debugger-manager";

const requests = new Map<string, CapturedRequest>();
const activeTabs = new Set<number>();
const MAX_RECORDS_PER_TAB = 2000;
const MAX_BODY_BYTES = 1_000_000;
const key = (tabId: number, requestId: string) => `${tabId}:${requestId}`;
const toHeaders = (input: Record<string, unknown> = {}): HeaderEntry[] =>
  Object.entries(input).map(([name, value]) => ({ name, value: typeof value === "string" ? value : JSON.stringify(value) }));
const parseQuery = (url: string) => {
  try { return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value })); }
  catch { return []; }
};
function inferBodyKind(mimeType?: string): "json" | "text" | "unknown" {
  if (mimeType?.includes("json")) return "json";
  if (mimeType?.startsWith("text/")) return "text";
  return "unknown";
}
function publish(record: CapturedRequest): void {
  // In-memory starter store; do not persist bodies by default.
  chrome.runtime.sendMessage({ type: "REQUESTS_UPDATED", tabId: record.tabId, request: record }).catch(() => undefined);
}
export async function startCapture(tabId: number): Promise<void> { await attachToTab(tabId); activeTabs.add(tabId); }
export async function stopCapture(tabId: number): Promise<void> { activeTabs.delete(tabId); await detachFromTab(tabId); }
export function clearCapture(tabId: number): void {
  for (const [id, record] of requests) if (record.tabId === tabId) requests.delete(id);
  chrome.runtime.sendMessage({ type: "REQUESTS_CLEARED", tabId }).catch(() => undefined);
}
export function snapshot(tabId: number): CapturedRequest[] { return [...requests.values()].filter(r => r.tabId === tabId); }

chrome.debugger.onEvent.addListener((source, method, params) => {
  const tabId = source.tabId;
  if (tabId == null || !activeTabs.has(tabId) || !params) return;
  if (method === "Network.requestWillBeSent") {
    const p = params as any;
    const id = key(tabId, p.requestId);
    // Redirects can reuse requestId. Preserve previous hop before replacing it.
    const prior = requests.get(id);
    if (prior && p.redirectResponse) {
      prior.response = { status: p.redirectResponse.status, statusText: p.redirectResponse.statusText, headers: toHeaders(p.redirectResponse.headers), mimeType: p.redirectResponse.mimeType };
      prior.state = "complete";
      publish(prior);
    }
    const record: CapturedRequest = {
      id: crypto.randomUUID(), tabId, requestId: p.requestId, loaderId: p.loaderId, frameId: p.frameId,
      timestamp: Date.now(), source: "cdp", method: p.request.method, url: p.request.url,
      resourceType: p.type, headers: toHeaders(p.request.headers), queryParams: parseQuery(p.request.url),
      requestBody: typeof p.request.postData === "string" ? { kind: "text", text: p.request.postData, sizeBytes: p.request.postData.length } : undefined,
      state: "pending", selected: false
    };
    requests.set(id, record);
    trimTab(tabId);
    publish(record);
  } else if (method === "Network.responseReceived") {
    const p = params as any;
    const record = requests.get(key(tabId, p.requestId));
    if (!record) return;
    record.response = { status: p.response.status, statusText: p.response.statusText, headers: toHeaders(p.response.headers), mimeType: p.response.mimeType, fromDiskCache: p.response.fromDiskCache, fromServiceWorker: p.response.fromServiceWorker };
    publish(record);
  } else if (method === "Network.loadingFinished") {
    void completeRequest(tabId, params as any);
  } else if (method === "Network.loadingFailed") {
    const p = params as any;
    const record = requests.get(key(tabId, p.requestId));
    if (!record) return;
    record.state = "failed"; record.failureReason = p.errorText ?? "Request failed"; publish(record);
  }
});
async function completeRequest(tabId: number, event: { requestId: string; encodedDataLength?: number }): Promise<void> {
  const record = requests.get(key(tabId, event.requestId));
  if (!record) return;
  if (record.response) {
    record.response.encodedDataLength = event.encodedDataLength;
    const mime = record.response.mimeType ?? "";
    const isText = mime.startsWith("text/") || mime.includes("json") || mime.includes("xml") || mime.includes("javascript");
    if (isText && (event.encodedDataLength ?? 0) <= MAX_BODY_BYTES) {
      try {
        const result = await chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId: event.requestId }) as { body: string; base64Encoded: boolean };
        record.response.body = { kind: result.base64Encoded ? "binary" : inferBodyKind(mime), text: result.body, base64Encoded: result.base64Encoded, sizeBytes: result.body.length };
      } catch {
        record.response.body = { kind: "unknown", unavailableReason: "Response body unavailable from CDP" };
      }
    } else if (!isText) {
      record.response.body = { kind: "unknown", unavailableReason: "Binary or unsupported MIME type skipped" };
    } else {
      record.response.body = { kind: "unknown", unavailableReason: "Response exceeds configured capture limit" };
    }
  }
  record.state = record.response ? "complete" : "partial";
  publish(record);
}
function trimTab(tabId: number): void {
  const tabRecords = [...requests.entries()].filter(([, r]) => r.tabId === tabId);
  while (tabRecords.length > MAX_RECORDS_PER_TAB) {
    const [id] = tabRecords.shift()!;
    requests.delete(id);
  }
}
chrome.debugger.onDetach.addListener(source => {
  if (source.tabId == null) return;
  activeTabs.delete(source.tabId);
  chrome.runtime.sendMessage({ type: "CAPTURE_STATUS", tabId: source.tabId, active: false }).catch(() => undefined);
});
