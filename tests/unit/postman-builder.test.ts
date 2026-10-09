import { describe, expect, it } from "vitest";
import { buildCollection } from "../../src/exporters/postman-builder";
import type { CapturedRequest } from "../../src/domain/request";
const sample: CapturedRequest = {
  id: "1", tabId: 1, requestId: "cdp-1", timestamp: 1, source: "cdp", method: "POST",
  url: "https://api.example.com/v1/payments?currency=NPR", headers: [{ name: "Content-Type", value: "application/json" }],
  queryParams: [{ name: "currency", value: "NPR" }], requestBody: { kind: "json", text: '{"amount":1000}' },
  state: "complete", selected: true
};
describe("buildCollection", () => {
  it("builds a Postman v2.1 collection with method, URL and body", () => {
    const collection = buildCollection([sample]);
    expect(collection.info.schema).toContain("collection/v2.1.0");
    expect(collection.item[0].request.method).toBe("POST");
    expect(collection.item[0].request.body?.raw).toBe('{"amount":1000}');
  });
  it("omits requests excluded from export", () => {
    expect(buildCollection([{ ...sample, excludedFromExport: true }]).item).toHaveLength(0);
  });
});
