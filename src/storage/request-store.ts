import type { CapturedRequest } from "../domain/request";
const records = new Map<string, CapturedRequest>();
export function upsert(request: CapturedRequest): void { records.set(request.id, request); }
export function listForTab(tabId: number): CapturedRequest[] { return [...records.values()].filter(r => r.tabId === tabId); }
export function clearTab(tabId: number): void { for (const [id, r] of records) if (r.tabId === tabId) records.delete(id); }
