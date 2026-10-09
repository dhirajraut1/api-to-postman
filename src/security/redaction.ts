import type { CapturedRequest, HeaderEntry } from "../domain/request";
const SENSITIVE_HEADERS = new Set(["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"]);
const SENSITIVE_FIELDS = /^(password|access_token|refresh_token|client_secret|otp|tpin|secret|api[_-]?key)$/i;
export function redactHeaders(headers: HeaderEntry[]): HeaderEntry[] {
  return headers.map(h => ({ ...h, value: SENSITIVE_HEADERS.has(h.name.toLowerCase()) ? "{{" + h.name.toLowerCase().replace(/[^a-z0-9_]/g, "_") + "}}" : h.value, sensitive: SENSITIVE_HEADERS.has(h.name.toLowerCase()) || h.sensitive }));
}
export function redactRequest(request: CapturedRequest): CapturedRequest {
  const clone: CapturedRequest = structuredClone(request);
  clone.headers = redactHeaders(clone.headers);
  clone.queryParams = clone.queryParams.map(q => ({ ...q, value: SENSITIVE_FIELDS.test(q.name) ? `{{${q.name}}}` : q.value }));
  if (clone.requestBody?.text) {
    try {
      const parsed = JSON.parse(clone.requestBody.text) as Record<string, unknown>;
      for (const key of Object.keys(parsed)) if (SENSITIVE_FIELDS.test(key)) parsed[key] = `{{${key}}}`;
      clone.requestBody.text = JSON.stringify(parsed, null, 2);
    } catch { /* Non-JSON body: do not mutate unknown payloads heuristically. */ }
  }
  return clone;
}
