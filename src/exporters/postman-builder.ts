import type { CapturedRequest } from "../domain/request";
import type { PostmanCollection, PostmanItem } from "./postman-types";
import { redactRequest } from "../security/redaction";
const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
const OMIT_HEADERS = new Set(["host", "content-length", "connection", "accept-encoding", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "priority"]);
function toPostmanItem(input: CapturedRequest): PostmanItem {
  const request = redactRequest(input);
  const headers = request.headers.filter(h => !OMIT_HEADERS.has(h.name.toLowerCase())).map(h => ({ key: h.name, value: h.value }));
  const url = new URL(request.url);
  const item: PostmanItem = { name: `${request.method} ${url.pathname}`, request: { method: request.method, header: headers, url: { raw: request.url, query: request.queryParams.map(q => ({ key: q.name, value: q.value })) } } };
  const body = request.requestBody;
  if (body?.text !== undefined && body.kind !== "binary" && body.kind !== "multipart" && body.kind !== "form-urlencoded") {
    item.request.body = { mode: "raw", raw: body.text, options: { raw: { language: body.kind === "json" ? "json" : "text" } } };
  }
  return item;
}
export function buildCollection(requests: CapturedRequest[], name = "Captured API Requests"): PostmanCollection {
  return { info: { name, description: "Generated from browser network capture.", schema: SCHEMA }, item: requests.filter(r => !r.excludedFromExport).map(toPostmanItem) };
}
